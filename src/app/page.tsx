"use client";

import { ArrowUpRight, AtSign, Fingerprint, Layers, Megaphone, MessageCircle, PenLine, Quote, RefreshCw, Shuffle } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CandidateCard } from "@/components/CandidateCard";
import { Composer } from "@/components/Composer";
import { CritiquePanel } from "@/components/CritiquePanel";
import { useSettings } from "@/components/SettingsPanel";
import { Logo } from "@/components/Logo";
import {
  type AssistantTurn,
  type RunRequest,
  type Session,
  type UserTurn,
  activeProfile,
  activeSession,
  api,
  buildContext,
  patchActive,
  patchSession,
  uid,
  useStore,
} from "@/lib/store";
import type { AngleOption, Candidate, Critique, DeAIResult, GenerateResponse } from "@/lib/types";

function titleFrom(text: string, session: Session): string {
  const base = text.trim() || session.references.find((r) => r.status === "ready")?.excerpt || "Untitled draft";
  const clean = base.replace(/\s+/g, " ");
  return clean.length > 48 ? `${clean.slice(0, 46)}…` : clean;
}

// Event handlers only; kept out of render so the purity lint rule is satisfied.
const timestamp = () => Date.now();

function kindFor(mode: RunRequest["mode"]): AssistantTurn["kind"] {
  return mode === "angles" ? "angles" : mode === "critique" ? "critique" : mode === "check" ? "check" : "drafts";
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
      label: req.mode === "critique" ? "Diagnosis" : req.mode === "check" ? "AI writing check" : req.mode === "angles" ? "Angles" : "Drafts",
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
      if (req.mode === "check") {
        const check = await api<DeAIResult>("/api/deai", {
          text,
          avoid: activeProfile(state)?.avoid ?? [],
          rejected: state.feedback.filter((f) => f.kind === "never" && f.note).map((f) => f.note!),
        });
        finish({ status: "done", check, label: check.flags.length ? `AI writing check · ${check.flags.length} to fix` : "AI writing check · looks human" });
        return;
      }
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
        label:
          (res.angles
            ? `${res.angles.length} angles`
            : `${n} draft${n === 1 ? "" : "s"}${req.angle ? ` · ${req.angle.title}` : req.mode === "formats" ? " · four formats" : ""}`) +
          (res.model ? ` · ${res.model}` : ""),
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
      <div className="min-h-full flex flex-col items-center justify-center px-4 pt-8 pb-[12vh]">
        <h1 className="title-gradient text-4xl sm:text-[3.25rem] leading-tight font-semibold tracking-tight text-center">
          What are you thinking about?
        </h1>
        <p className="mt-4 text-center text-muted max-w-md leading-relaxed">
          Drop in a rough thought, a draft, or a link. Moxie finds the angle and writes it in your voice.
        </p>
        <div className="w-full max-w-3xl mt-10">
          <Composer autoFocus menuSide="bottom" busy={busy} onSend={(mode, text) => run({ mode }, text, undefined, true)} />
          <Starters />
          {state.profiles.length === 0 && (
            <p className="mt-6 text-center text-sm text-muted">
              <Fingerprint size={14} className="inline -mt-0.5 mr-1" />
              Drafts sound generic until it knows you.{" "}
              <Link href="/voice" className="text-fg font-medium underline underline-offset-4 decoration-line-strong">
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
      <div className="flex-1 w-full max-w-3xl mx-auto px-4 pt-8 pb-10 space-y-10">
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
              onUseText={(text) => update((s) => patchActive(s, (x) => ({ ...x, draft: text })))}
              onAnswer={(answer) => {
                update((s) => patchActive(s, (x) => ({ ...x, draft: `${t.source}\n\n${answer}`.trim() })));
                patchTurn(t.id, (x) => ({ ...x, question: null }));
              }}
            />
          ),
        )}
        <div ref={endRef} />
      </div>
      <div className="sticky bottom-0 z-10 px-4 pt-10 pb-4 bg-gradient-to-t from-bg from-70% to-transparent">
        <div className="max-w-3xl mx-auto">
          <Composer busy={busy} onSend={(mode, text) => run({ mode }, text, undefined, true)} />
          <p className="text-center text-[11px] text-faint mt-2.5">Moxie can get things wrong. Check facts before you post.</p>
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
    <div className="flex flex-wrap justify-center gap-2 mt-5">
      {items.map((i) => (
        <button
          key={i.label}
          type="button"
          onClick={() => {
            i.apply();
            focus();
          }}
          className="inline-flex items-center gap-2 rounded-full border border-line bg-panel px-3.5 py-2 text-sm text-muted hover:bg-panel-2 hover:text-fg hover:border-line-strong transition-colors"
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
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel px-3 py-1.5 text-sm text-muted">
          <RefreshCw size={13} /> {turn.action}
        </span>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="max-w-[85%] rounded-2xl border border-line bg-panel-2 px-4 py-3 whitespace-pre-wrap text-[15px] leading-relaxed">
        {turn.text || <span className="text-muted italic">Find something to say about the source</span>}
      </div>
      {turn.tags.length > 0 && (
        <span className="text-xs text-faint inline-flex items-center gap-1">
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
  onUseText,
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
  onUseText: (text: string) => void;
}) {
  const header = (
    <div className="flex items-center gap-3 mb-4">
      <span className="inline-flex items-center gap-2 rounded-full bg-panel-3 pl-1.5 pr-3 py-1 text-xs font-semibold">
        <span className="h-5 w-5 rounded-full bg-black grid place-items-center">
          <Logo size={13} />
        </span>
        Moxie
      </span>
      <span className={`text-sm ${turn.status === "pending" ? "text-muted animate-pulse" : "text-muted"}`}>
        {turn.status === "pending"
          ? turn.kind === "critique"
            ? "Reading your draft…"
            : turn.kind === "check"
              ? "Checking for AI patterns…"
              : "Writing in your voice…"
          : turn.label}
      </span>
    </div>
  );

  if (turn.status === "pending") {
    return (
      <section aria-busy="true">
        {header}
        <div className="rounded-2xl border border-line bg-panel divide-y divide-line overflow-hidden">
          {[0, 1, 2].slice(0, turn.kind === "critique" || turn.kind === "check" ? 1 : 3).map((i) => (
            <div key={i} className="p-5 space-y-2.5 animate-pulse">
              <div className="h-3 w-1/4 rounded bg-panel-3" />
              <div className="h-3 w-full rounded bg-panel-2" />
              <div className="h-3 w-3/5 rounded bg-panel-2" />
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

  if (turn.kind === "check" && turn.check) {
    return (
      <section>
        {header}
        <CheckResult result={turn.check} original={turn.source} onUse={onUseText} />
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

  const chip =
    "inline-flex items-center gap-1.5 rounded-full border border-line bg-panel px-3 py-1.5 text-xs text-muted hover:bg-panel-2 hover:text-fg hover:border-line-strong transition-colors";

  return (
    <section>
      {header}
      {turn.question && <QuestionBanner question={turn.question} onAnswer={onAnswer} />}
      {turn.formatNote && <p className="text-sm text-muted mb-4">{turn.formatNote}</p>}

      {turn.angles && (
        <>
          <div className="rounded-2xl border border-line bg-panel overflow-hidden">
            <div className="hidden sm:grid grid-cols-[2.5rem_9rem_1fr_5rem] gap-4 px-5 py-2.5 text-xs text-faint border-b border-line">
              <span>#</span>
              <span>Type</span>
              <span>Angle</span>
              <span />
            </div>
            <div className="divide-y divide-line">
              {turn.angles.map((a, i) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => onAngle(a, i + 1)}
                  className="group w-full grid grid-cols-[1.75rem_1fr_auto] sm:grid-cols-[2.5rem_9rem_1fr_5rem] gap-4 px-5 py-4 text-left hover:bg-panel-2 transition-colors"
                  data-testid="angle"
                >
                  <span className="text-sm text-faint tabular-nums pt-px">{i + 1}</span>
                  <span className="hidden sm:block text-xs uppercase tracking-wide text-muted pt-1">{a.type}</span>
                  <span className="min-w-0">
                    <span className="block font-medium">{a.title}</span>
                    <span className="block text-sm text-muted mt-0.5">{a.summary}</span>
                    <span className="block text-sm text-fg/80 mt-2 italic">“{a.preview}”</span>
                  </span>
                  <span className="flex items-start justify-end pt-0.5 text-xs text-muted group-hover:text-fg">
                    <span className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 group-hover:border-line-strong group-hover:bg-panel-3">
                      Write <ArrowUpRight size={13} />
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <button type="button" className={chip} onClick={() => onMode("angles", "More angles")}>
              <RefreshCw size={13} /> More angles
            </button>
            <button type="button" className={chip} onClick={() => onMode("variations", "Skip angles, write drafts")}>
              <PenLine size={13} /> Just write drafts
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
      className="rounded-2xl border border-line bg-panel p-4 mb-4 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const input = (e.currentTarget.elements.namedItem("answer") as HTMLInputElement).value.trim();
        if (input) onAnswer(input);
      }}
    >
      <p className="text-sm">
        <span className="text-accent font-medium">To make this stronger</span> <span className="text-muted">·</span> {question}
      </p>
      <div className="flex gap-2">
        <input name="answer" className="input" placeholder="Answer in your own words…" aria-label="Answer" />
        <button className="btn" type="submit">
          Add to message
        </button>
      </div>
    </form>
  );
}

function CheckResult({ result, original, onUse }: { result: DeAIResult; original: string; onUse: (text: string) => void }) {
  const [copied, setCopied] = useState(false);
  const clean = result.flags.length === 0;
  return (
    <div className="rounded-2xl border border-line bg-panel overflow-hidden">
      {clean ? (
        <p className="p-5 text-sm">
          <span className="tag tag-good mr-2">Looks human</span>
          Nothing generic or machine-sounding found.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {result.flags.map((f, i) => (
            <li key={i} className="p-4 sm:px-5 text-sm space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="tag tag-warn">{f.category}</span>
                <span className="text-muted line-through decoration-muted/50 truncate">“{f.quote}”</span>
              </div>
              <p>
                <span className="text-muted">Try:</span> {f.suggestion}
              </p>
              <p className="text-xs text-faint">{f.why}</p>
            </li>
          ))}
        </ul>
      )}
      {!clean && result.rewrite.trim() !== original.trim() && (
        <div className="border-t border-line p-5 space-y-3 bg-panel-2/40">
          <span className="label !mb-0">Cleaner version</span>
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{result.rewrite}</p>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-sm"
              onClick={async () => {
                await navigator.clipboard.writeText(result.rewrite).catch(() => undefined);
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
              }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
            <button type="button" className="btn btn-sm" onClick={() => onUse(result.rewrite)}>
              Put in message box
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
