"use client";

import { useMemo, useRef, useState } from "react";
import type { Reference } from "@/lib/types";

// A textarea where @tags that match a reference render as chips (via a
// highlighted backdrop), typing "@" opens autocomplete, and pasting a lone URL
// turns it into a reference.

const TAG_RE = /@([A-Za-z0-9_-]+)/g;

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function TagTextarea({
  value,
  onChange,
  references,
  placeholder,
  rows = 5,
  onPasteUrl,
  ariaLabel,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  references: Reference[];
  placeholder?: string;
  rows?: number;
  onPasteUrl?: (url: string) => string | null; // returns the new tag to insert
  ariaLabel: string;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState<{ start: number; text: string } | null>(null);
  const [active, setActive] = useState(0);

  const tags = useMemo(() => new Set(references.map((r) => r.tag.toLowerCase())), [references]);

  const html = useMemo(() => {
    const escaped = escapeHtml(value).replace(TAG_RE, (m, t: string) =>
      tags.has(t.toLowerCase()) ? `<mark>${m}</mark>` : `<mark class="unknown">${m}</mark>`,
    );
    // A trailing newline needs a character after it to take up space.
    return escaped + "\n ";
  }, [value, tags]);

  const matches = useMemo(() => {
    if (!query) return [];
    const q = query.text.toLowerCase();
    return references.filter((r) => r.tag.toLowerCase().startsWith(q) || (r.title ?? r.author ?? "").toLowerCase().includes(q)).slice(0, 6);
  }, [query, references]);

  function detect(el: HTMLTextAreaElement) {
    const upto = el.value.slice(0, el.selectionStart);
    const m = upto.match(/(^|\s)@([A-Za-z0-9_-]*)$/);
    if (m && references.length) {
      setQuery({ start: upto.length - m[2].length - 1, text: m[2] });
      setActive(0);
    } else {
      setQuery(null);
    }
  }

  function insertTag(tag: string) {
    const el = ref.current;
    if (!el || !query) return;
    const before = value.slice(0, query.start);
    const after = value.slice(el.selectionStart);
    const insert = `@${tag}${after.startsWith(" ") ? "" : " "}`;
    onChange(before + insert + after);
    setQuery(null);
    requestAnimationFrame(() => {
      el.focus();
      const pos = before.length + insert.length;
      el.setSelectionRange(pos, pos);
    });
  }

  return (
    <div className="relative">
      <div className="relative rounded-xl border border-line bg-panel focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--accent-soft)]">
        <div
          ref={backdrop}
          aria-hidden
          className="composer-layer composer-backdrop absolute inset-0 overflow-hidden text-transparent pointer-events-none"
          dangerouslySetInnerHTML={{ __html: html }}
        />
        <textarea
          ref={ref}
          aria-label={ariaLabel}
          autoFocus={autoFocus}
          rows={rows}
          value={value}
          placeholder={placeholder}
          spellCheck
          className="composer-layer relative block w-full resize-y bg-transparent outline-none placeholder:text-muted caret-fg min-h-[6rem]"
          onChange={(e) => {
            onChange(e.target.value);
            detect(e.target);
          }}
          onClick={(e) => detect(e.currentTarget)}
          onBlur={() => setTimeout(() => setQuery(null), 150)}
          onScroll={(e) => {
            if (backdrop.current) backdrop.current.scrollTop = e.currentTarget.scrollTop;
          }}
          onKeyDown={(e) => {
            if (!query || !matches.length) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => (a + 1) % matches.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => (a - 1 + matches.length) % matches.length);
            } else if (e.key === "Enter" || e.key === "Tab") {
              e.preventDefault();
              insertTag(matches[active].tag);
            } else if (e.key === "Escape") {
              setQuery(null);
            }
          }}
          onPaste={(e) => {
            if (!onPasteUrl) return;
            const text = e.clipboardData.getData("text").trim();
            if (!/^https?:\/\/\S+$/.test(text)) return;
            const tag = onPasteUrl(text);
            if (!tag) return;
            e.preventDefault();
            const el = e.currentTarget;
            const before = value.slice(0, el.selectionStart);
            const after = value.slice(el.selectionEnd);
            const insert = `${before && !/\s$/.test(before) ? " " : ""}@${tag} `;
            onChange(before + insert + after);
          }}
        />
      </div>
      {query && matches.length > 0 && (
        <ul role="listbox" className="absolute z-20 mt-1 w-full max-w-sm card shadow-lg py-1 text-sm">
          {matches.map((r, i) => (
            <li
              key={r.id}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                insertTag(r.tag);
              }}
              className={`px-3 py-1.5 cursor-pointer flex gap-2 items-baseline ${i === active ? "bg-accent-soft" : ""}`}
            >
              <span className="font-medium text-chip-fg">@{r.tag}</span>
              <span className="text-muted truncate">{r.title ?? r.author ?? r.excerpt ?? r.kind}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function unknownTags(text: string, references: Reference[]): string[] {
  const tags = new Set(references.map((r) => r.tag.toLowerCase()));
  const out = new Set<string>();
  for (const m of text.matchAll(TAG_RE)) if (!tags.has(m[1].toLowerCase())) out.add(m[1]);
  return [...out];
}
