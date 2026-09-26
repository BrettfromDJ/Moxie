"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore } from "@/lib/store";

const LINKS = [
  { href: "/", label: "Write" },
  { href: "/voice", label: "Voice & taste" },
  { href: "/structures", label: "Structures" },
  { href: "/de-ai", label: "De-AI" },
  { href: "/library", label: "Library" },
];

export function Nav() {
  const path = usePathname();
  const { state, update, hydrated } = useStore();
  return (
    <header className="border-b border-line bg-panel/80 backdrop-blur sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-4">
        <Link href="/" className="font-semibold tracking-tight text-lg shrink-0">
          moxie<span className="text-accent">.</span>
        </Link>
        <nav className="flex gap-1 overflow-x-auto">
          {LINKS.map((l) => {
            const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`px-3 py-1.5 rounded-md text-sm whitespace-nowrap ${
                  active ? "bg-accent-soft text-accent font-medium" : "text-muted hover:text-fg"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2 text-sm">
          {hydrated && state.profiles.length > 0 ? (
            <>
              <span className="text-muted hidden sm:inline">Voice</span>
              <select
                aria-label="Active voice profile"
                className="input !w-auto !py-1"
                value={state.activeProfileId ?? ""}
                onChange={(e) => update((s) => ({ ...s, activeProfileId: e.target.value || null }))}
              >
                <option value="">No profile</option>
                {state.profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </>
          ) : hydrated ? (
            <Link href="/voice" className="btn btn-sm">
              Teach it your voice
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  );
}
