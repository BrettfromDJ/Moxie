"use client";

import {
  ArrowDown,
  ArrowUp,
  Bookmark,
  Check,
  Copy,
  Ellipsis,
  Pencil,
  Plus,
  Scissors,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  WandSparkles,
  Zap,
  AlignJustify,
  Minimize2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { checkVoiceRules } from "@/lib/checks";
import { mostSimilar } from "@/lib/retrieval";
import { activeProfile, activeSession, addFeedback, api, buildContext, candidateText, uid, useStore } from "@/lib/store";
import type { Candidate, CardRole, RefineAction, ThreadCard } from "@/lib/types";
import { formatReadingTime, readingSeconds, xLength } from "@/lib/xcount";
import { MenuItem, Popover } from "./Popover";
import { DeviceToggle, Tweet, TweetFrame } from "./TweetPreview";

const ROLES: CardRole[] = ["hook", "setup", "insight", "example", "takeaway", "close", "other"];

function Count({ text, limit }: { text: string; limit: number }) {
  const n = xLength(text);
  return <span className={`tabular-nums ${n > limit ? "text-bad font-medium" : ""}`}>{n}/{limit}</span>;
}

function IconButton({
  label,
  onClick,
  children,
  active,
  disabled,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`h-8 w-8 grid place-items-center rounded-lg text-muted hover:bg-panel-3 hover:text-fg disabled:opacity-40 ${active ? "text-fg" : ""}`}
    >
      {children}
    </button>
  );
}

export function CandidateCard({
  candidate,
  index,
  source,
  onChange,
  onMoreLike,
  onPush,
  onDismiss,
}: {
  candidate: Candidate;
  index: number;
  source: string;
  onChange: (c: Candidate) => void;
  onMoreLike: (c: Candidate) => void;
  onPush: (c: Candidate) => void;
  onDismiss: (c: Candidate) => void;
}) {
  const { state, update } = useStore();
  const c = candidate;
  const session = activeSession(state);
  const limit = session.settings.charLimit;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [never, setNever] = useState(false);
  const [neverNote, setNeverNote] = useState("");
  const [custom, setCustom] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const full = candidateText(c);
  const isThread = c.thread.length > 0;
  const over = isThread ? c.thread.some((t) => xLength(t.text) > limit) : xLength(c.text) > limit;
  const voice = activeProfile(state);

  const problems = useMemo(() => checkVoiceRules(full, voice, state.feedback).filter((x) => !x.ok), [full, voice, state.feedback]);
  const repeat = useMemo(() => {
    const prior = [...state.posted.map((p) => p.text), ...(voice?.samples ?? []).map((s) => s.text)];
    const m = mostSimilar(full, prior);
    return m && m.score >= 0.3 ? m : null;
  }, [full, state.posted, voice]);

  function toast(msg: string) {
    setFlash(msg);
    setTimeout(() => setFlash(null), 1400);
  }

  async function refine(action: RefineAction, cardId?: string, instruction?: string) {
    setBusy(action);
    setError(null);
    try {
      const res = await api<{ candidate: Candidate; stillOver: boolean }>("/api/refine", {
        ...buildContext(state, session, source),
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

  function startEdit() {
    setDraft(isThread ? full : c.text);
    setEditing(true);
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

  const setCards = (thread: ThreadCard[]) => onChange({ ...c, thread });

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
    toast("Copied");
  }

  return (
    <article className={`group rounded-2xl border border-line bg-panel p-4 sm:p-5 transition-opacity ${busy ? "opacity-60" : ""}`} data-testid="candidate">
      <header className="flex items-center gap-2 text-xs text-muted mb-3">
        <span className="h-5 min-w-5 px-1 rounded-md bg-panel-3 text-fg font-semibold grid place-items-center tabular-nums">{index}</span>
        <span className="font-medium text-fg">{c.angle}</span>
        <span className="truncate hidden sm:inline">· {c.structure}</span>
        <span className="ml-auto">
          <DeviceToggle />
        </span>
      </header>

      {!editing && (
        <TweetFrame>
          {isThread ? (
            c.thread.map((t, i) => (
              <Tweet
                key={t.id}
                text={t.text}
                limit={limit}
                connectAbove={i > 0}
                connectBelow={i < c.thread.length - 1}
                trailing={
                  <span className="flex items-center gap-0.5 text-[#71767b]">
                    <span className="text-[11px] uppercase tracking-wide px-1.5">{t.role}</span>
                    <span className="flex">
                      <IconButton label={`Move post ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                        <ArrowUp size={14} />
                      </IconButton>
                      <IconButton label={`Move post ${i + 1} down`} disabled={i === c.thread.length - 1} onClick={() => move(i, 1)}>
                        <ArrowDown size={14} />
                      </IconButton>
                      <IconButton label={`Shorten post ${i + 1}`} disabled={!!busy} onClick={() => refine("shorten-card", t.id)}>
                        <Scissors size={14} />
                      </IconButton>
                      <IconButton label={`Delete post ${i + 1}`} disabled={c.thread.length <= 1} onClick={() => setCards(c.thread.filter((x) => x.id !== t.id))}>
                        <Trash2 size={14} />
                      </IconButton>
                    </span>
                  </span>
                }
              />
            ))
          ) : (
            <Tweet text={c.text} limit={limit} />
          )}
        </TweetFrame>
      )}

      {editing && !isThread && (
        <textarea
          className="input text-[15px] leading-relaxed"
          rows={Math.max(3, draft.split("\n").length + 1)}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoFocus
          aria-label="Edit post"
        />
      )}

      {editing && isThread && (
        <ol className="relative space-y-3 before:absolute before:left-[11px] before:top-3 before:bottom-3 before:w-px before:bg-line">
          {c.thread.map((t, i) => (
            <li key={t.id} className="relative pl-8 group/card">
              <span className="absolute left-0 top-0.5 h-6 w-6 rounded-full bg-panel border border-line text-[11px] grid place-items-center text-muted tabular-nums">
                {i + 1}
              </span>
              <div className="flex items-center gap-2 text-[11px] text-muted mb-0.5">
                <select
                  aria-label={`Role of post ${i + 1}`}
                  className="bg-transparent uppercase tracking-wide font-medium outline-none cursor-pointer"
                  value={t.role}
                  onChange={(e) => setCards(c.thread.map((x) => (x.id === t.id ? { ...x, role: e.target.value as CardRole } : x)))}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <Count text={t.text} limit={limit} />
                <span className="ml-auto flex opacity-100 sm:opacity-0 group-hover/card:opacity-100 focus-within:opacity-100 transition-opacity">
                  <IconButton label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp size={14} />
                  </IconButton>
                  <IconButton label="Move down" disabled={i === c.thread.length - 1} onClick={() => move(i, 1)}>
                    <ArrowDown size={14} />
                  </IconButton>
                  <IconButton label={`Shorten post ${i + 1}`} disabled={!!busy} onClick={() => refine("shorten-card", t.id)}>
                    <Scissors size={14} />
                  </IconButton>
                  <IconButton label={`Delete post ${i + 1}`} disabled={c.thread.length <= 1} onClick={() => setCards(c.thread.filter((x) => x.id !== t.id))}>
                    <Trash2 size={14} />
                  </IconButton>
                </span>
              </div>
              {editing ? (
                <textarea
                  className="input text-[15px]"
                  rows={Math.max(2, t.text.split("\n").length + 1)}
                  value={t.text}
                  onChange={(e) => setCards(c.thread.map((x) => (x.id === t.id ? { ...x, text: e.target.value } : x)))}
                  aria-label={`Edit post ${i + 1}`}
                />
              ) : (
                <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{t.text}</p>
              )}
            </li>
          ))}
        </ol>
      )}

      {editing && (
        <div className="flex gap-2 mt-3">
          <button className="btn btn-primary btn-sm" onClick={saveEdit} type="button">
            {isThread ? "Done editing" : "Save edit"}
          </button>
          {!isThread && (
            <>
              <button className="btn btn-sm" type="button" onClick={() => setEditing(false)}>
                Cancel
              </button>
              <span className="ml-auto text-xs text-muted self-center">
                <Count text={draft} limit={limit} />
              </span>
            </>
          )}
        </div>
      )}

      {/* One quiet line of facts; problems only appear when there are any. */}
      <div className="mt-4 pt-3 border-t border-line flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted">
        {isThread ? <span>{c.thread.length} posts</span> : <span className="tabular-nums"><Count text={c.text} limit={limit} /> chars</span>}
        <span>{formatReadingTime(readingSeconds(full))}</span>
        <span
          title="The model's own estimate, not a measured score"
          className={`tag ${c.voiceMatch === "strong" ? "tag-good" : c.voiceMatch === "partial" ? "tag-warn" : "tag-bad"}`}
        >
          {c.voiceMatch === "strong" ? "Sounds like you" : c.voiceMatch === "partial" ? "Partly your voice" : "Not your voice"} · est.
        </span>
        {over && <span className="tag tag-bad">Over X&apos;s limit</span>}
        {problems.map((p) => (
          <span key={p.label} className="tag tag-warn" title={p.detail}>
            {p.label}
            {p.detail ? `: ${p.detail}` : ""}
          </span>
        ))}
        {repeat && (
          <span className="tag tag-warn" title={repeat.text}>
            Similar to a past post
          </span>
        )}
      </div>
      {error && <p className="text-xs text-bad mt-2">{error}</p>}

      {never ? (
        <form
          className="flex gap-2 mt-3"
          onSubmit={(e) => {
            e.preventDefault();
            update((s) => addFeedback(s, "never", full, { note: neverNote.trim() || undefined }));
            onDismiss(c);
          }}
        >
          <input
            className="input text-sm"
            autoFocus
            placeholder="What's wrong with it? (optional) e.g. too salesy"
            value={neverNote}
            onChange={(e) => setNeverNote(e.target.value)}
            aria-label="Why never like this"
          />
          <button className="btn btn-primary btn-sm" type="submit">
            Hide it
          </button>
          <button className="btn btn-sm" type="button" onClick={() => setNever(false)}>
            Cancel
          </button>
        </form>
      ) : custom !== null ? (
        <form
          className="flex gap-2 mt-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!custom.trim()) return;
            refine("custom", undefined, custom.trim()).then(() => setCustom(null));
          }}
        >
          <input
            className="input text-sm"
            autoFocus
            placeholder="What should change? e.g. make the ending less neat"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            aria-label="Custom revision"
          />
          <button className="btn btn-primary btn-sm" type="submit" disabled={!!busy || !custom.trim()}>
            {busy === "custom" ? "…" : "Revise"}
          </button>
          <button className="btn btn-sm" type="button" onClick={() => setCustom(null)}>
            Cancel
          </button>
        </form>
      ) : (
        <footer className="mt-2 -ml-2 flex items-center gap-0.5 sm:opacity-60 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <IconButton label="Copy" onClick={copy}>
            {flash === "Copied" ? <Check size={16} /> : <Copy size={16} />}
          </IconButton>
          <IconButton label="Edit" onClick={editing ? saveEdit : startEdit} active={editing}>
            <Pencil size={16} />
          </IconButton>
          <IconButton
            label="More like this"
            onClick={() => {
              update((s) => addFeedback(s, "more", full));
              onMoreLike(c);
            }}
          >
            <ThumbsUp size={16} />
          </IconButton>
          <IconButton label="Never like this" onClick={() => setNever(true)}>
            <ThumbsDown size={16} />
          </IconButton>
          <IconButton label="Push further" onClick={() => onPush(c)}>
            <Zap size={16} />
          </IconButton>
          <button
            type="button"
            onClick={() => refine("fit")}
            disabled={!!busy}
            className={`h-8 px-2.5 rounded-lg text-xs font-medium hover:bg-panel-2 ${over ? "text-bad" : "text-muted hover:text-fg"}`}
          >
            {busy === "fit" ? "Fitting…" : "Fit to X"}
          </button>
          <Popover
            label="More actions"
            side="top"
            panelClassName="w-64 p-1.5"
            trigger={() => (
              <span className="h-8 w-8 grid place-items-center rounded-lg text-muted hover:bg-panel-2 hover:text-fg">
                <Ellipsis size={16} />
              </span>
            )}
          >
            {(close) => (
              <div role="menu">
                <MenuItem icon={<Sparkles size={16} />} title="Ask for a change…" onClick={() => { close(); setCustom(""); }} />
                <MenuItem icon={<Minimize2 size={16} />} title="Shorten" disabled={!!busy} onClick={() => { close(); refine("shorten"); }} />
                <MenuItem icon={<WandSparkles size={16} />} title="De-AI this" hint="Strip generic, machine-sounding bits" disabled={!!busy} onClick={() => { close(); refine("deai"); }} />
                {isThread && (
                  <>
                    <MenuItem icon={<Zap size={16} />} title="Strengthen opening" disabled={!!busy} onClick={() => { close(); refine("strengthen-hook"); }} />
                    <MenuItem icon={<AlignJustify size={16} />} title="Better pacing" disabled={!!busy} onClick={() => { close(); refine("pacing"); }} />
                    <MenuItem
                      icon={<Plus size={16} />}
                      title="Add a post"
                      onClick={() => {
                        close();
                        if (!editing) setDraft(full);
                        setCards([...c.thread, { id: uid("t"), role: "other", text: "" }]);
                        setEditing(true);
                      }}
                    />
                  </>
                )}
                {!isThread && (
                  <MenuItem icon={<Zap size={16} />} title="Strengthen the hook" disabled={!!busy} onClick={() => { close(); refine("strengthen-hook"); }} />
                )}
                <div className="my-1 border-t border-line" />
                <MenuItem
                  icon={<Bookmark size={16} />}
                  title="Save to library"
                  onClick={() => {
                    close();
                    update((s) => ({ ...s, saved: [{ ...c, id: uid("s") }, ...s.saved].slice(0, 200) }));
                    toast("Saved");
                  }}
                />
                <MenuItem
                  icon={<Send size={16} />}
                  title="I posted this"
                  hint="Future drafts learn from it and avoid repeating it"
                  onClick={() => {
                    close();
                    update((s) => {
                      const next = addFeedback(s, "posted", full);
                      return { ...next, posted: [{ id: uid("p"), text: full, at: Date.now() }, ...next.posted].slice(0, 500) };
                    });
                    toast("Marked as posted");
                  }}
                />
              </div>
            )}
          </Popover>
          {busy && busy !== "fit" && <span className="text-xs text-muted ml-1 animate-pulse">Working…</span>}
          {flash && flash !== "Copied" && <span className="text-xs text-good ml-1">{flash}</span>}
        </footer>
      )}
    </article>
  );
}
