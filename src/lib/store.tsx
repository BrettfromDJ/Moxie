"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { DEFAULT_SETTINGS } from "./options";
import { findStructure } from "./structures";
import type {
  AngleOption,
  Candidate,
  ComposerSettings,
  FeedbackKind,
  FeedbackSignal,
  GenerationContext,
  Reference,
  ResolvedReference,
  Structure,
  TasteProfile,
  VoiceProfile,
} from "./types";

// Everything the product learns about the user lives in their browser
// (localStorage). The server is stateless: it receives the relevant slice of
// this state with each request.

export interface Round {
  id: string;
  label: string;
  at: number;
  angles?: AngleOption[];
  candidates: Candidate[];
  formatNote?: string;
  question?: string | null;
}

export interface Composer {
  settings: ComposerSettings;
  thought: string;
  take: string;
  references: Reference[];
}

export interface PostedItem {
  id: string;
  text: string;
  at: number;
}

export interface AppState {
  profiles: VoiceProfile[];
  activeProfileId: string | null;
  taste: TasteProfile;
  feedback: FeedbackSignal[];
  customStructures: Structure[];
  posted: PostedItem[];
  saved: Candidate[];
  composer: Composer;
  rounds: Round[];
}

export const EMPTY_COMPOSER: Composer = {
  settings: DEFAULT_SETTINGS,
  thought: "",
  take: "",
  references: [],
};

const INITIAL: AppState = {
  profiles: [],
  activeProfileId: null,
  taste: { admired: [], qualities: [] },
  feedback: [],
  customStructures: [],
  posted: [],
  saved: [],
  composer: EMPTY_COMPOSER,
  rounds: [],
};

const KEY = "moxie:v1";

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return INITIAL;
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return {
      ...INITIAL,
      ...parsed,
      composer: {
        ...EMPTY_COMPOSER,
        ...parsed.composer,
        settings: { ...DEFAULT_SETTINGS, ...parsed.composer?.settings },
      },
    };
  } catch {
    return INITIAL;
  }
}

type Updater = (s: AppState) => AppState;

interface Store {
  state: AppState;
  hydrated: boolean;
  update: (fn: Updater) => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(INITIAL);
  const [hydrated, setHydrated] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Hydrate from localStorage after mount so server and first client render match.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(load());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        // Rounds can be large (images in refs are stored on the composer); keep the last few.
        const toSave = { ...state, rounds: state.rounds.slice(0, 8) };
        localStorage.setItem(KEY, JSON.stringify(toSave));
      } catch {
        // Storage full or unavailable: keep working in memory.
      }
    }, 250);
  }, [state, hydrated]);

  const update = useCallback((fn: Updater) => setState(fn), []);
  return <Ctx.Provider value={{ state, hydrated, update }}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore must be used inside StoreProvider");
  return s;
}

let n = 0;
export const uid = (p = "id") => `${p}_${Date.now().toString(36)}${(n++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function activeProfile(s: AppState): VoiceProfile | null {
  return s.profiles.find((p) => p.id === s.activeProfileId) ?? null;
}

export function addFeedback(
  s: AppState,
  kind: FeedbackKind,
  text: string,
  extra: Partial<FeedbackSignal> = {},
): AppState {
  const signal: FeedbackSignal = { id: uid("f"), kind, text, at: Date.now(), ...extra };
  return { ...s, feedback: [...s.feedback, signal].slice(-200) };
}

export function candidateText(c: Candidate): string {
  return c.thread.length ? c.thread.map((t) => t.text).join("\n\n") : c.text;
}

export function resolveReferences(refs: Reference[]): ResolvedReference[] {
  const tags = new Set(refs.map((r) => r.tag));
  return refs
    .filter((r) => r.status === "ready" && (r.text?.trim() || r.image))
    .map((r) => ({
      tag: r.tag,
      role: r.role,
      kind: r.kind,
      author: r.author,
      title: r.title,
      url: r.url,
      text: r.text,
      parentTag: r.parentTag && tags.has(r.parentTag) ? r.parentTag : undefined,
      image: r.image,
    }));
}

export function buildContext(s: AppState): GenerationContext {
  const c = s.composer;
  return {
    settings: c.settings,
    thought: c.thought,
    take: c.take,
    references: resolveReferences(c.references),
    voice: activeProfile(s),
    taste: s.taste,
    feedback: s.feedback.slice(-30),
    structure: findStructure(c.settings.structureId, s.customStructures),
  };
}

export async function api<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `Request failed (${res.status})`);
  return json as T;
}

// Splits pasted writing into posts: on "---" lines if present, otherwise on blank lines.
export function splitSamples(raw: string): string[] {
  const byRule = raw.split(/^\s*-{3,}\s*$/m);
  const parts = byRule.length > 1 ? byRule : raw.split(/\n\s*\n/);
  return parts.map((p) => p.trim()).filter((p) => p.length > 1);
}
