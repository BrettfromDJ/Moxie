"use client";

import { useState } from "react";
import { api, uid, useStore } from "@/lib/store";
import type { PostType, RefKind, RefRole, Reference } from "@/lib/types";

const ROLE_LABEL: Record<RefRole, string> = {
  target: "Target (responding to)",
  facts: "Facts (use its info)",
  style: "Style example only",
  context: "Background context",
};

const KIND_LABEL: Record<RefKind, string> = {
  "x-post": "Post on X",
  article: "Article",
  page: "Web page",
  text: "Pasted text",
  image: "Image",
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
  if (kind === "x-post" && !hasTarget && ["quote", "reply", "remix"].includes(postType)) return "target";
  if (kind === "article" || kind === "page") return "facts";
  return "context";
}

// Shared actions for creating references, used by the composer and the panel.
export function useReferenceActions() {
  const { state, update } = useStore();

  const patch = (id: string, p: Partial<Reference>) =>
    update((s) => ({
      ...s,
      composer: {
        ...s.composer,
        references: s.composer.references.map((r) => (r.id === id ? { ...r, ...p } : r)),
      },
    }));

  function addUrl(url: string): string {
    const refs = state.composer.references;
    const tag = nextTag(refs, "link");
    const id = uid("ref");
    const ref: Reference = { id, tag, kind: "page", role: "context", status: "loading", url };
    update((s) => ({ ...s, composer: { ...s.composer, references: [...s.composer.references, ref] } }));
    api<Extracted>("/api/references/fetch", { url })
      .then((x) =>
        update((s) => {
          const others = s.composer.references.filter((r) => r.id !== id);
          const role = defaultRole(x.kind, others, s.composer.settings.postType);
          let references = s.composer.references.map((r) =>
            r.id === id
              ? { ...r, status: "ready" as const, kind: x.kind, role, url: x.url, author: x.author, title: x.title, text: x.text, excerpt: x.excerpt }
              : r,
          );
          // Keep a known parent-post relationship explicit: add the parent as its own reference.
          if (x.parent && !references.some((r) => r.url === x.parent!.url)) {
            const ptag = nextTag(references, "parent");
            references = [
              ...references,
              { id: uid("ref"), tag: ptag, kind: "x-post", role: "context", status: "ready", url: x.parent.url, author: x.parent.author, text: x.parent.text, excerpt: x.parent.text.slice(0, 220) },
            ];
            references = references.map((r) => (r.id === id ? { ...r, parentTag: ptag } : r));
          }
          return { ...s, composer: { ...s.composer, references } };
        }),
      )
      .catch((e: Error) => patch(id, { status: "failed", error: e.message }));
    return tag;
  }

  function addText(text = "", author?: string): string {
    const refs = state.composer.references;
    const tag = nextTag(refs, "text");
    const ref: Reference = {
      id: uid("ref"),
      tag,
      kind: "text",
      role: defaultRole("x-post", refs, state.composer.settings.postType) === "target" ? "target" : "context",
      status: text ? "ready" : "failed",
      text,
      author,
      excerpt: text.slice(0, 220),
      error: text ? undefined : "Paste the text below.",
    };
    update((s) => ({ ...s, composer: { ...s.composer, references: [...s.composer.references, ref] } }));
    return tag;
  }

  async function addImage(file: File): Promise<string | null> {
    if (!/^image\/(png|jpeg|gif|webp)$/.test(file.type)) {
      alert("Use a PNG, JPEG, GIF, or WebP image.");
      return null;
    }
    const dataUrl = await downscale(file);
    const refs = state.composer.references;
    const tag = nextTag(refs, "image");
    const ref: Reference = {
      id: uid("ref"),
      tag,
      kind: "image",
      role: "context",
      status: "ready",
      title: file.name,
      image: { dataUrl, mediaType: dataUrl.slice(5, dataUrl.indexOf(";")) },
    };
    update((s) => ({ ...s, composer: { ...s.composer, references: [...s.composer.references, ref] } }));
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

export function ReferencesPanel({ onInsertTag }: { onInsertTag: (tag: string) => void }) {
  const { state, update } = useStore();
  const { addUrl, addText, addImage, patch } = useReferenceActions();
  const [url, setUrl] = useState("");
  const refs = state.composer.references;

  function rename(r: Reference, raw: string) {
    const tag = raw.replace(/^@/, "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 24);
    if (!tag || tag === r.tag) return;
    if (refs.some((x) => x.id !== r.id && x.tag.toLowerCase() === tag.toLowerCase())) {
      alert(`@${tag} is already used.`);
      return;
    }
    // Renaming a tag updates every place it is used, so references never go stale.
    const re = new RegExp(`@${r.tag}(?![A-Za-z0-9_-])`, "g");
    update((s) => ({
      ...s,
      composer: {
        ...s.composer,
        thought: s.composer.thought.replace(re, `@${tag}`),
        take: s.composer.take.replace(re, `@${tag}`),
        references: s.composer.references.map((x) =>
          x.id === r.id ? { ...x, tag } : x.parentTag === r.tag ? { ...x, parentTag: tag } : x,
        ),
      },
    }));
  }

  function remove(r: Reference) {
    update((s) => ({
      ...s,
      composer: {
        ...s.composer,
        references: s.composer.references
          .filter((x) => x.id !== r.id)
          .map((x) => (x.parentTag === r.tag ? { ...x, parentTag: undefined } : x)),
      },
    }));
  }

  return (
    <section aria-label="References" className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="label !mb-0">References</span>
        <span className="text-xs text-muted">Type @ in your thought to point at one</span>
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const u = url.trim();
          if (!/^https?:\/\//.test(u)) return;
          onInsertTag(addUrl(u));
          setUrl("");
        }}
      >
        <input
          className="input"
          placeholder="Paste a link (post on X, article, page)…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          aria-label="Reference URL"
        />
        <button className="btn" type="submit" disabled={!/^https?:\/\//.test(url.trim())}>
          Add
        </button>
      </form>
      <div className="flex gap-2 flex-wrap">
        <button className="btn btn-sm" type="button" onClick={() => onInsertTag(addText())}>
          + Paste text
        </button>
        <label className="btn btn-sm cursor-pointer">
          + Image / screenshot
          <input
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) {
                const tag = await addImage(f);
                if (tag) onInsertTag(tag);
              }
            }}
          />
        </label>
      </div>

      {refs.map((r) => (
        <article key={r.id} className="card p-3 space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-chip-fg bg-chip rounded px-1.5 font-medium">@</span>
            <input
              aria-label="Reference tag"
              className="font-medium bg-transparent outline-none border-b border-transparent focus:border-accent w-28"
              defaultValue={r.tag}
              key={r.tag}
              onBlur={(e) => rename(r, e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            />
            <span className="text-xs text-muted">{KIND_LABEL[r.kind]}</span>
            <button className="ml-auto btn btn-ghost btn-sm" type="button" onClick={() => remove(r)} aria-label={`Remove @${r.tag}`}>
              ✕
            </button>
          </div>

          {r.status === "loading" && <p className="text-muted animate-pulse">Reading {r.url}…</p>}

          {r.status === "ready" && (
            <div className="space-y-1">
              {r.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.image.dataUrl} alt={r.title ?? "Reference image"} className="rounded-md max-h-40 border border-line" />
              )}
              {(r.author || r.title) && (
                <p className="font-medium leading-snug">
                  {r.title}
                  {r.title && r.author ? " · " : ""}
                  <span className="text-muted font-normal">{r.author}</span>
                </p>
              )}
              {r.kind === "text" ? (
                <textarea
                  className="input text-sm"
                  rows={3}
                  value={r.text ?? ""}
                  onChange={(e) => patch(r.id, { text: e.target.value, excerpt: e.target.value.slice(0, 220) })}
                  aria-label={`Text for @${r.tag}`}
                />
              ) : (
                r.excerpt && <p className="text-muted line-clamp-3 whitespace-pre-line">{r.excerpt}</p>
              )}
              {r.url && (
                <a href={r.url} target="_blank" rel="noreferrer" className="text-xs text-accent truncate block">
                  {r.url}
                </a>
              )}
            </div>
          )}

          {r.status === "failed" && (
            <div className="space-y-1">
              {r.error && <p className="text-xs text-warn">{r.error}</p>}
              <textarea
                className="input text-sm"
                rows={3}
                placeholder="Paste the text of this source here…"
                aria-label={`Paste text for @${r.tag}`}
                onBlur={(e) => {
                  const text = e.target.value.trim();
                  if (text) patch(r.id, { status: "ready", text, excerpt: text.slice(0, 220), error: undefined, kind: r.kind === "page" ? "text" : r.kind });
                }}
              />
            </div>
          )}

          <div className="flex flex-wrap gap-2 items-center">
            <select
              aria-label={`Role of @${r.tag}`}
              className="input !w-auto !py-1 text-xs"
              value={r.role}
              onChange={(e) => patch(r.id, { role: e.target.value as RefRole })}
            >
              {(Object.keys(ROLE_LABEL) as RefRole[]).map((k) => (
                <option key={k} value={k}>
                  {ROLE_LABEL[k]}
                </option>
              ))}
            </select>
            {(r.kind === "x-post" || r.kind === "text") && refs.length > 1 && (
              <select
                aria-label={`@${r.tag} replies to`}
                className="input !w-auto !py-1 text-xs"
                value={r.parentTag ?? ""}
                onChange={(e) => patch(r.id, { parentTag: e.target.value || undefined })}
              >
                <option value="">Not a reply</option>
                {refs
                  .filter((x) => x.id !== r.id)
                  .map((x) => (
                    <option key={x.id} value={x.tag}>
                      Replies to @{x.tag}
                    </option>
                  ))}
              </select>
            )}
          </div>
        </article>
      ))}
    </section>
  );
}
