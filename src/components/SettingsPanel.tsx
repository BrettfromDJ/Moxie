"use client";

import { ANGLES, FORMATS, GOALS, LENGTHS, MODES, RELATIONSHIPS, creativityLabel, DEFAULT_SETTINGS } from "@/lib/options";
import { activeSession, patchActive, useStore } from "@/lib/store";
import { BUILT_IN_STRUCTURES } from "@/lib/structures";
import type { ComposerSettings } from "@/lib/types";
import { X_LIMIT, X_PREMIUM_LIMIT } from "@/lib/xcount";

export function useSettings() {
  const { state, update } = useStore();
  const settings = activeSession(state).settings;
  const set = (p: Partial<ComposerSettings>) =>
    update((s) => {
      const next = patchActive(s, (x) => ({ ...x, settings: { ...x.settings, ...p } }));
      return { ...next, lastSettings: activeSession(next).settings };
    });
  return { settings, set };
}

function Pills<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            title={o.hint}
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={`rounded-full px-3 py-1 text-xs border transition-colors ${
              value === o.value ? "bg-fg text-bg border-fg" : "border-line hover:bg-panel-2"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function SettingsPanel() {
  const { state } = useStore();
  const { settings: s, set } = useSettings();
  const structures = [...BUILT_IN_STRUCTURES, ...state.customStructures];

  return (
    <div className="space-y-4 max-h-[min(34rem,42vh)] overflow-y-auto p-4">
      <Pills label="Format" value={s.format} options={FORMATS} onChange={(format) => set({ format })} />
      <div className="grid grid-cols-2 gap-4">
        <Pills label="Length" value={s.length} options={LENGTHS} onChange={(length) => set({ length })} />
        <Pills
          label="Options"
          value={s.options}
          options={[1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n) }))}
          onChange={(options) => set({ options })}
        />
      </div>
      <div>
        <div className="flex justify-between items-baseline">
          <span className="label">Creativity</span>
          <span className="text-xs font-medium">{creativityLabel(s.creativity)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={s.creativity}
          onChange={(e) => set({ creativity: Number(e.target.value) })}
          className="w-full"
          aria-label="Creativity"
        />
        <div className="flex justify-between text-[11px] text-muted">
          <span>Light cleanup</span>
          <span>Rethink the framing</span>
        </div>
      </div>
      <Pills label="Angle" value={s.angle} options={ANGLES} onChange={(angle) => set({ angle })} />
      {s.angle === "custom" && (
        <input
          className="input text-sm"
          placeholder="Describe the angle, e.g. compare it to how restaurants work"
          value={s.customAngle}
          onChange={(e) => set({ customAngle: e.target.value })}
          aria-label="Custom angle"
        />
      )}
      {s.postType === "reply" && (
        <Pills label="Replying to a…" value={s.relationship} options={RELATIONSHIPS.map((r) => (r.value === "none" ? { ...r, label: "Anyone" } : r))} onChange={(relationship) => set({ relationship })} />
      )}
      <Pills label="Goal" value={s.goal} options={GOALS.map((g) => (g.value === "none" ? { ...g, label: "None" } : g))} onChange={(goal) => set({ goal })} />
      <Pills label="Style" value={s.mode} options={MODES} onChange={(mode) => set({ mode })} />
      <label className="block">
        <span className="label">Structure</span>
        <select className="input text-sm" value={s.structureId ?? ""} onChange={(e) => set({ structureId: e.target.value || null })}>
          <option value="">Any structure</option>
          {structures.map((st) => (
            <option key={st.id} value={st.id}>
              {st.name} — {st.pattern}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={s.charLimit > X_LIMIT}
          onChange={(e) => set({ charLimit: e.target.checked ? X_PREMIUM_LIMIT : X_LIMIT })}
          className="accent-[var(--accent)]"
        />
        I have X Premium (long posts up to {X_PREMIUM_LIMIT.toLocaleString()} characters)
      </label>
      <button
        type="button"
        className="text-xs text-muted hover:text-fg"
        onClick={() => set({ ...DEFAULT_SETTINGS, postType: s.postType })}
      >
        Reset to defaults
      </button>
    </div>
  );
}

// Short summary of non-default settings, shown on the settings button.
export function settingsSummary(s: ComposerSettings): string[] {
  const out: string[] = [];
  const label = <T extends string>(list: { value: T; label: string }[], v: T) => list.find((o) => o.value === v)?.label ?? v;
  if (s.format !== "auto") out.push(label(FORMATS, s.format));
  if (s.length !== "standard") out.push(label(LENGTHS, s.length));
  if (s.angle !== "auto") out.push(s.angle === "custom" ? "Custom angle" : label(ANGLES, s.angle));
  if (s.structureId) out.push("Structure");
  if (s.creativity !== DEFAULT_SETTINGS.creativity) out.push(creativityLabel(s.creativity));
  if (s.options !== DEFAULT_SETTINGS.options) out.push(`${s.options} options`);
  return out;
}
