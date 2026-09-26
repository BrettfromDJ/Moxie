"use client";

import { Check, Cpu } from "lucide-react";
import { useEffect, useState } from "react";
import { MenuItem, Popover } from "./Popover";
import { useSettings } from "./SettingsPanel";

interface Providers {
  anthropic: { available: boolean; label: string };
  openai: { available: boolean; label: string };
}

let cached: Promise<Providers | null> | null = null;
function loadProviders() {
  cached ??= fetch("/api/providers")
    .then((r) => (r.ok ? (r.json() as Promise<Providers>) : null))
    .catch(() => null);
  return cached;
}

// Picks which company's model writes the drafts. Hidden unless OpenAI is set up.
export function ModelPicker({ side, pillClass }: { side: "top" | "bottom"; pillClass: string }) {
  const { settings, set } = useSettings();
  const [providers, setProviders] = useState<Providers | null>(null);

  useEffect(() => {
    let live = true;
    loadProviders().then((p) => live && setProviders(p));
    return () => {
      live = false;
    };
  }, []);

  if (!providers?.openai.available) return null;
  const current = settings.provider === "openai" ? providers.openai.label : providers.anthropic.label;
  const options = [
    { value: "anthropic" as const, label: providers.anthropic.label, hint: "Anthropic" },
    { value: "openai" as const, label: providers.openai.label, hint: "OpenAI" },
  ];

  return (
    <Popover
      side={side}
      label="Model"
      panelClassName="w-64 p-1.5"
      trigger={() => (
        <span className={pillClass} data-testid="model-picker">
          <Cpu size={15} />
          <span className="hidden sm:inline">{current}</span>
        </span>
      )}
    >
      {(close) => (
        <div role="menu">
          <p className="px-3 pt-1.5 pb-1 text-xs text-faint">Model that writes your drafts</p>
          {options.map((o) => (
            <MenuItem
              key={o.value}
              title={o.label}
              hint={o.hint}
              active={settings.provider === o.value}
              icon={settings.provider === o.value ? <Check size={16} /> : <span className="inline-block w-4" />}
              onClick={() => {
                set({ provider: o.value });
                close();
              }}
            />
          ))}
        </div>
      )}
    </Popover>
  );
}
