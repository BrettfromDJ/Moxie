import "server-only";
import { DEFAULT_SETTINGS } from "../options";
import type { Candidate, CardRole, GenerationContext } from "../types";
import { AppError } from "./claude";
import type { z } from "zod";
import type { CandidateSchema } from "./schemas";

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new AppError(400, "Invalid JSON body.");
  }
}

const clamp = (n: unknown, lo: number, hi: number, dflt: number) =>
  typeof n === "number" && Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : dflt;

// Normalizes the shared generation context so a malformed client payload
// cannot blow up prompt building or send an unbounded request upstream.
export function normalizeContext<T extends GenerationContext>(body: T): T {
  const settings = { ...DEFAULT_SETTINGS, ...(body.settings ?? {}) };
  settings.options = clamp(settings.options, 1, 6, 3);
  settings.creativity = clamp(settings.creativity, 0, 100, 50);
  settings.charLimit = clamp(settings.charLimit, 100, 25000, 280);
  const thought = String(body.thought ?? "").slice(0, 20000);
  const take = String(body.take ?? "").slice(0, 10000);
  const references = Array.isArray(body.references) ? body.references.slice(0, 12) : [];
  const feedback = Array.isArray(body.feedback) ? body.feedback.slice(-30) : [];
  const history = Array.isArray(body.history)
    ? body.history.slice(-6).map((h) => String(h).slice(0, 4000))
    : [];
  if (!thought.trim() && !take.trim() && !references.length) {
    throw new AppError(400, "Add a thought, a draft, or a reference first.");
  }
  return {
    ...body,
    settings,
    thought,
    take,
    references,
    feedback,
    history,
    voice: body.voice ?? null,
    taste: body.taste
      ? {
          ...body.taste,
          inspirations: (body.taste.inspirations ?? [])
            .filter((i) => i?.enabled && i.blueprint)
            .slice(0, 3)
            .map((i) => ({ ...i, posts: (i.posts ?? []).slice(0, 30) })),
        }
      : null,
    structure: body.structure ?? null,
  };
}

let counter = 0;
export const newId = (p: string) => `${p}_${Date.now().toString(36)}_${(counter++).toString(36)}`;

export function toCandidate(c: z.infer<typeof CandidateSchema>): Candidate {
  const thread = c.format === "thread" ? c.thread : [];
  return {
    id: newId("c"),
    angle: c.angle,
    structure: c.structure,
    format: c.format,
    // A thread must have cards; a single post must have text. Tolerate either slip.
    text: thread.length ? "" : c.text || c.thread.map((t) => t.text).join("\n\n"),
    thread: thread.map((t) => ({ id: newId("t"), role: t.role as CardRole, text: t.text })),
    rationale: c.rationale,
    voiceMatch: c.voiceMatch,
    voiceNote: c.voiceNote,
  };
}
