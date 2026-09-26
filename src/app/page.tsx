"use client";

import Link from "next/link";
import { useState } from "react";
import { CandidateCard } from "@/components/CandidateCard";
import { Controls } from "@/components/Controls";
import { CritiquePanel } from "@/components/CritiquePanel";
import { ReferencesPanel, useReferenceActions } from "@/components/References";
import { TagTextarea, unknownTags } from "@/components/TagTextarea";
import { EMPTY_COMPOSER, api, buildContext, type Round, uid, useStore } from "@/lib/store";
import { findStructure } from "@/lib/structures";
import type {
  AngleOption,
  Candidate,
  Critique,
  GenerateMode,
  GenerateResponse,
} from "@/lib/types";

const ROUND_LABEL: Record<GenerateMode, string> = {
  angles: "Angles",
  variations: "Drafts",
  surprise: "Surprise me",
  directions: "Completely different directions",
  formats: "Same idea, four formats",
  "more-like": "More like this",
  push: "Pushed further",
};

function makeRound(label: string, res: GenerateResponse): Round {
  return {
    id: uid("r"),
    label,
    at: Date.now(),
    angles: res.angles,
    candidates: res.candidates ?? [],
    formatNote: res.formatNote,
    question: res.question,
  };
}

export default function WritePage() {
  const { state, update, hydrated } = useStore();
  const { addUrl, addText } = useReferenceActions();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [critique, setCritique] = useState<Critique | null>(null);
  const [showSettings, setShowSettings] = useState(true);
  const [source, setSource] = useState("");

  const c = state.composer;
  const s = c.settings;
  const responding = s.postType === "quote" || s.postType === "reply";
  const hasTarget = c.references.some((r) => r.role === "target");
  const unknown = unknownTags(`${c.thought} ${c.take}`, c.references);
  const structure = findStructure(s.structureId, state.customStructures);
  const hasInput = !!(c.thought.trim() || c.take.trim() || c.references.some((r) => r.status === "ready"));
  const loadingRefs = c.references.some((r) => r.status === "loading");

  const setComposer = (p: Partial<typeof c>) => update((st) => ({ ...st, composer: { ...st.composer, ...p } }));

  const appendTag = (field: "thought" | "take") => (tag: string) =>
    update((st) => {
      const cur = st.composer[field];
      return { ...st, composer: { ...st.composer, [field]: `${cur}${cur && !/\s$/.test(cur) ? " " : ""}@${tag} ` } };
    });

  async function run(mode: GenerateMode, opts: { angle?: AngleOption; seed?: Candidate; options?: number } = {}) {
    setBusy(mode);
    setError(null);
    try {
      const ctx = buildContext(state);
      if (opts.options) ctx.settings = { ...ctx.settings, options: opts.options };
      const res = await api<GenerateResponse>("/api/generate", {
        ...ctx,
        mode,
        chosenAngle: opts.angle ?? null,
        seed: opts.seed ?? null,
      });
      const round = makeRound(opts.angle ? `Drafts: ${opts.angle.title}` : ROUND_LABEL[mode], res);
      update((st) => ({ ...st, rounds: [round, ...st.rounds].slice(0, 20) }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  // Angles first when the user hasn't picked one (and isn't just asking for a cleanup).
  const primaryMode: GenerateMode = s.angle === "auto" && s.creativity > 15 ? "angles" : "variations";

  async function diagnose() {
    setBusy("critique");
    setError(null);
    try {
      const target = c.references.find((r) => r.role === "target");
      const out = await api<Critique>("/api/critique", {
        draft: [c.thought, c.take].filter((x) => x.trim()).join("\n\n"),
        context: target?.text,
      });
      setCritique(out);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function patchCandidate(roundId: string, next: Candidate) {
    update((st) => ({
      ...st,
      rounds: st.rounds.map((r) =>
        r.id === roundId ? { ...r, candidates: r.candidates.map((x) => (x.id === next.id ? next : x)) } : r,
      ),
    }));
  }

  function dismiss(roundId: string, cand: Candidate) {
    update((st) => ({
      ...st,
      rounds: st.rounds.map((r) => (r.id === roundId ? { ...r, candidates: r.candidates.filter((x) => x.id !== cand.id) } : r)),
    }));
  }

  function addAnswer(answer: string) {
    setComposer({ thought: `${c.thought.trim()}\n\n${answer}`.trim() });
    setCritique(null);
    update((st) => ({ ...st, rounds: st.rounds.map((r, i) => (i === 0 ? { ...r, question: null } : r)) }));
  }

  const [latest, ...earlier] = state.rounds;

  function renderRound(round: Round) {
    return (
      <div className="space-y-4">
        {round.question && (
          <QuestionBanner question={round.question} onAnswer={addAnswer} />
        )}
        {round.formatNote && (
          <p className="text-sm rounded-lg bg-accent-soft text-accent px-3 py-2">{round.formatNote}</p>
        )}
        {round.angles && (
          <div className="grid sm:grid-cols-2 gap-3">
            {round.angles.map((a) => (
              <button
                key={a.id}
                type="button"
                disabled={!!busy}
                onClick={() => run("variations", { angle: a })}
                className="card p-4 text-left hover:border-accent transition-colors disabled:opacity-60 group"
                data-testid="angle"
              >
                <span className="text-[11px] uppercase tracking-wide text-muted">{a.type}</span>
                <p className="font-semibold mt-0.5">{a.title}</p>
                <p className="text-sm text-muted mt-1">{a.summary}</p>
                <p className="text-sm mt-2 italic">“{a.preview}”</p>
                <span className="text-xs text-accent mt-2 inline-block opacity-70 group-hover:opacity-100">
                  Write this angle →
                </span>
              </button>
            ))}
          </div>
        )}
        {round.candidates.map((cand) => (
          <CandidateCard
            key={cand.id}
            candidate={cand}
            onChange={(next) => patchCandidate(round.id, next)}
            onDismiss={(x) => dismiss(round.id, x)}
            onMoreLike={(x) => run("more-like", { seed: x })}
            onPush={(x) => run("push", { seed: x })}
          />
        ))}
        {!round.angles && round.candidates.length === 0 && (
          <p className="text-sm text-muted">All options dismissed. Try a fresh set.</p>
        )}
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-6 items-start">
      {/* Composer */}
      <section className="space-y-4" aria-label="Composer">
        <h1 className="text-2xl font-semibold tracking-tight">What are you thinking about?</h1>

        {responding && !hasTarget && (
          <form
            className="card p-3 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              const v = source.trim();
              if (!v) return;
              const tag = /^https?:\/\/\S+$/.test(v) ? addUrl(v) : addText(v);
              update((st) => ({
                ...st,
                composer: {
                  ...st.composer,
                  references: st.composer.references.map((r) => (r.tag === tag ? { ...r, role: "target" } : r)),
                },
              }));
              setSource("");
            }}
          >
            <span className="label">{s.postType === "reply" ? "Post you're replying to" : "Post you're quoting"}</span>
            <textarea
              className="input"
              rows={2}
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="Paste a link to the post, or its text"
              aria-label="Source post"
            />
            <button className="btn btn-sm" type="submit" disabled={!source.trim()}>
              Add source
            </button>
          </form>
        )}

        {responding && (
          <div>
            <span className="label">Your take — optional</span>
            <TagTextarea
              ariaLabel="Your take"
              value={c.take}
              onChange={(take) => setComposer({ take })}
              references={c.references}
              rows={3}
              placeholder="Leave blank to see angles, jot a rough thought, or paste your draft reply."
            />
          </div>
        )}

        <div>
          {responding && <span className="label">Notes & instructions — optional</span>}
          <TagTextarea
            ariaLabel="Your thought"
            autoFocus={hydrated && !responding}
            value={c.thought}
            onChange={(thought) => setComposer({ thought })}
            references={c.references}
            onPasteUrl={(url) => addUrl(url)}
            rows={responding ? 3 : 6}
            placeholder={
              responding
                ? "e.g. Use the stat from @article but don't mention the article."
                : "An idea, a rough draft, or instructions like “Write a quote tweet of @original using the point from @article.” Paste a link to add it as a reference."
            }
          />
          {unknown.length > 0 && (
            <p className="text-xs text-warn mt-1">
              {unknown.map((t) => `@${t}`).join(", ")} {unknown.length === 1 ? "isn't a reference" : "aren't references"}; it will be sent as a normal mention.
            </p>
          )}
          {structure && (
            <p className="text-xs text-muted mt-1">
              Using structure <span className="font-medium text-fg">{structure.name}</span> ({structure.pattern}).{" "}
              <button className="text-accent" onClick={() => update((st) => ({ ...st, composer: { ...st.composer, settings: { ...st.composer.settings, structureId: null } } }))} type="button">
                Remove
              </button>
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className="btn btn-primary !px-4 !py-2 !text-sm"
            disabled={!hasInput || !!busy || loadingRefs}
            onClick={() => run(primaryMode)}
            type="button"
          >
            {busy === primaryMode ? "Finding…" : loadingRefs ? "Reading links…" : "Find the tweet"}
          </button>
          {primaryMode === "angles" && (
            <button className="btn" disabled={!hasInput || !!busy} onClick={() => run("variations")} type="button">
              {busy === "variations" ? "Writing…" : "Skip to drafts"}
            </button>
          )}
          <button className="btn" disabled={!hasInput || !!busy} onClick={() => run("surprise")} type="button">
            {busy === "surprise" ? "Surprising…" : "Surprise me"}
          </button>
          <button className="btn" disabled={!hasInput || !!busy} onClick={() => run("formats")} type="button">
            {busy === "formats" ? "Exploring…" : "Explore formats"}
          </button>
          <button
            className="btn"
            disabled={!(c.thought.trim() || c.take.trim()) || !!busy}
            onClick={diagnose}
            type="button"
            title="Explains what's weak and asks one useful question before you polish"
          >
            {busy === "critique" ? "Reading…" : "Find the real thought"}
          </button>
        </div>

        {critique && <CritiquePanel critique={critique} onAnswer={addAnswer} onClose={() => setCritique(null)} />}

        <details open={showSettings} onToggle={(e) => setShowSettings((e.target as HTMLDetailsElement).open)} className="card p-4">
          <summary className="cursor-pointer text-sm font-medium select-none">Settings</summary>
          <div className="mt-4">
            <Controls />
          </div>
        </details>

        <div className="card p-4">
          <ReferencesPanel onInsertTag={appendTag("thought")} />
        </div>

        <button
          className="btn btn-ghost btn-sm text-muted"
          type="button"
          onClick={() => {
            if (confirm("Clear the composer and references?"))
              update((st) => ({ ...st, composer: { ...EMPTY_COMPOSER, settings: st.composer.settings } }));
          }}
        >
          Clear composer
        </button>
      </section>

      {/* Results */}
      <section className="space-y-4 min-w-0" aria-label="Results" aria-live="polite">
        {error && <p className="card p-3 text-sm text-bad border-bad/40">{error}</p>}
        {busy && busy !== "critique" && (
          <div className="card p-4 text-sm text-muted animate-pulse">Writing in your voice…</div>
        )}
        {!latest && !busy && (
          <EmptyState hasProfile={state.profiles.length > 0} />
        )}
        {latest && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-semibold">{latest.label}</h2>
              <span className="ml-auto flex gap-2">
                <button className="btn btn-sm" disabled={!!busy || !hasInput} onClick={() => run(latest.angles ? "angles" : "variations")} type="button">
                  Fresh set
                </button>
                <button className="btn btn-sm" disabled={!!busy || !hasInput} onClick={() => run("directions", { options: 5 })} type="button">
                  Explore 5 completely different directions
                </button>
              </span>
            </div>
            {renderRound(latest)}
          </div>
        )}
        {earlier.length > 0 && (
          <details className="space-y-3">
            <summary className="cursor-pointer text-sm text-muted select-none">Earlier rounds ({earlier.length})</summary>
            {earlier.map((r) => (
              <div key={r.id} className="space-y-3 pt-3">
                <h3 className="text-sm font-medium text-muted">
                  {r.label} · {new Date(r.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </h3>
                {renderRound(r)}
              </div>
            ))}
            <button className="btn btn-ghost btn-sm text-muted" type="button" onClick={() => update((st) => ({ ...st, rounds: st.rounds.slice(0, 1) }))}>
              Clear earlier rounds
            </button>
          </details>
        )}
      </section>
    </div>
  );
}

function QuestionBanner({ question, onAnswer }: { question: string; onAnswer: (a: string) => void }) {
  const [answer, setAnswer] = useState("");
  return (
    <form
      className="card p-3 space-y-2 border-accent/40"
      onSubmit={(e) => {
        e.preventDefault();
        if (answer.trim()) onAnswer(answer.trim());
      }}
    >
      <p className="text-sm">
        <span className="font-medium">One question to find more substance:</span> {question}
      </p>
      <div className="flex gap-2">
        <input className="input" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Your answer…" aria-label="Answer" />
        <button className="btn btn-sm" type="submit" disabled={!answer.trim()}>
          Add
        </button>
      </div>
    </form>
  );
}

function EmptyState({ hasProfile }: { hasProfile: boolean }) {
  return (
    <div className="card p-8 text-center space-y-3">
      <p className="text-lg font-medium">Teach it what sounds like you, then get several useful ways to say what you mean.</p>
      <ul className="text-sm text-muted space-y-1">
        <li>Write a rough thought, paste a draft, or add a link.</li>
        <li>
          <span className="font-medium text-fg">Find the tweet</span> proposes distinct angles; pick one to get drafts.
        </li>
        <li>Mark drafts “More like this” or “Never like this” and it learns your taste.</li>
      </ul>
      {!hasProfile && (
        <Link href="/voice" className="btn btn-primary">
          Set up your voice
        </Link>
      )}
    </div>
  );
}
