"use client";

import { useMemo, useState } from "react";
import { checkVoiceRules } from "@/lib/checks";
import { mostSimilar } from "@/lib/retrieval";
import { activeProfile, addFeedback, api, buildContext, candidateText, uid, useStore } from "@/lib/store";
import type { Candidate, CardRole, RefineAction, ThreadCard } from "@/lib/types";
import { formatReadingTime, readingSeconds, xLength } from "@/lib/xcount";

const ROLES: CardRole[] = ["hook", "setup", "insight", "example", "takeaway", "close", "other"];

const MATCH_STYLE = {
  strong: "text-good",
  partial: "text-warn",
  weak: "text-bad",
} as const;

function Count({ text, limit }: { text: string; limit: number }) {
  const n = xLength(text);
  return (
    <span className={`tabular-nums ${n > limit ? "text-bad font-semibold" : "text-muted"}`}>
      {n}/{limit}
    </span>
  );
}

export function CandidateCard({
  candidate,
  onChange,
  onMoreLike,
  onPush,
  onDismiss,
}: {
  candidate: Candidate;
  onChange: (c: Candidate) => void;
  onMoreLike: (c: Candidate) => void;
  onPush: (c: Candidate) => void;
  onDismiss: (c: Candidate) => void;
}) {
  const { state, update } = useStore();
  const c = candidate;
  const limit = state.composer.settings.charLimit;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [never, setNever] = useState(false);
  const [neverNote, setNeverNote] = useState("");
  const [custom, setCustom] = useState("");
  const [copied, setCopied] = useState(false);

  const full = candidateText(c);
  const isThread = c.thread.length > 0;
  const over = isThread ? c.thread.some((t) => xLength(t.text) > limit) : xLength(c.text) > limit;
  const voice = activeProfile(state);

  const checks = useMemo(() => checkVoiceRules(full, voice, state.feedback), [full, voice, state.feedback]);
  const repeat = useMemo(() => {
    const prior = [...state.posted.map((p) => p.text), ...(voice?.samples ?? []).map((s) => s.text)];
    const m = mostSimilar(full, prior);
    return m && m.score >= 0.3 ? m : null;
  }, [full, state.posted, voice]);

  async function refine(action: RefineAction, cardId?: string, instruction?: string) {
    setBusy(action);
    setError(null);
    try {
      const res = await api<{ candidate: Candidate; stillOver: boolean }>("/api/refine", {
        ...buildContext(state),
        action,
        candidate: c,
        cardId,
        instruction,
      });
      onChange(res.candidate);
      if (res.stillOver) setError("Still over the limit after two passes. Try Shorten or edit by hand.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function saveEdit() {
    // For threads, cards are edited in place and `draft` holds the pre-edit snapshot.
    const before = isThread ? draft : full;
    const next: Candidate = isThread ? c : { ...c, text: draft };
    const after = candidateText(next);
    if (after.trim() !== before.trim()) {
      update((s) => addFeedback(s, "edit", before, { editedText: after }));
    }
    onChange(next);
    setEditing(false);
  }

  function setCards(thread: ThreadCard[]) {
    onChange({ ...c, thread });
  }

  function editCard(id: string, text: string) {
    setCards(c.thread.map((t) => (t.id === id ? { ...t, text } : t)));
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= c.thread.length) return;
    const next = [...c.thread];
    [next[i], next[j]] = [next[j], next[i]];
    setCards(next);
  }

  async function copy() {
    const text = isThread ? c.thread.map((t) => t.text).join("\n\n---\n\n") : c.text;
    await navigator.clipboard.writeText(text).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <article className="card p-4 space-y-3" data-testid="candidate">
      <header className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-accent-soft text-accent px-2 py-0.5 font-medium">{c.angle}</span>
        <span className="text-muted">{c.structure}</span>
        <span className="text-muted">·</span>
        <span className="text-muted capitalize">{c.format.replace("-", " ")}</span>
        <button className="ml-auto btn btn-ghost btn-sm" onClick={copy} type="button">
          {copied ? "Copied" : "Copy"}
        </button>
      </header>

      {!isThread &&
        (editing ? (
          <div className="space-y-2">
            <textarea
              className="input text-[15px] leading-relaxed"
              rows={Math.max(4, draft.split("\n").length + 1)}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
              aria-label="Edit post"
            />
            <div className="flex items-center gap-2 text-xs">
              <Count text={draft} limit={limit} />
              <button className="btn btn-primary btn-sm ml-auto" onClick={saveEdit} type="button">
                Save edit
              </button>
              <button className="btn btn-sm" onClick={() => setEditing(false)} type="button">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{c.text}</p>
        ))}

      {isThread && (
        <ol className="space-y-2">
          {c.thread.map((t, i) => (
            <li key={t.id} className="rounded-lg border border-line bg-panel-2/50 p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted tabular-nums">
                  {i + 1}/{c.thread.length}
                </span>
                <select
                  aria-label={`Role of post ${i + 1}`}
                  className="bg-transparent text-accent font-medium outline-none"
                  value={t.role}
                  onChange={(e) =>
                    setCards(c.thread.map((x) => (x.id === t.id ? { ...x, role: e.target.value as CardRole } : x)))
                  }
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <Count text={t.text} limit={limit} />
                <span className="ml-auto flex gap-1">
                  <button className="btn btn-ghost btn-sm" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} type="button">
                    ↑
                  </button>
                  <button className="btn btn-ghost btn-sm" aria-label="Move down" disabled={i === c.thread.length - 1} onClick={() => move(i, 1)} type="button">
                    ↓
                  </button>
                  <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => refine("shorten-card", t.id)} type="button">
                    {busy === "shorten-card" ? "…" : "Shorten"}
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    aria-label={`Delete post ${i + 1}`}
                    disabled={c.thread.length <= 1}
                    onClick={() => setCards(c.thread.filter((x) => x.id !== t.id))}
                    type="button"
                  >
                    ✕
                  </button>
                </span>
              </div>
              {editing ? (
                <textarea
                  className="input text-[15px]"
                  rows={Math.max(2, t.text.split("\n").length + 1)}
                  value={t.text}
                  onChange={(e) => editCard(t.id, e.target.value)}
                  aria-label={`Edit post ${i + 1}`}
                />
              ) : (
                <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{t.text}</p>
              )}
            </li>
          ))}
          <li className="flex gap-2 flex-wrap">
            <button
              className="btn btn-sm"
              type="button"
              onClick={() => {
                if (!editing) setDraft(full);
                setCards([...c.thread, { id: uid("t"), role: "other", text: "" }]);
                setEditing(true);
              }}
            >
              + Add post
            </button>
            <button className="btn btn-sm" type="button" disabled={!!busy} onClick={() => refine("strengthen-hook")}>
              {busy === "strengthen-hook" ? "Working…" : "Strengthen opening"}
            </button>
            <button className="btn btn-sm" type="button" disabled={!!busy} onClick={() => refine("pacing")}>
              {busy === "pacing" ? "Working…" : "Better pacing"}
            </button>
          </li>
        </ol>
      )}

      <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {!isThread && (
          <div>
            <dt className="sr-only">Characters</dt>
            <dd>
              <Count text={c.text} limit={limit} /> chars
            </dd>
          </div>
        )}
        {isThread && <dd>{c.thread.length} posts</dd>}
        <dd>{formatReadingTime(readingSeconds(full))}</dd>
        <dd title="The model's own estimate, not a measured score">
          Voice match (estimate): <span className={MATCH_STYLE[c.voiceMatch]}>{c.voiceMatch}</span>
          {c.voiceNote ? ` · ${c.voiceNote}` : ""}
        </dd>
      </dl>

      <ul className="flex flex-wrap gap-1.5 text-[11px]">
        {checks.map((ch) => (
          <li
            key={ch.label}
            title={ch.detail}
            className={`rounded px-1.5 py-0.5 border ${ch.ok ? "border-line text-muted" : "border-warn/40 text-warn"}`}
          >
            {ch.ok ? "✓" : "!"} {ch.label}
            {ch.detail ? `: ${ch.detail}` : ""}
          </li>
        ))}
        {repeat && (
          <li className="rounded px-1.5 py-0.5 border border-warn/40 text-warn" title={repeat.text}>
            ! Similar to something you&apos;ve posted
          </li>
        )}
      </ul>

      {c.rationale && <p className="text-xs text-muted italic">{c.rationale}</p>}
      {error && <p className="text-xs text-bad">{error}</p>}

      {never ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            update((s) => addFeedback(s, "never", full, { note: neverNote.trim() || undefined }));
            onDismiss(c);
          }}
        >
          <input
            className="input"
            autoFocus
            placeholder="What's wrong with it? e.g. “too salesy”, “never use ‘here’s the thing’” (optional)"
            value={neverNote}
            onChange={(e) => setNeverNote(e.target.value)}
            aria-label="Why never like this"
          />
          <button className="btn btn-primary btn-sm" type="submit">
            Never like this
          </button>
          <button className="btn btn-sm" type="button" onClick={() => setNever(false)}>
            Cancel
          </button>
        </form>
      ) : (
        <footer className="flex flex-wrap gap-1.5">
          <button
            className="btn btn-sm"
            type="button"
            onClick={() => {
              update((s) => addFeedback(s, "more", full));
              onMoreLike(c);
            }}
          >
            More like this
          </button>
          <button className="btn btn-sm" type="button" onClick={() => setNever(true)}>
            Never like this
          </button>
          <button className="btn btn-sm" type="button" onClick={() => onPush(c)}>
            Push further
          </button>
          <button
            className="btn btn-sm"
            type="button"
            onClick={() => {
              if (editing) return saveEdit();
              setDraft(isThread ? full : c.text);
              setEditing(true);
            }}
          >
            {editing && isThread ? "Done editing" : "Edit"}
          </button>
          <button className={`btn btn-sm ${over ? "!border-bad !text-bad" : ""}`} type="button" disabled={!!busy} onClick={() => refine("fit")}>
            {busy === "fit" ? "Fitting…" : "Fit to X"}
          </button>
          <button className="btn btn-sm" type="button" disabled={!!busy} onClick={() => refine("shorten")}>
            {busy === "shorten" ? "Shortening…" : "Shorten"}
          </button>
          <button className="btn btn-sm" type="button" disabled={!!busy} onClick={() => refine("deai")}>
            {busy === "deai" ? "Cleaning…" : "De-AI this"}
          </button>
          <span className="ml-auto flex gap-1.5">
            <button
              className="btn btn-sm btn-ghost"
              type="button"
              onClick={() => update((s) => ({ ...s, saved: [{ ...c, id: uid("s") }, ...s.saved].slice(0, 200) }))}
            >
              Save
            </button>
            <button
              className="btn btn-sm btn-ghost"
              type="button"
              title="Adds it to your history so future drafts learn from it and avoid repeating it"
              onClick={() =>
                update((s) => {
                  const next = addFeedback(s, "posted", full);
                  return { ...next, posted: [{ id: uid("p"), text: full, at: Date.now() }, ...next.posted].slice(0, 500) };
                })
              }
            >
              I posted this
            </button>
          </span>
        </footer>
      )}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!custom.trim()) return;
          refine("custom", undefined, custom.trim()).then(() => setCustom(""));
        }}
      >
        <input
          className="input text-xs"
          placeholder="Ask for a change… e.g. “make the ending less neat”"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          aria-label="Custom revision"
        />
        <button className="btn btn-sm" type="submit" disabled={!!busy || !custom.trim()}>
          {busy === "custom" ? "…" : "Revise"}
        </button>
      </form>
    </article>
  );
}
