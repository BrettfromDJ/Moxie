"use client";

import { Check, Plus, X } from "lucide-react";
import {
  ANGLES,
  DEFAULT_SETTINGS,
  FORMATS,
  GOALS,
  LENGTHS,
  MODES,
  POST_TYPES,
  RELATIONSHIPS,
  creativityLabel,
} from "@/lib/options";
import { useStore } from "@/lib/store";
import { BUILT_IN_STRUCTURES } from "@/lib/structures";
import type { ComposerSettings } from "@/lib/types";
import { MenuItem, Popover } from "./Popover";
import { SettingsPanel, useSettings } from "./SettingsPanel";

type Opt<T> = { value: T; label: string; hint?: string };

// A Fey-style filter: "Label | Value ×". The value opens a menu; × resets it.
function FilterPill<T extends string | number>({
  label,
  value,
  options,
  onChange,
  onClear,
}: {
  label: string;
  value: T;
  options: Opt<T>[];
  onChange: (v: T) => void;
  onClear?: () => void;
}) {
  const current = options.find((o) => o.value === value)?.label ?? String(value);
  return (
    <div className="flex items-stretch h-10 rounded-full border border-line bg-panel text-sm" data-testid={`filter-${label}`}>
      <Popover
        label={label}
        side="bottom"
        panelClassName="w-64 p-1.5 max-h-80 overflow-y-auto"
        className="flex"
        trigger={() => (
          <span className="flex items-stretch cursor-pointer">
            <span className="px-3.5 grid place-items-center text-muted">{label}</span>
            <span className={`pl-3.5 ${onClear ? "pr-2" : "pr-3.5"} grid place-items-center border-l border-line text-fg hover:bg-panel-2 ${onClear ? "" : "rounded-r-full"}`}>
              {current}
            </span>
          </span>
        )}
      >
        {(close) => (
          <div role="menu">
            {options.map((o) => (
              <MenuItem
                key={String(o.value)}
                title={o.label}
                hint={o.hint || undefined}
                active={o.value === value}
                icon={o.value === value ? <Check size={16} /> : <span className="inline-block w-4" />}
                onClick={() => {
                  onChange(o.value);
                  close();
                }}
              />
            ))}
          </div>
        )}
      </Popover>
      {onClear && (
        <button
          type="button"
          aria-label={`Clear ${label}`}
          onClick={onClear}
          className="pr-3 pl-1 grid place-items-center text-muted hover:text-fg rounded-r-full"
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
}

export function FilterBar() {
  const { state, update } = useStore();
  const { settings: s, set } = useSettings();
  const d = DEFAULT_SETTINGS;
  const clear = (k: keyof ComposerSettings) => () => set({ [k]: d[k] } as Partial<ComposerSettings>);
  const structures = [...BUILT_IN_STRUCTURES, ...state.customStructures];
  const creativity: Opt<number>[] = [10, 30, 50, 75, 95].map((v) => ({ value: v, label: creativityLabel(v) }));

  return (
    <>
      <FilterPill label="Post" value={s.postType} options={POST_TYPES} onChange={(postType) => set({ postType })} />
      <FilterPill
        label="Voice"
        value={state.activeProfileId ?? ""}
        options={[...state.profiles.map((p) => ({ value: p.id, label: p.name, hint: p.archetype })), { value: "", label: "None", hint: "Plain, natural register" }]}
        onChange={(id) => update((st) => ({ ...st, activeProfileId: id || null }))}
      />
      {s.format !== d.format && <FilterPill label="Format" value={s.format} options={FORMATS} onChange={(format) => set({ format })} onClear={clear("format")} />}
      {s.length !== d.length && <FilterPill label="Length" value={s.length} options={LENGTHS} onChange={(length) => set({ length })} onClear={clear("length")} />}
      {s.angle !== d.angle && s.angle !== "custom" && (
        <FilterPill label="Angle" value={s.angle} options={ANGLES.filter((a) => a.value !== "custom")} onChange={(angle) => set({ angle })} onClear={clear("angle")} />
      )}
      {s.angle === "custom" && (
        <FilterPill label="Angle" value="custom" options={[{ value: "custom", label: s.customAngle.slice(0, 24) || "Custom" }]} onChange={() => undefined} onClear={clear("angle")} />
      )}
      {s.creativity !== d.creativity && (
        <FilterPill label="Creativity" value={s.creativity} options={creativity.some((c) => c.value === s.creativity) ? creativity : [...creativity, { value: s.creativity, label: creativityLabel(s.creativity) }]} onChange={(creativity) => set({ creativity })} onClear={clear("creativity")} />
      )}
      {s.options !== d.options && (
        <FilterPill label="Options" value={s.options} options={[1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n) }))} onChange={(options) => set({ options })} onClear={clear("options")} />
      )}
      {s.structureId && (
        <FilterPill label="Structure" value={s.structureId} options={structures.map((st) => ({ value: st.id, label: st.name, hint: st.pattern }))} onChange={(structureId) => set({ structureId })} onClear={clear("structureId")} />
      )}
      {s.goal !== d.goal && <FilterPill label="Goal" value={s.goal} options={GOALS} onChange={(goal) => set({ goal })} onClear={clear("goal")} />}
      {s.mode !== d.mode && <FilterPill label="Style" value={s.mode} options={MODES} onChange={(mode) => set({ mode })} onClear={clear("mode")} />}
      {s.postType === "reply" && s.relationship !== "none" && (
        <FilterPill label="Replying to" value={s.relationship} options={RELATIONSHIPS} onChange={(relationship) => set({ relationship })} onClear={clear("relationship")} />
      )}
      <Popover
        label="All settings"
        side="bottom"
        panelClassName="w-[min(28rem,calc(100vw-2rem))]"
        trigger={() => (
          <span className="h-10 w-10 grid place-items-center rounded-full border border-line bg-panel text-muted hover:text-fg hover:bg-panel-2" title="More settings">
            <Plus size={17} />
          </span>
        )}
      >
        {() => <SettingsPanel />}
      </Popover>
    </>
  );
}
