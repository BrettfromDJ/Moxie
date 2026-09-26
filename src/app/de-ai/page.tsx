"use client";

import { useMemo, useState } from "react";
import { findAIPatterns } from "@/lib/checks";
import { activeProfile, api, useStore } from "@/lib/store";
import type { DeAIResult } from "@/lib/types";

// Standalone "De-AI this" tool. Works without a profile, so it can be shared as a free tool.
export default function DeAIPage() {
  const { state } = useStore();
  const [text, setText] = useState("");
  const [result, setResult] = useState<DeAIResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const instant = useMemo(() => findAIPatterns(text), [text]);
  const voice = activeProfile(state);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      setResult(
        await api<DeAIResult>("/api/deai", {
          text,
          avoid: voice?.avoid ?? [],
          rejected: state.feedback.filter((f) => f.kind === "never" && f.note).map((f) => f.note!),
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">De-AI this</h1>
        <p className="text-sm text-muted">
          Flags generic conclusions, filler, forced contrasts, clichés, and patterns you&apos;ve rejected before, then suggests
          cleaner alternatives.
        </p>
      </header>
      <textarea
        className="input text-[15px] leading-relaxed"
        rows={8}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setResult(null);
        }}
        placeholder="Paste a post…"
        aria-label="Post to check"
      />
      {instant.length > 0 && !result && (
        <ul className="flex flex-wrap gap-1.5 text-xs">
          {instant.map((h) => (
            <li key={h.category + h.quote} className="rounded border border-warn/40 text-warn px-2 py-0.5" title={h.why}>
              {h.category}: “{h.quote}”
            </li>
          ))}
        </ul>
      )}
      <button className="btn btn-primary" type="button" disabled={!text.trim() || busy} onClick={run}>
        {busy ? "Checking…" : "De-AI this"}
      </button>
      {error && <p className="text-sm text-bad">{error}</p>}
      {result && (
        <div className="space-y-4">
          {result.flags.length === 0 ? (
            <p className="text-good text-sm">Nothing generic found. It reads like a person wrote it.</p>
          ) : (
            <ul className="space-y-2">
              {result.flags.map((f, i) => (
                <li key={i} className="card p-3 text-sm space-y-1">
                  <p>
                    <span className="font-medium text-warn">{f.category}</span>{" "}
                    <span className="line-through text-muted">“{f.quote}”</span> → <span className="text-good">“{f.suggestion}”</span>
                  </p>
                  <p className="text-muted text-xs">{f.why}</p>
                </li>
              ))}
            </ul>
          )}
          <div className="card p-4 space-y-2">
            <span className="label">Cleaner version</span>
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{result.rewrite}</p>
            <div className="flex gap-2">
              <button className="btn btn-sm" type="button" onClick={() => navigator.clipboard.writeText(result.rewrite)}>
                Copy
              </button>
              <button className="btn btn-sm" type="button" onClick={() => setText(result.rewrite)}>
                Check again
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
