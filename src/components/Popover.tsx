"use client";

import { useEffect, useRef, useState } from "react";

// Minimal popover: a trigger plus a floating panel that closes on outside
// click or Escape. `side` picks whether it opens above or below the trigger.
export function Popover({
  trigger,
  children,
  side = "top",
  align = "start",
  className = "",
  panelClassName = "",
  label,
}: {
  trigger: (open: boolean) => React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  side?: "top" | "bottom";
  align?: "start" | "end";
  className?: string;
  panelClassName?: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="contents"
      >
        {trigger(open)}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={label}
          className={`absolute z-40 ${side === "top" ? "bottom-full mb-2" : "top-full mt-2"} ${
            align === "start" ? "left-0" : "right-0"
          } rounded-2xl border border-line bg-panel-2 shadow-[0_24px_60px_rgba(0,0,0,0.55)] ${panelClassName}`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  icon,
  title,
  hint,
  onClick,
  active,
  disabled,
}: {
  icon?: React.ReactNode;
  title: string;
  hint?: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={`w-full flex items-start gap-3 rounded-xl px-3 py-2 text-left hover:bg-panel-3 disabled:opacity-40 ${
        active ? "bg-panel-3" : ""
      }`}
    >
      {icon && <span className="mt-0.5 text-muted shrink-0">{icon}</span>}
      <span className="min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </button>
  );
}
