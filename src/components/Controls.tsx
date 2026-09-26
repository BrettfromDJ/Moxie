"use client";

import Link from "next/link";
import {
  ANGLES,
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
import { X_LIMIT, X_PREMIUM_LIMIT } from "@/lib/xcount";

function Select<T extends string>({
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
    <label className="block">
      <span className="label">{label}</span>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value} title={o.hint}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Controls() {
  const { state, update } = useStore();
  const s = state.composer.settings;
  const set = (p: Partial<ComposerSettings>) =>
    update((st) => ({ ...st, composer: { ...st.composer, settings: { ...st.composer.settings, ...p } } }));
  const structures = [...BUILT_IN_STRUCTURES, ...state.customStructures];

  return (
    <div className="grid grid-cols-2 gap-3">
      <Select label="Post type" value={s.postType} options={POST_TYPES} onChange={(postType) => set({ postType })} />
      <Select label="Format" value={s.format} options={FORMATS} onChange={(format) => set({ format })} />
      <Select label="Length" value={s.length} options={LENGTHS} onChange={(length) => set({ length })} />
      <Select label="Angle" value={s.angle} options={ANGLES} onChange={(angle) => set({ angle })} />
      {s.angle === "custom" && (
        <label className="col-span-2 block">
          <span className="label">Your angle</span>
          <input
            className="input"
            placeholder="e.g. compare it to how restaurants handle this"
            value={s.customAngle}
            onChange={(e) => set({ customAngle: e.target.value })}
          />
        </label>
      )}
      {s.postType === "reply" && (
        <Select
          label="Relationship"
          value={s.relationship}
          options={RELATIONSHIPS}
          onChange={(relationship) => set({ relationship })}
        />
      )}
      <label className="block">
        <span className="label">Voice</span>
        <select
          className="input"
          value={state.activeProfileId ?? ""}
          onChange={(e) => update((st) => ({ ...st, activeProfileId: e.target.value || null }))}
        >
          <option value="">{state.profiles.length ? "No profile" : "No profile yet"}</option>
          {state.profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {!state.profiles.length && (
          <Link href="/voice" className="text-xs text-accent mt-1 inline-block">
            Teach it your voice →
          </Link>
        )}
      </label>
      <label className="col-span-2 block">
        <span className="label flex justify-between">
          <span>Creativity</span>
          <span className="normal-case tracking-normal font-medium text-fg">{creativityLabel(s.creativity)}</span>
        </span>
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
      </label>
      <label className="block">
        <span className="label">Options</span>
        <select className="input" value={s.options} onChange={(e) => set({ options: Number(e.target.value) })}>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <Select label="Goal (optional)" value={s.goal} options={GOALS} onChange={(goal) => set({ goal })} />
      <label className="block">
        <span className="label">Structure</span>
        <select
          className="input"
          value={s.structureId ?? ""}
          onChange={(e) => set({ structureId: e.target.value || null })}
        >
          <option value="">Any</option>
          {structures.map((st) => (
            <option key={st.id} value={st.id} title={st.pattern}>
              {st.name}
            </option>
          ))}
        </select>
      </label>
      <Select label="Mode" value={s.mode} options={MODES} onChange={(mode) => set({ mode })} />
      <label className="col-span-2 flex items-center gap-2 text-sm text-muted">
        <input
          type="checkbox"
          checked={s.charLimit > X_LIMIT}
          onChange={(e) => set({ charLimit: e.target.checked ? X_PREMIUM_LIMIT : X_LIMIT })}
        />
        My account can post long posts (X Premium, {X_PREMIUM_LIMIT.toLocaleString()} characters)
      </label>
    </div>
  );
}
