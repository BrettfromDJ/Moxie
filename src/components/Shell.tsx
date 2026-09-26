"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { CommandPalette } from "./CommandPalette";
import { Logo } from "./Logo";
import { Sidebar } from "./Sidebar";

export { Logo } from "./Logo";

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

interface PaletteCtx {
  open: (initial?: string) => void;
}
const PaletteContext = createContext<PaletteCtx>({ open: () => undefined });
export const useCommandPalette = () => useContext(PaletteContext);

export function Shell({ children }: { children: React.ReactNode }) {
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
      <Sidebar onSearch={() => open("")}>{children}</Sidebar>
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
