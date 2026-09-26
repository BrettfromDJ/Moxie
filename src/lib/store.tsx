"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { DEFAULT_SETTINGS } from "./options";
import { findStructure } from "./structures";
import type {
  AngleOption,
  Candidate,
  ComposerSettings,
  Critique,
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

// What pressing send does.
export type SendMode = "angles" | "variations" | "surprise" | "formats" | "critique";

// Everything needed to re-run an assistant turn (used by Retry).
export interface RunRequest {
  mode: SendMode | "directions" | "more-like" | "push";
  angle?: AngleOption;
  seed?: Candidate;
  options?: number;
}

export interface UserTurn {
  id: string;
  role: "user";
  at: number;
  text: string;
  action?: string; // set when the turn came from a button, e.g. "More like #2"
  tags: string[];
}

export interface AssistantTurn {
  id: string;
  role: "assistant";
  at: number;
  status: "pending" | "done" | "error";
  kind: "angles" | "drafts" | "critique";
  label: string;
  source: string; // the author message this turn answers
  request: RunRequest;
  angles?: AngleOption[];
  candidates?: Candidate[];
  formatNote?: string;
  question?: string | null;
  critique?: Critique;
  error?: string;
}

export type Turn = UserTurn | AssistantTurn;

// A conversation: one idea being worked on, with its own sources and settings.
export interface Session {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  settings: ComposerSettings;
  references: Reference[];
  draft: string; // unsent composer text
  turns: Turn[];
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
  sessions: Session[];
  activeSessionId: string;
  lastSettings: ComposerSettings;
  sendMode: SendMode;
}

let n = 0;
export const uid = (p = "id") => `${p}_${Date.now().toString(36)}${(n++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function newSession(settings: ComposerSettings = DEFAULT_SETTINGS): Session {
  const now = Date.now();
  return {
    id: uid("s"),
    title: "New draft",
    createdAt: now,
    updatedAt: now,
    settings: { ...settings, structureId: null, angle: "auto", customAngle: "" },
    references: [],
    draft: "",
    turns: [],
  };
}

function initial(): AppState {
  const first = newSession();
  return {
    profiles: [],
    activeProfileId: null,
    taste: { admired: [], qualities: [] },
    feedback: [],
    customStructures: [],
    posted: [],
    saved: [],
    sessions: [first],
    activeSessionId: first.id,
    lastSettings: DEFAULT_SETTINGS,
    sendMode: "angles",
  };
}

const KEY = "moxie:v2";
const LEGACY_KEY = "moxie:v1";

function load(): AppState {
  const base = initial();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppState>;
      const state: AppState = { ...base, ...parsed, lastSettings: { ...DEFAULT_SETTINGS, ...parsed.lastSettings } };
      state.sessions = (state.sessions ?? []).map((s) => ({
        ...s,
        settings: { ...DEFAULT_SETTINGS, ...s.settings },
        // A reload interrupts in-flight requests.
        turns: s.turns.map((t) =>
          t.role === "assistant" && t.status === "pending" ? { ...t, status: "error" as const, error: "Interrupted. Try again." } : t,
        ),
      }));
      if (!state.sessions.some((s) => s.id === state.activeSessionId)) {
        const fresh = newSession(state.lastSettings);
        state.sessions = [fresh, ...state.sessions];
        state.activeSessionId = fresh.id;
      }
      return state;
    }
    // Carry over what the first version learned (profiles, taste, feedback…).
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const old = JSON.parse(legacy) as Partial<AppState> & { composer?: { settings?: ComposerSettings } };
      const lastSettings = { ...DEFAULT_SETTINGS, ...old.composer?.settings };
      const first = newSession(lastSettings);
      return {
        ...base,
        profiles: old.profiles ?? [],
        activeProfileId: old.activeProfileId ?? null,
        taste: old.taste ?? base.taste,
        feedback: old.feedback ?? [],
        customStructures: old.customStructures ?? [],
        posted: old.posted ?? [],
        saved: old.saved ?? [],
        sessions: [first],
        activeSessionId: first.id,
        lastSettings,
      };
    }
  } catch {
    // Corrupt storage: start fresh rather than crash.
  }
  return base;
}

function save(state: AppState) {
  try {
    const sessions = [...state.sessions].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 40);
    localStorage.setItem(KEY, JSON.stringify({ ...state, sessions }));
  } catch {
    // Storage full or unavailable: keep working in memory.
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
  const [state, setState] = useState<AppState>(initial);
  const [hydrated, setHydrated] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Hydrate from localStorage after mount so server and first client render match.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(load());
    setHydrated(true);
  }, []);

  const latest = useRef(state);

  useEffect(() => {
    if (!hydrated) return;
    latest.current = state;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save(state), 250);
  }, [state, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    // Don't lose the last quarter-second of changes when the tab closes or reloads.
    const flush = () => save(latest.current);
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [hydrated]);

  const update = useCallback((fn: Updater) => setState(fn), []);
  return <Ctx.Provider value={{ state, hydrated, update }}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore must be used inside StoreProvider");
  return s;
}

export function activeProfile(s: AppState): VoiceProfile | null {
  return s.profiles.find((p) => p.id === s.activeProfileId) ?? null;
}

export function activeSession(s: AppState): Session {
  return s.sessions.find((x) => x.id === s.activeSessionId) ?? s.sessions[0];
}

export function patchSession(s: AppState, id: string, fn: (x: Session) => Session): AppState {
  return { ...s, sessions: s.sessions.map((x) => (x.id === id ? fn(x) : x)) };
}

export function patchActive(s: AppState, fn: (x: Session) => Session): AppState {
  return patchSession(s, activeSession(s).id, fn);
}

// Starts a new conversation, reusing an untouched empty one if there is one.
export function startSession(s: AppState): AppState {
  const settings = activeSession(s)?.settings ?? s.lastSettings;
  const fresh = newSession(settings);
  const sessions = s.sessions.filter((x) => x.turns.length > 0);
  return { ...s, sessions: [fresh, ...sessions], activeSessionId: fresh.id };
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

export const isResponding = (settings: ComposerSettings) =>
  settings.postType === "quote" || settings.postType === "reply";

// Builds the request context for a message in a conversation. For quotes and
// replies the message is the author's take on the source; otherwise it's the thought.
export function buildContext(s: AppState, session: Session, text: string): GenerationContext {
  const history = session.turns
    .filter((t): t is UserTurn => t.role === "user" && !t.action && t.text !== text)
    .map((t) => t.text)
    .slice(-6);
  const responding = isResponding(session.settings);
  return {
    settings: session.settings,
    thought: responding ? "" : text,
    take: responding ? text : "",
    references: resolveReferences(session.references),
    voice: activeProfile(s),
    taste: s.taste,
    feedback: s.feedback.slice(-30),
    structure: findStructure(session.settings.structureId, s.customStructures),
    history,
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
