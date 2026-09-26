"use client";

import {
  Bookmark,
  Check,
  FileText,
  Fingerprint,
  Layers,
  PenLine,
  Shapes,
  Shuffle,
  Sparkles,
  SquarePen,
  Stethoscope,
  WandSparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { POST_TYPES } from "@/lib/options";
import { type SendMode, activeSession, patchActive, startSession, useStore } from "@/lib/store";
import { Logo } from "./Shell";

interface Item {
  id: string;
  group: string;
  title: string;
  hint?: string;
  icon: React.ReactNode;
  active?: boolean;
  run: () => void;
}

const MODE_ITEMS: { mode: SendMode; title: string; icon: React.ReactNode }[] = [
  { mode: "angles", title: "Find angles", icon: <Sparkles size={16} /> },
  { mode: "variations", title: "Write drafts", icon: <PenLine size={16} /> },
  { mode: "surprise", title: "Surprise me", icon: <Shuffle size={16} /> },
  { mode: "formats", title: "Explore formats", icon: <Layers size={16} /> },
  { mode: "critique", title: "Find the real thought", icon: <Stethoscope size={16} /> },
];

function ago(t: number): string {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

// Fey-style command menu (⌘K): grouped results above a separate search box.
export function CommandPalette({ initialQuery, onClose }: { initialQuery: string; onClose: () => void }) {
  const { state, update } = useStore();
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const session = activeSession(state);

  const go = (href: string) => {
    router.push(href);
    onClose();
  };

  const items: Item[] = useMemo(() => {
    const out: Item[] = [
      {
        id: "new",
        group: "Drafts",
        title: "New draft",
        icon: <SquarePen size={16} />,
        run: () => {
          update(startSession);
          go("/");
        },
      },
    ];
    [...state.sessions]
      .filter((s) => s.turns.length > 0)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 12)
      .forEach((s) =>
        out.push({
          id: `s:${s.id}`,
          group: "Drafts",
          title: s.title,
          hint: ago(s.updatedAt),
          icon: <FileText size={16} />,
          active: s.id === state.activeSessionId,
          run: () => {
            update((st) => ({ ...st, activeSessionId: s.id, sessions: st.sessions.filter((x) => x.turns.length > 0 || x.id === s.id) }));
            go("/");
          },
        }),
      );
    for (const p of POST_TYPES) {
      out.push({
        id: `pt:${p.value}`,
        group: "Write a…",
        title: p.label,
        hint: p.hint,
        icon: p.value === session.settings.postType ? <Check size={16} /> : <PenLine size={16} />,
        active: p.value === session.settings.postType,
        run: () => {
          update((st) => patchActive(st, (x) => ({ ...x, settings: { ...x.settings, postType: p.value } })));
          go("/");
        },
      });
    }
    for (const m of MODE_ITEMS) {
      out.push({
        id: `m:${m.mode}`,
        group: "When I hit send",
        title: m.title,
        icon: m.icon,
        active: state.sendMode === m.mode,
        run: () => {
          update((st) => ({ ...st, sendMode: m.mode }));
          go("/");
        },
      });
    }
    for (const p of state.profiles) {
      out.push({
        id: `v:${p.id}`,
        group: "Voice",
        title: `Write as ${p.name}`,
        hint: p.archetype,
        icon: <Fingerprint size={16} />,
        active: state.activeProfileId === p.id,
        run: () => {
          update((st) => ({ ...st, activeProfileId: p.id }));
          onClose();
        },
      });
    }
    out.push(
      { id: "g:voice", group: "Go to", title: "Voice & taste", hint: "Teach it how you write", icon: <Fingerprint size={16} />, run: () => go("/voice") },
      { id: "g:structures", group: "Go to", title: "Structures", hint: "Reusable writing mechanics", icon: <Shapes size={16} />, run: () => go("/structures") },
      { id: "g:deai", group: "Go to", title: "De-AI checker", hint: "Flag generic, machine-sounding writing", icon: <WandSparkles size={16} />, run: () => go("/de-ai") },
      { id: "g:library", group: "Go to", title: "Library", hint: "Saved drafts, posted, learning signals", icon: <Bookmark size={16} />, run: () => go("/library") },
    );
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, session.settings.postType]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.filter((i) => i.group === "Drafts" || i.group === "Go to");
    return items.filter((i) => `${i.title} ${i.hint ?? ""} ${i.group}`.toLowerCase().includes(q));
  }, [items, query]);

  // Keep the highlighted row valid as results change.
  const current = Math.min(active, Math.max(0, filtered.length - 1));

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${current}"]`)?.scrollIntoView({ block: "nearest" });
  }, [current]);

  const groups: [string, { item: Item; index: number }[]][] = [];
  filtered.forEach((item, index) => {
    const g = groups.find(([name]) => name === item.group);
    if (g) g[1].push({ item, index });
    else groups.push([item.group, [{ item, index }]]);
  });

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-label="Command menu" aria-modal="true">
      <button type="button" aria-label="Close command menu" className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-5 flex flex-col items-center gap-2.5 px-4 pointer-events-none">
        <div className="w-full max-w-[640px] rounded-2xl border border-line bg-panel-2 shadow-[0_30px_80px_rgba(0,0,0,0.6)] pointer-events-auto overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-line">
            <span className="inline-flex items-center gap-2 rounded-full bg-panel-3 pl-1.5 pr-3 py-1 text-xs font-semibold">
              <span className="h-5 w-5 rounded-full bg-black grid place-items-center">
                <Logo size={13} />
              </span>
              Moxie
            </span>
            <span className="ml-auto text-xs text-muted flex items-center gap-1.5">
              Type to search and hit <span className="kbd">return</span>
            </span>
          </div>
          <div ref={listRef} className="max-h-[min(26rem,55vh)] overflow-y-auto p-2" role="listbox">
            {groups.map(([name, rows]) => (
              <div key={name} className="pb-1">
                <p className="px-3 pt-2 pb-1.5 text-xs text-muted">{name}</p>
                {rows.map(({ item, index }) => (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={index === current}
                    data-index={index}
                    onMouseMove={() => setActive(index)}
                    onClick={item.run}
                    className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] ${
                      index === current ? "bg-panel-3 text-fg" : "text-muted"
                    }`}
                  >
                    <span className={index === current ? "text-fg" : "text-faint"}>{item.icon}</span>
                    <span className={`truncate ${item.active ? "text-fg" : ""}`}>{item.title}</span>
                    {item.hint && <span className="ml-auto text-xs text-faint truncate max-w-[45%]">{item.hint}</span>}
                  </button>
                ))}
              </div>
            ))}
            {filtered.length === 0 && <p className="px-3 py-6 text-sm text-muted text-center">No matches for “{query}”.</p>}
          </div>
        </div>
        <div className="w-full max-w-[640px] rounded-2xl border border-line bg-panel-2 pointer-events-auto shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(filtered.length - 1, a + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                filtered[current]?.run();
              } else if (e.key === "Escape") {
                onClose();
              }
            }}
            placeholder="Search drafts and commands"
            aria-label="Search commands"
            className="w-full h-14 bg-transparent px-5 text-[17px] outline-none placeholder:text-faint"
          />
        </div>
      </div>
    </div>
  );
}
