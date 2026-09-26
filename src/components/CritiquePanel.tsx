"use client";

import { useState } from "react";
import type { Critique } from "@/lib/types";

const VERDICT = {
  ready: { label: "Ready to write", cls: "text-good" },
  "needs-work": { label: "The thought is there, the writing hides it", cls: "text-warn" },
  "needs-substance": { label: "The idea needs more substance first", cls: "text-bad" },
} as const;

export function CritiquePanel({
  critique,
  onAnswer,
  onClose,
}: {
  critique: Critique;
  onAnswer: (answer: string) => void;
  onClose?: () => void;
}) {
  const [answer, setAnswer] = useState("");
  const v = VERDICT[critique.verdict];
  return (
    <section className="rounded-2xl border border-line bg-panel p-5 space-y-3 text-sm" aria-label="Draft diagnosis">
      <div className="flex items-start gap-2">
        <div>
          <p className={`font-semibold ${v.cls}`}>{v.label}</p>
          <p className="text-muted mt-1">
            <span className="font-medium text-fg">What you seem to mean:</span> {critique.coreThought}
          </p>
        </div>
        {onClose && (
          <button className="btn btn-ghost btn-sm ml-auto" onClick={onClose} type="button" aria-label="Close diagnosis">
            ✕
          </button>
        )}
      </div>
      {critique.issues.length > 0 && (
        <ul className="space-y-2">
          {critique.issues.map((i, k) => (
            <li key={k} className="border-l-2 border-warn pl-3">
              <span className="font-medium">{i.type}</span>
              {i.quote && <span className="text-muted"> — “{i.quote}”</span>}
              <p className="text-muted">{i.explanation}</p>
            </li>
          ))}
        </ul>
      )}
      {critique.question && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (answer.trim()) onAnswer(answer.trim());
          }}
        >
          <p className="font-medium">{critique.question}</p>
          <textarea
            className="input"
            rows={2}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Answer in your own words; it gets added to your message."
            aria-label="Answer the question"
          />
          <button className="btn btn-primary btn-sm" type="submit" disabled={!answer.trim()}>
            Add to message
          </button>
        </form>
      )}
    </section>
  );
}
