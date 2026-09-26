"use client";

import { Fingerprint, Library, Menu, PanelLeft, Shapes, SquarePen, Trash2, WandSparkles } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { startSession, useStore } from "@/lib/store";

const TOOLS = [
  { href: "/voice", label: "Voice & taste", icon: Fingerprint },
  { href: "/structures", label: "Structures", icon: Shapes },
  { href: "/de-ai", label: "De-AI checker", icon: WandSparkles },
  { href: "/library", label: "Library", icon: Library },
];

function groupLabel(t: number): string {
  const days = Math.floor((Date.now() - t) / 86_400_000);
  if (days < 1) return "Today";
  if (days < 2) return "Yesterday";
  if (days < 7) return "Previous 7 days";
  return "Older";
}

export function Sidebar({ children }: { children: React.ReactNode }) {
  const { state, update, hydrated } = useStore();
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(true); // desktop collapsed state
  const [mobileOpen, setMobileOpen] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMobileOpen(false), [path]);

  const conversations = hydrated
    ? [...state.sessions].filter((s) => s.turns.length > 0).sort((a, b) => b.updatedAt - a.updatedAt)
    : [];
  const groups: [string, typeof conversations][] = [];
  for (const c of conversations) {
    const label = groupLabel(c.updatedAt);
    const g = groups.find(([l]) => l === label);
    if (g) g[1].push(c);
    else groups.push([label, [c]]);
  }

  function newDraft() {
    update(startSession);
    router.push("/");
    setMobileOpen(false);
  }

  const profile = state.profiles.find((p) => p.id === state.activeProfileId);

  const panel = (
    <div className="flex h-full w-[264px] flex-col bg-panel-2/60 border-r border-line">
      <div className="flex items-center gap-1 px-3 h-14">
        <Link href="/" className="font-semibold tracking-tight text-lg px-2">
          moxie<span className="text-accent">.</span>
        </Link>
        <button
          type="button"
          className="ml-auto h-9 w-9 grid place-items-center rounded-lg text-muted hover:bg-panel-2 hover:text-fg"
          onClick={() => (mobileOpen ? setMobileOpen(false) : setOpen(false))}
          aria-label="Close sidebar"
        >
          <PanelLeft size={18} />
        </button>
        <button
          type="button"
          className="h-9 w-9 grid place-items-center rounded-lg text-muted hover:bg-panel-2 hover:text-fg"
          onClick={newDraft}
          aria-label="New draft"
          title="New draft"
        >
          <SquarePen size={18} />
        </button>
      </div>

      <nav className="px-3 space-y-0.5">
        <button type="button" onClick={newDraft} className="w-full flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm hover:bg-panel-2">
          <SquarePen size={16} className="text-muted" /> New draft
        </button>
        {TOOLS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm hover:bg-panel-2 ${path.startsWith(href) ? "bg-panel-2 font-medium" : ""}`}
          >
            <Icon size={16} className="text-muted" /> {label}
          </Link>
        ))}
      </nav>

      <div className="flex-1 overflow-y-auto px-3 pt-5 pb-3 space-y-4" aria-label="Conversations">
        {groups.map(([label, items]) => (
          <div key={label}>
            <p className="px-2.5 pb-1 text-xs font-medium text-muted">{label}</p>
            <ul>
              {items.map((c) => {
                const active = c.id === state.activeSessionId && path === "/";
                return (
                  <li key={c.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => {
                        update((s) => ({ ...s, activeSessionId: c.id, sessions: s.sessions.filter((x) => x.turns.length > 0 || x.id === c.id) }));
                        router.push("/");
                      }}
                      className={`w-full text-left truncate rounded-lg px-2.5 py-2 pr-8 text-sm hover:bg-panel-2 ${active ? "bg-panel-2" : ""}`}
                    >
                      {c.title}
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete “${c.title}”`}
                      onClick={() =>
                        update((s) => {
                          const sessions = s.sessions.filter((x) => x.id !== c.id);
                          return s.activeSessionId === c.id ? startSession({ ...s, sessions }) : { ...s, sessions };
                        })
                      }
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 h-6 w-6 grid place-items-center rounded text-muted opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-bad"
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        {hydrated && conversations.length === 0 && <p className="px-2.5 text-xs text-muted">Your drafts will show up here.</p>}
      </div>

      <Link href="/voice" className="m-3 flex items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-panel-2">
        <span className="h-8 w-8 rounded-full bg-accent text-accent-fg grid place-items-center text-sm font-semibold">
          {(profile?.name ?? "?").slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium truncate">{profile?.name ?? "No voice yet"}</span>
          <span className="block text-xs text-muted truncate">{profile?.archetype || (profile ? "Voice profile" : "Teach it how you write")}</span>
        </span>
      </Link>
    </div>
  );

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* Desktop */}
      <aside className={`hidden md:block shrink-0 transition-[width] duration-200 overflow-hidden ${open ? "w-[264px]" : "w-0"}`}>{panel}</aside>
      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="h-full shadow-2xl bg-bg">{panel}</div>
          <button type="button" aria-label="Close sidebar" className="flex-1 bg-black/30" onClick={() => setMobileOpen(false)} />
        </div>
      )}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className={`flex items-center gap-1 h-14 px-3 shrink-0 ${open ? "md:hidden" : ""}`}>
          <button
            type="button"
            className="h-9 w-9 grid place-items-center rounded-lg text-muted hover:bg-panel-2 hover:text-fg"
            onClick={() => (window.innerWidth < 768 ? setMobileOpen(true) : setOpen(true))}
            aria-label="Open sidebar"
          >
            <span className="md:hidden">
              <Menu size={18} />
            </span>
            <span className="hidden md:inline">
              <PanelLeft size={18} />
            </span>
          </button>
          <button
            type="button"
            className="h-9 w-9 grid place-items-center rounded-lg text-muted hover:bg-panel-2 hover:text-fg"
            onClick={newDraft}
            aria-label="New draft"
          >
            <SquarePen size={18} />
          </button>
          <span className="font-semibold tracking-tight ml-1">
            moxie<span className="text-accent">.</span>
          </span>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto" id="main-scroll">
          {children}
        </div>
      </div>
    </div>
  );
}
