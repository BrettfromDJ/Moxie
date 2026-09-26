"use client";

import { useState } from "react";
import { candidateText, useStore } from "@/lib/store";
import type { FeedbackKind } from "@/lib/types";

const KIND_LABEL: Record<FeedbackKind, string> = {
  more: "More like this",
  never: "Never like this",
  edit: "Edited",
  posted: "Posted",
};

export default function LibraryPage() {
  const { state, update } = useStore();
  const [tab, setTab] = useState<"saved" | "posted" | "signals">("saved");

  return (
    <div className="space-y-6 max-w-4xl">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Library</h1>
        <p className="text-sm text-muted">
          Saved drafts, what you&apos;ve posted, and every signal the tool is learning from. Remove anything it shouldn&apos;t learn.
        </p>
      </header>
      <div className="flex gap-1" role="tablist">
        {(
          [
            ["saved", `Saved (${state.saved.length})`],
            ["posted", `Posted (${state.posted.length})`],
            ["signals", `Learning signals (${state.feedback.length})`],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            type="button"
            className={`btn btn-sm ${tab === k ? "!border-accent !text-accent" : ""}`}
            onClick={() => setTab(k)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "saved" && (
        <ul className="space-y-3">
          {state.saved.length === 0 && <li className="text-sm text-muted">Nothing saved yet.</li>}
          {state.saved.map((c) => (
            <li key={c.id} className="card p-4 space-y-2">
              <p className="text-xs text-muted">
                {c.angle} · {c.structure}
              </p>
              {c.thread.length ? (
                <ol className="space-y-2 list-decimal pl-5">
                  {c.thread.map((t) => (
                    <li key={t.id} className="whitespace-pre-wrap text-sm">
                      {t.text}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="whitespace-pre-wrap text-sm">{c.text}</p>
              )}
              <div className="flex gap-2">
                <button className="btn btn-sm" type="button" onClick={() => navigator.clipboard.writeText(candidateText(c))}>
                  Copy
                </button>
                <button className="btn btn-sm btn-ghost text-muted" type="button" onClick={() => update((s) => ({ ...s, saved: s.saved.filter((x) => x.id !== c.id) }))}>
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {tab === "posted" && (
        <ul className="space-y-3">
          {state.posted.length === 0 && (
            <li className="text-sm text-muted">Use “I posted this” on a draft. Posted items help drafts avoid repeating you.</li>
          )}
          {state.posted.map((p) => (
            <li key={p.id} className="card p-4 space-y-2">
              <p className="whitespace-pre-wrap text-sm">{p.text}</p>
              <div className="flex gap-2 items-center text-xs text-muted">
                {new Date(p.at).toLocaleDateString()}
                <button className="btn btn-sm btn-ghost ml-auto" type="button" onClick={() => update((s) => ({ ...s, posted: s.posted.filter((x) => x.id !== p.id) }))}>
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {tab === "signals" && (
        <div className="space-y-3">
          {state.feedback.length > 0 && (
            <button
              className="btn btn-sm !text-bad"
              type="button"
              onClick={() => confirm("Forget all learning signals?") && update((s) => ({ ...s, feedback: [] }))}
            >
              Forget all
            </button>
          )}
          <ul className="space-y-2">
            {state.feedback.length === 0 && <li className="text-sm text-muted">No signals yet.</li>}
            {[...state.feedback].reverse().map((f) => (
              <li key={f.id} className="card p-3 text-sm space-y-1">
                <div className="flex items-center gap-2 text-xs">
                  <span className={`font-medium ${f.kind === "never" ? "text-bad" : f.kind === "more" ? "text-good" : "text-accent"}`}>
                    {KIND_LABEL[f.kind]}
                  </span>
                  {f.note && <span className="text-muted">“{f.note}”</span>}
                  <span className="text-muted ml-auto">{new Date(f.at).toLocaleString()}</span>
                  <button className="text-muted" type="button" onClick={() => update((s) => ({ ...s, feedback: s.feedback.filter((x) => x.id !== f.id) }))}>
                    Remove
                  </button>
                </div>
                {f.kind === "edit" ? (
                  <div className="grid sm:grid-cols-2 gap-2">
                    <p className="whitespace-pre-wrap text-muted line-through decoration-muted/40">{f.text}</p>
                    <p className="whitespace-pre-wrap">{f.editedText}</p>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap line-clamp-4">{f.text}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
