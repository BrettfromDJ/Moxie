"use client";

import { useState } from "react";

export function ListEditor({
  items,
  onChange,
  placeholder,
  tone = "default",
  ariaLabel,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
  tone?: "default" | "avoid";
  ariaLabel: string;
}) {
  const [draft, setDraft] = useState("");
  return (
    <div className="space-y-1.5">
      <ul className="space-y-1" aria-label={ariaLabel}>
        {items.map((item, i) => (
          <li key={`${i}-${item}`} className="flex items-center gap-2 group">
            <span className={tone === "avoid" ? "text-bad" : "text-good"}>{tone === "avoid" ? "✕" : "✓"}</span>
            <input
              className="flex-1 bg-transparent text-sm outline-none border-b border-transparent focus:border-accent py-0.5"
              defaultValue={item}
              aria-label={`Edit: ${item}`}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v === item) return;
                onChange(v ? items.map((x, j) => (j === i ? v : x)) : items.filter((_, j) => j !== i));
              }}
            />
            <button
              type="button"
              className="text-muted opacity-0 group-hover:opacity-100 focus:opacity-100 text-xs"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              aria-label={`Remove ${item}`}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const v = draft.trim();
          if (v && !items.includes(v)) onChange([...items, v]);
          setDraft("");
        }}
      >
        <input className="input text-sm" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} aria-label={`Add to ${ariaLabel}`} />
      </form>
    </div>
  );
}
