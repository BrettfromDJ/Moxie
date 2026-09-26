"use client";

import { FileText, Image as ImageIcon, Link as LinkIcon, LoaderCircle, CircleAlert, X } from "lucide-react";
import { useState } from "react";
import { activeSession, api, patchActive, uid, useStore } from "@/lib/store";
import type { PostType, RefKind, RefRole, Reference } from "@/lib/types";
import { Popover } from "./Popover";

const ROLE_LABEL: Record<RefRole, { title: string; hint: string }> = {
  target: { title: "Responding to this", hint: "The post you're replying to, quoting, or remixing" },
  facts: { title: "Use its facts", hint: "Pull information from it" },
  style: { title: "Style example only", hint: "Emulate a quality, never its content" },
  context: { title: "Background", hint: "Context for the writer" },
};

interface Extracted {
  kind: "x-post" | "article" | "page";
  url: string;
  author?: string;
  title?: string;
  text: string;
  excerpt: string;
  parent?: { url: string; author?: string; text: string };
}

function nextTag(refs: Reference[], base: string): string {
  const used = new Set(refs.map((r) => r.tag.toLowerCase()));
  for (let i = 1; ; i++) if (!used.has(`${base}${i}`)) return `${base}${i}`;
}

function defaultRole(kind: RefKind, refs: Reference[], postType: PostType): RefRole {
  const hasTarget = refs.some((r) => r.role === "target");
  if ((kind === "x-post" || kind === "text") && !hasTarget && ["quote", "reply", "remix"].includes(postType)) return "target";
  if (kind === "article" || kind === "page") return "facts";
  return "context";
}

// Actions for adding references to the active conversation.
export function useReferenceActions() {
  const { state, update } = useStore();

  const patch = (id: string, p: Partial<Reference>) =>
    update((s) => patchActive(s, (x) => ({ ...x, references: x.references.map((r) => (r.id === id ? { ...r, ...p } : r)) })));

  const add = (ref: Reference) => update((s) => patchActive(s, (x) => ({ ...x, references: [...x.references, ref] })));

  function addUrl(url: string): string {
    const session = activeSession(state);
    const tag = nextTag(session.references, "link");
    const id = uid("ref");
    add({ id, tag, kind: "page", role: "context", status: "loading", url });
    api<Extracted>("/api/references/fetch", { url })
      .then((x) =>
        update((s) =>
          patchActive(s, (sess) => {
            const others = sess.references.filter((r) => r.id !== id);
            const role = defaultRole(x.kind, others, sess.settings.postType);
            let references = sess.references.map((r) =>
              r.id === id
                ? { ...r, status: "ready" as const, kind: x.kind, role, url: x.url, author: x.author, title: x.title, text: x.text, excerpt: x.excerpt }
                : r,
            );
            // Keep a known parent-post relationship explicit: add the parent as its own reference.
            if (x.parent && !references.some((r) => r.url === x.parent!.url)) {
              const ptag = nextTag(references, "parent");
              references = [
                ...references.map((r) => (r.id === id ? { ...r, parentTag: ptag } : r)),
                { id: uid("ref"), tag: ptag, kind: "x-post" as const, role: "context" as const, status: "ready" as const, url: x.parent.url, author: x.parent.author, text: x.parent.text, excerpt: x.parent.text.slice(0, 220) },
              ];
            }
            return { ...sess, references };
          }),
        ),
      )
      .catch((e: Error) => patch(id, { status: "failed", error: e.message }));
    return tag;
  }

  function addText(text: string, role?: RefRole): string {
    const session = activeSession(state);
    const tag = nextTag(session.references, "text");
    add({
      id: uid("ref"),
      tag,
      kind: "text",
      role: role ?? defaultRole("text", session.references, session.settings.postType),
      status: "ready",
      text,
      excerpt: text.slice(0, 220),
    });
    return tag;
  }

  async function addImage(file: File): Promise<string | null> {
    if (!/^image\/(png|jpeg|gif|webp)$/.test(file.type)) {
      alert("Use a PNG, JPEG, GIF, or WebP image.");
      return null;
    }
    const dataUrl = await downscale(file);
    const tag = nextTag(activeSession(state).references, "image");
    add({
      id: uid("ref"),
      tag,
      kind: "image",
      role: "context",
      status: "ready",
      title: file.name,
      image: { dataUrl, mediaType: dataUrl.slice(5, dataUrl.indexOf(";")) },
    });
    return tag;
  }

  return { addUrl, addText, addImage, patch };
}

// Keeps images small enough for localStorage and the request body.
async function downscale(file: File, max = 1400): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

const KIND_ICON: Record<RefKind, React.ReactNode> = {
  "x-post": <span className="font-bold text-[11px] leading-none">𝕏</span>,
  article: <FileText size={13} />,
  page: <LinkIcon size={13} />,
  text: <FileText size={13} />,
  image: <ImageIcon size={13} />,
};

// A compact chip for one reference. Clicking opens its details: rename, role,
// "replies to", paste-text fallback, and remove.
export function RefChip({ reference: r }: { reference: Reference }) {
  const { state, update } = useStore();
  const { patch } = useReferenceActions();
  const refs = activeSession(state).references;
  const [paste, setPaste] = useState("");

  function rename(raw: string) {
    const tag = raw.replace(/^@/, "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 24);
    if (!tag || tag === r.tag) return;
    if (refs.some((x) => x.id !== r.id && x.tag.toLowerCase() === tag.toLowerCase())) {
      alert(`@${tag} is already used.`);
      return;
    }
    // Renaming updates every place the tag is used, so references never go stale.
    const re = new RegExp(`@${r.tag}(?![A-Za-z0-9_-])`, "g");
    update((s) =>
      patchActive(s, (x) => ({
        ...x,
        draft: x.draft.replace(re, `@${tag}`),
        references: x.references.map((y) => (y.id === r.id ? { ...y, tag } : y.parentTag === r.tag ? { ...y, parentTag: tag } : y)),
      })),
    );
  }

  function remove() {
    update((s) =>
      patchActive(s, (x) => ({
        ...x,
        references: x.references.filter((y) => y.id !== r.id).map((y) => (y.parentTag === r.tag ? { ...y, parentTag: undefined } : y)),
      })),
    );
  }

  const subtitle = r.status === "loading" ? "Reading…" : r.status === "failed" ? "Couldn't read" : (r.author ?? r.title ?? r.excerpt ?? "");

  return (
    <Popover
      label={`Reference @${r.tag}`}
      side="top"
      panelClassName="w-80 p-3 space-y-3"
      trigger={() => (
        <span
          className={`inline-flex items-center gap-1.5 max-w-[16rem] rounded-xl border px-2.5 py-1.5 text-xs cursor-pointer hover:bg-panel-2 ${
            r.status === "failed" ? "border-warn/50" : "border-line"
          } ${r.role === "target" ? "bg-accent-soft/60" : "bg-panel"}`}
          data-testid="ref-chip"
        >
          <span className="text-muted">
            {r.status === "loading" ? <LoaderCircle size={13} className="animate-spin" /> : r.status === "failed" ? <CircleAlert size={13} className="text-warn" /> : KIND_ICON[r.kind]}
          </span>
          <span className="font-medium text-chip-fg">@{r.tag}</span>
          {subtitle && <span className="text-muted truncate">{subtitle}</span>}
        </span>
      )}
    >
      {(close) => (
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted">@</span>
            <input
              aria-label="Reference tag"
              className="input !py-1 font-medium"
              defaultValue={r.tag}
              key={r.tag}
              onBlur={(e) => rename(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            />
            <button type="button" className="btn btn-ghost btn-sm" onClick={close} aria-label="Close">
              <X size={14} />
            </button>
          </div>

          {r.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.image.dataUrl} alt={r.title ?? "Reference image"} className="rounded-lg max-h-36 border border-line" />
          )}
          {r.status === "ready" && r.text && (
            <p className="text-muted text-xs max-h-28 overflow-y-auto whitespace-pre-line">{r.text.slice(0, 600)}</p>
          )}
          {r.url && (
            <a href={r.url} target="_blank" rel="noreferrer" className="text-xs text-accent truncate block">
              {r.url}
            </a>
          )}
          {r.status === "failed" && (
            <div className="space-y-2">
              <p className="text-xs text-warn">{r.error}</p>
              <textarea
                className="input text-sm"
                rows={3}
                placeholder="Paste its text here instead…"
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                aria-label={`Paste text for @${r.tag}`}
              />
              <button
                type="button"
                className="btn btn-sm"
                disabled={!paste.trim()}
                onClick={() => patch(r.id, { status: "ready", text: paste.trim(), excerpt: paste.trim().slice(0, 220), error: undefined, kind: "text" })}
              >
                Use this text
              </button>
            </div>
          )}

          <div className="space-y-1">
            <span className="label">How to use it</span>
            {(Object.keys(ROLE_LABEL) as RefRole[]).map((k) => (
              <label key={k} className="flex items-start gap-2 cursor-pointer rounded-lg px-2 py-1 hover:bg-panel-2">
                <input type="radio" name={`role-${r.id}`} checked={r.role === k} onChange={() => patch(r.id, { role: k })} className="mt-1 accent-[var(--accent)]" />
                <span>
                  <span className="block text-sm">{ROLE_LABEL[k].title}</span>
                  <span className="block text-xs text-muted">{ROLE_LABEL[k].hint}</span>
                </span>
              </label>
            ))}
          </div>

          {(r.kind === "x-post" || r.kind === "text") && refs.length > 1 && (
            <select
              aria-label={`@${r.tag} replies to`}
              className="input text-xs"
              value={r.parentTag ?? ""}
              onChange={(e) => patch(r.id, { parentTag: e.target.value || undefined })}
            >
              <option value="">Not a reply to another source</option>
              {refs
                .filter((x) => x.id !== r.id)
                .map((x) => (
                  <option key={x.id} value={x.tag}>
                    Replies to @{x.tag}
                  </option>
                ))}
            </select>
          )}

          <button type="button" className="btn btn-sm !text-bad w-full justify-center" onClick={remove}>
            Remove @{r.tag}
          </button>
        </div>
      )}
    </Popover>
  );
}
