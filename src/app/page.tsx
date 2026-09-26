"use client";

import { AtSign, Fingerprint, Layers, Megaphone, MessageCircle, PenLine, Quote, RefreshCw, Shuffle, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { CandidateCard } from "@/components/CandidateCard";
import { Composer, SEND_MODES } from "@/components/Composer";
import { CritiquePanel } from "@/components/CritiquePanel";
import { useSettings } from "@/components/SettingsPanel";
import {
  type AssistantTurn,
  type RunRequest,
  type Session,
  type UserTurn,
  activeSession,
  api,
  buildContext,
  patchActive,
  patchSession,
  uid,
  useStore,
} from "@/lib/store";
import type { AngleOption, Candidate, Critique, GenerateResponse } from "@/lib/types";

function titleFrom(text: string, session: Session): string {
  const base = text.trim() || session.references.find((r) => r.status === "ready")?.excerpt || "Untitled draft";
  const clean = base.replace(/\s+/g, " ");
  return clean.length > 48 ? `${clean.slice(0, 46)}…` : clean;
}

// Event handlers only; kept out of render so the purity lint rule is satisfied.
const timestamp = () => Date.now();

function kindFor(mode: RunRequest["mode"]): AssistantTurn["kind"] {
  return mode === "angles" ? "angles" : mode === "critique" ? "critique" : "drafts";
}

export default function WritePage() {
  const { state, update, hydrated } = useStore();
  const session = activeSession(state);
  const empty = session.turns.length === 0;
  const busy = session.turns.some((t) => t.role === "assistant" && t.status === "pending");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!empty) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [session.turns.length, empty]);

  async function run(req: RunRequest, text: string, action?: string, fromComposer = false) {
    const sid = session.id;
    const ctx = buildContext(state, session, text);
    if (req.options) ctx.settings = { ...ctx.settings, options: req.options };
    const now = timestamp();
    const userTurn: UserTurn = {
      id: uid("u"),
      role: "user",
      at: now,
      text,
      action,
      tags: session.references.filter((r) => r.status === "ready").map((r) => r.tag),
    };
    const turnId = uid("a");
    const pending: AssistantTurn = {
      id: turnId,
      role: "assistant",
      at: now,
      status: "pending",
      kind: kindFor(req.mode),
      label: req.mode === "critique" ? "Diagnosis" : req.mode === "angles" ? "Angles" : "Drafts",
      source: text,
      request: req,
    };
    update((s) =>
      patchSession(s, sid, (x) => ({
        ...x,
        title: x.turns.length ? x.title : titleFrom(text, x),
        draft: fromComposer ? "" : x.draft,
        updatedAt: now,
        turns: [...x.turns, userTurn, pending],
      })),
    );

    const finish = (p: Partial<AssistantTurn>) =>
      update((s) =>
        patchSession(s, sid, (x) => ({
          ...x,
          updatedAt: Date.now(),
          turns: x.turns.map((t) => (t.id === turnId ? ({ ...t, ...p } as AssistantTurn) : t)),
        })),
      );

    try {
      if (req.mode === "critique") {
        const target = session.references.find((r) => r.role === "target");
        const critique = await api<Critique>("/api/critique", { draft: text, context: target?.text });
        finish({ status: "done", critique });
        return;
      }
      const res = await api<GenerateResponse>("/api/generate", {
        ...ctx,
        mode: req.mode,
        chosenAngle: req.angle ?? null,
        seed: req.seed ?? null,
      });
      const n = res.candidates?.length ?? 0;
      finish({
        status: "done",
        angles: res.angles,
        candidates: res.candidates,
        formatNote: res.formatNote,
        question: res.question,
        label: res.angles
          ? `${res.angles.length} angles`
          : `${n} draft${n === 1 ? "" : "s"}${req.angle ? ` · ${req.angle.title}` : req.mode === "formats" ? " · four formats" : ""}`,
      });
    } catch (e) {
      finish({ status: "error", error: (e as Error).message });
    }
  }

  function patchTurn(turnId: string, fn: (t: AssistantTurn) => AssistantTurn) {
    update((s) => patchActive(s, (x) => ({ ...x, turns: x.turns.map((t) => (t.id === turnId && t.role === "assistant" ? fn(t) : t)) })));
  }

  if (!hydrated) return null;

  if (empty) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center px-4 pb-[12vh]">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-center mb-8">What are you thinking about?</h1>
        <div className="w-full max-w-3xl">
          <Composer autoFocus menuSide="bottom" busy={busy} onSend={(mode, text) => run({ mode }, text, undefined, true)} />
          <Starters />
          {state.profiles.length === 0 && (
            <p className="mt-6 text-center text-sm text-muted">
              <Fingerprint size={14} className="inline -mt-0.5 mr-1" />
              Drafts sound generic until it knows you.{" "}
              <Link href="/voice" className="text-accent font-medium">
                Teach it your voice
              </Link>
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col">
      <div className="flex-1 w-full max-w-3xl mx-auto px-4 pt-6 pb-8 space-y-8">
        {session.turns.map((t) =>
          t.role === "user" ? (
            <UserBubble key={t.id} turn={t} />
          ) : (
            <AssistantBlock
              key={t.id}
              turn={t}
              onRetry={() => run(t.request, t.source, "Try again")}
              onFresh={() => run(t.request, t.source, "Fresh set")}
              onAngle={(a, i) => run({ mode: "variations", angle: a }, t.source, `Write angle ${i}: ${a.title}`)}
              onMode={(mode, label, options) => run({ mode, options }, t.source, label)}
              onMoreLike={(c, i) => run({ mode: "more-like", seed: c }, t.source, `More like #${i}`)}
              onPush={(c, i) => run({ mode: "push", seed: c }, t.source, `Push #${i} further`)}
              onChangeCandidate={(c) => patchTurn(t.id, (x) => ({ ...x, candidates: x.candidates?.map((y) => (y.id === c.id ? c : y)) }))}
              onDismiss={(c) => patchTurn(t.id, (x) => ({ ...x, candidates: x.candidates?.filter((y) => y.id !== c.id) }))}
              onAnswer={(answer) => {
                update((s) => patchActive(s, (x) => ({ ...x, draft: `${t.source}\n\n${answer}`.trim() })));
                patchTurn(t.id, (x) => ({ ...x, question: null }));
              }}
            />
          ),
        )}
        <div ref={endRef} />
      </div>
      <div className="sticky bottom-0 bg-gradient-to-t from-bg via-bg to-transparent pt-6 pb-4 px-4">
        <div className="max-w-3xl mx-auto">
          <Composer busy={busy} onSend={(mode, text) => run({ mode }, text, undefined, true)} />
          <p className="text-center text-[11px] text-muted mt-2">Moxie can get things wrong. Check facts before you post.</p>
        </div>
      </div>
    </div>
  );
}

function Starters() {
  const { update } = useStore();
  const { set } = useSettings();
  const focus = () => document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Message"]')?.focus();
  const items = [
    { icon: <MessageCircle size={15} />, label: "Reply to a post", apply: () => set({ postType: "reply" }) },
    { icon: <Quote size={15} />, label: "Quote tweet", apply: () => set({ postType: "quote" }) },
    { icon: <Megaphone size={15} />, label: "Announce something", apply: () => set({ postType: "announcement" }) },
    { icon: <Layers size={15} />, label: "Write a thread", apply: () => set({ postType: "original", format: "thread" }) },
    {
      icon: <PenLine size={15} />,
      label: "Polish my draft",
      apply: () => {
        set({ postType: "original", creativity: 15 });
        update((s) => ({ ...s, sendMode: "variations" }));
      },
    },
  ];
  return (
    <div className="flex flex-wrap justify-center gap-2 mt-4">
      {items.map((i) => (
        <button
          key={i.label}
          type="button"
          onClick={() => {
            i.apply();
            focus();
          }}
          className="inline-flex items-center gap-2 rounded-full border border-line px-3.5 py-2 text-sm text-muted hover:bg-panel-2 hover:text-fg"
        >
          {i.icon}
          {i.label}
        </button>
      ))}
    </div>
  );
}

function UserBubble({ turn }: { turn: UserTurn }) {
  if (turn.action) {
    return (
      <div className="flex justify-end">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-panel-2 px-3 py-1.5 text-sm text-muted">
          <RefreshCw size={13} /> {turn.action}
        </span>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="max-w-[85%] rounded-3xl bg-panel-2 px-4 py-2.5 whitespace-pre-wrap text-[15px] leading-relaxed">
        {turn.text || <span className="text-muted italic">Find something to say about the source</span>}
      </div>
      {turn.tags.length > 0 && (
        <span className="text-xs text-muted inline-flex items-center gap-1">
          <AtSign size={12} /> {turn.tags.map((t) => `@${t}`).join(" ")}
        </span>
      )}
    </div>
  );
}

function AssistantBlock({
  turn,
  onRetry,
  onFresh,
  onAngle,
  onMode,
  onMoreLike,
  onPush,
  onChangeCandidate,
  onDismiss,
  onAnswer,
}: {
  turn: AssistantTurn;
  onRetry: () => void;
  onFresh: () => void;
  onAngle: (a: AngleOption, i: number) => void;
  onMode: (mode: RunRequest["mode"], label: string, options?: number) => void;
  onMoreLike: (c: Candidate, i: number) => void;
  onPush: (c: Candidate, i: number) => void;
  onChangeCandidate: (c: Candidate) => void;
  onDismiss: (c: Candidate) => void;
  onAnswer: (answer: string) => void;
}) {
  const header = (
    <div className="flex items-center gap-2 text-sm text-muted mb-3">
      <span className="h-6 w-6 rounded-full bg-fg text-bg grid place-items-center">
        <Sparkles size={13} />
      </span>
      <span className="font-medium text-fg">{turn.status === "pending" ? (turn.kind === "critique" ? "Reading your draft" : "Writing in your voice") : turn.label}</span>
    </div>
  );

  if (turn.status === "pending") {
    return (
      <section aria-busy="true">
        {header}
        <div className={turn.kind === "angles" ? "grid sm:grid-cols-2 gap-3" : "space-y-3"}>
          {[0, 1, 2, 3].slice(0, turn.kind === "critique" ? 1 : turn.kind === "angles" ? 4 : 3).map((i) => (
            <div key={i} className="rounded-2xl border border-line p-5 space-y-2.5 animate-pulse">
              <div className="h-3 w-1/3 rounded bg-panel-2" />
              <div className="h-3 w-full rounded bg-panel-2" />
              <div className="h-3 w-4/5 rounded bg-panel-2" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (turn.status === "error") {
    return (
      <section>
        {header}
        <div className="rounded-2xl border border-bad/30 bg-bad/5 p-4 text-sm flex items-center gap-3">
          <span className="text-bad flex-1">{turn.error}</span>
          <button type="button" className="btn btn-sm" onClick={onRetry}>
            Try again
          </button>
        </div>
      </section>
    );
  }

  if (turn.kind === "critique" && turn.critique) {
    return (
      <section>
        {header}
        <CritiquePanel critique={turn.critique} onAnswer={onAnswer} />
      </section>
    );
  }

  const chip = "inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs text-muted hover:bg-panel-2 hover:text-fg";

  return (
    <section>
      {header}
      {turn.question && <QuestionBanner question={turn.question} onAnswer={onAnswer} />}
      {turn.formatNote && <p className="text-sm text-muted mb-3">{turn.formatNote}</p>}

      {turn.angles && (
        <>
          <p className="text-sm text-muted mb-3">Pick an angle and I&apos;ll write drafts for it.</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {turn.angles.map((a, i) => (
              <button
                key={a.id}
                type="button"
                onClick={() => onAngle(a, i + 1)}
                className="group text-left rounded-2xl border border-line bg-panel p-4 hover:border-fg/40 hover:shadow-md transition-all"
                data-testid="angle"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="h-5 w-5 rounded-md bg-panel-2 text-xs font-semibold grid place-items-center">{i + 1}</span>
                  <span className="text-[11px] uppercase tracking-wide text-muted">{a.type}</span>
                </div>
                <p className="font-semibold">{a.title}</p>
                <p className="text-sm text-muted mt-1">{a.summary}</p>
                <p className="text-sm mt-2.5 border-l-2 border-line pl-3 italic">{a.preview}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-accent opacity-0 group-hover:opacity-100 transition-opacity">
                  Write this angle →
                </span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <button type="button" className={chip} onClick={() => onMode("angles", "More angles")}>
              <RefreshCw size={13} /> More angles
            </button>
            <button type="button" className={chip} onClick={() => onMode("variations", "Skip angles, write drafts")}>
              {SEND_MODES.variations.icon} Just write drafts
            </button>
            <button type="button" className={chip} onClick={() => onMode("surprise", "Surprise me")}>
              <Shuffle size={13} /> Surprise me
            </button>
          </div>
        </>
      )}

      {turn.candidates && (
        <>
          <div className="space-y-3">
            {turn.candidates.map((c, i) => (
              <CandidateCard
                key={c.id}
                candidate={c}
                index={i + 1}
                source={turn.source}
                onChange={onChangeCandidate}
                onDismiss={onDismiss}
                onMoreLike={(x) => onMoreLike(x, i + 1)}
                onPush={(x) => onPush(x, i + 1)}
              />
            ))}
            {turn.candidates.length === 0 && <p className="text-sm text-muted">All drafts hidden. Try a fresh set.</p>}
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <button type="button" className={chip} onClick={onFresh}>
              <RefreshCw size={13} /> Fresh set
            </button>
            <button type="button" className={chip} onClick={() => onMode("directions", "5 completely different directions", 5)}>
              <Shuffle size={13} /> 5 different directions
            </button>
            <button type="button" className={chip} onClick={() => onMode("formats", "Explore formats")}>
              <Layers size={13} /> Try other formats
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function QuestionBanner({ question, onAnswer }: { question: string; onAnswer: (a: string) => void }) {
  return (
    <form
      className="rounded-2xl bg-accent-soft/60 p-4 mb-3 space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        const input = (e.currentTarget.elements.namedItem("answer") as HTMLInputElement).value.trim();
        if (input) onAnswer(input);
      }}
    >
      <p className="text-sm">
        <span className="font-medium">To make this stronger:</span> {question}
      </p>
      <div className="flex gap-2">
        <input name="answer" className="input" placeholder="Answer in your own words…" aria-label="Answer" />
        <button className="btn btn-sm" type="submit">
          Add to message
        </button>
      </div>
    </form>
  );
}
