"use client";

import { Bookmark, Fingerprint, History, PenLine, Search, Shapes, WandSparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { CommandPalette } from "./CommandPalette";

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className="shrink-0">
      <defs>
        <linearGradient id="moxie-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#b9b9c3" />
        </linearGradient>
      </defs>
      <path d="M9.2 3.5 4 12l5.2 8.5h3.1L7.2 12l5.1-8.5z" fill="url(#moxie-mark)" />
      <path d="M15.4 3.5 10.2 12l5.2 8.5h3.1L13.4 12l5.1-8.5z" fill="url(#moxie-mark)" opacity=".55" />
    </svg>
  );
}

// Fey-style page header: mark + title on the left, filters beside it, actions on the right.
export function PageHeader({
  title,
  children,
  actions,
}: {
  title: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 sm:px-10 pt-7 pb-5">
      <Link href="/" className="flex items-center gap-2.5 shrink-0" aria-label="Moxie home">
        <Logo />
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      </Link>
      {children && (
        <div className="order-last w-full md:order-none md:w-auto flex flex-wrap items-center gap-2 min-w-0">{children}</div>
      )}
      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
    </header>
  );
}

export function IconSquare({
  label,
  onClick,
  children,
  href,
}: {
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
  href?: string;
}) {
  const cls =
    "h-10 w-10 grid place-items-center rounded-xl border border-line bg-panel text-muted hover:text-fg hover:bg-panel-2 hover:border-line-strong transition-colors";
  if (href)
    return (
      <Link href={href} aria-label={label} title={label} className={cls}>
        {children}
      </Link>
    );
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className={cls}>
      {children}
    </button>
  );
}

const DOCK = [
  { href: "/", label: "Write", icon: PenLine },
  { href: "/voice", label: "Voice & taste", icon: Fingerprint },
  { href: "/structures", label: "Structures", icon: Shapes },
  { href: "/de-ai", label: "De-AI checker", icon: WandSparkles },
  { href: "/library", label: "Library", icon: Bookmark },
];

interface PaletteCtx {
  open: (initial?: string) => void;
}
const PaletteContext = createContext<PaletteCtx>({ open: () => undefined });
export const useCommandPalette = () => useContext(PaletteContext);

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [palette, setPalette] = useState<{ open: boolean; query: string }>({ open: false, query: "" });
  const open = useCallback((initial = "") => setPalette({ open: true, query: initial }), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => ({ open: !p.open, query: "" }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <PaletteContext.Provider value={{ open }}>
      <div className="h-dvh overflow-y-auto" id="main-scroll">
        {children}
      </div>

      {/* Floating dock */}
      <nav
        aria-label="Main"
        className="fixed bottom-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2"
        data-dock
      >
        <div className="flex items-center gap-1 rounded-full border border-line bg-panel/85 backdrop-blur-xl p-1.5 shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
          {DOCK.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                title={label}
                aria-current={active ? "page" : undefined}
                className={`h-10 w-10 grid place-items-center rounded-full transition-colors ${
                  active ? "bg-panel-3 text-fg" : "text-muted hover:text-fg hover:bg-panel-2"
                }`}
              >
                <Icon size={18} />
              </Link>
            );
          })}
          <button
            type="button"
            aria-label="Recent drafts"
            title="Recent drafts"
            onClick={() => open("")}
            className="h-10 w-10 grid place-items-center rounded-full text-muted hover:text-fg hover:bg-panel-2"
          >
            <History size={18} />
          </button>
        </div>
        <button
          type="button"
          onClick={() => open("")}
          aria-label="Command menu (⌘K)"
          title="Command menu (⌘K)"
          className="h-[52px] w-[52px] grid place-items-center rounded-full border border-line bg-panel/85 backdrop-blur-xl text-muted hover:text-fg shadow-[0_10px_40px_rgba(0,0,0,0.5)]"
        >
          <Search size={19} />
        </button>
      </nav>

      {palette.open && (
        <CommandPalette initialQuery={palette.query} onClose={() => setPalette({ open: false, query: "" })} />
      )}
    </PaletteContext.Provider>
  );
}

const TILE = {
  orange: "bg-[#ff8a3d]/15 text-[#ff9f5e]",
  purple: "bg-[#8b7cf6]/15 text-[#a89bff]",
  green: "bg-[#3ecf8e]/15 text-[#4fdba0]",
  pink: "bg-[#f25a7a]/15 text-[#ff7b96]",
  blue: "bg-[#5b8cff]/15 text-[#7fa6ff]",
} as const;

// Section label with a tinted icon tile, as in Fey's settings.
export function SectionTitle({
  icon,
  tone,
  children,
  aside,
}: {
  icon: React.ReactNode;
  tone: keyof typeof TILE;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className={`h-9 w-9 rounded-xl grid place-items-center ${TILE[tone]}`}>{icon}</span>
      <h2 className="text-[17px] font-semibold">{children}</h2>
      {aside && <div className="ml-auto flex items-center gap-2">{aside}</div>}
    </div>
  );
}
