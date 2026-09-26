import { z } from "zod";

const cardRole = z.enum(["hook", "setup", "insight", "example", "takeaway", "close", "other"]);
const outFormat = z.enum([
  "one-liner",
  "short",
  "long",
  "thread",
  "list",
  "story",
  "breakdown",
  "hot-take",
  "before-after",
]);

export const CandidateSchema = z.object({
  angle: z.string().describe("Short name of the angle this candidate takes"),
  structure: z.string().describe("The mechanic used, e.g. 'Setup → expectation → flip'"),
  format: outFormat,
  text: z.string().describe("The full post. Empty string when format is thread."),
  thread: z
    .array(z.object({ role: cardRole, text: z.string() }))
    .describe("Thread posts in order. Empty array unless format is thread."),
  rationale: z.string().describe("One sentence on why this version works"),
  voiceMatch: z.enum(["strong", "partial", "weak"]),
  voiceNote: z.string().describe("One short phrase on how it matches or departs from the author's voice"),
});

export const CandidatesSchema = z.object({
  candidates: z.array(CandidateSchema),
  formatNote: z.string().describe("When format is auto or formats are explored: one sentence recommending a format and why. Otherwise empty."),
  question: z
    .string()
    .nullable()
    .describe("If the material is too thin to write something good, one useful question for the author. Otherwise null."),
});

export const AnglesSchema = z.object({
  angles: z.array(
    z.object({
      type: z.string().describe("observation, prediction, personal perspective, contrarian take, compressed insight, joke, question, ..."),
      title: z.string().describe("A 2-5 word name for the angle"),
      summary: z.string().describe("One sentence describing the approach"),
      preview: z.string().describe("One rough line showing what a post with this angle could sound like"),
    }),
  ),
  question: z.string().nullable(),
});

export const RefinedSchema = z.object({ candidate: CandidateSchema });

export const CritiqueSchema = z.object({
  verdict: z.enum(["ready", "needs-work", "needs-substance"]),
  coreThought: z.string().describe("The actual thought the author seems to be reaching for, in one plain sentence"),
  issues: z.array(
    z.object({
      type: z.string().describe("vague language, obvious conclusion, missing detail, no reason to keep reading, buried point, ..."),
      quote: z.string().describe("The exact words from the draft this applies to, or empty"),
      explanation: z.string(),
    }),
  ),
  question: z.string().nullable().describe("One question that would help the author find the substance, or null"),
});

export const DeAISchema = z.object({
  flags: z.array(
    z.object({
      quote: z.string().describe("Exact text from the post"),
      category: z.string(),
      why: z.string(),
      suggestion: z.string().describe("A cleaner replacement for just this part"),
    }),
  ),
  rewrite: z.string().describe("The full post with all fixes applied, same meaning and voice"),
});

export const StructureAnalysisSchema = z.object({
  hook: z.string(),
  context: z.string(),
  turn: z.string(),
  payoff: z.string(),
  name: z.string().describe("A short reusable name for the structure"),
  pattern: z.string().describe("Arrow notation like 'Setup → expectation → flip'"),
  whyItWorks: z.string(),
  steps: z.array(z.string()).describe("Generic, reusable steps that do not mention the post's topic"),
  qualities: z.array(z.string()).describe("Qualities worth admiring, e.g. 'hook names a specific number'"),
});

export const VoiceAnalysisSchema = z.object({
  summary: z.string().describe("Two sentences describing how this person writes"),
  archetype: z.string().describe("A playful 2-4 word archetype, e.g. 'The Dry Operator'"),
  signatureStructure: z.string(),
  writingHabits: z.object({
    sentenceLength: z.string(),
    vocabulary: z.string(),
    punctuation: z.string(),
    humor: z.string(),
    lineBreaks: z.string(),
    fragments: z.string(),
  }),
  postHabits: z.object({
    openings: z.array(z.string()),
    structures: z.array(z.string()),
    endings: z.array(z.string()),
    hashtags: z.string(),
    emojis: z.string(),
    callsToAction: z.string(),
  }),
  rules: z.array(z.string()).describe("Concrete do-rules a ghostwriter should follow"),
  avoid: z.array(z.string()).describe("Things this person never does"),
  sampleKinds: z
    .array(z.object({ index: z.number(), kind: z.string() }))
    .describe("For each sample by index: announcement, observation, opinion, story, reply, reaction, link, insight, joke"),
});

export const ProfileSuggestionSchema = z.object({
  addRules: z.array(z.string()),
  addAvoid: z.array(z.string()),
  removeRules: z.array(z.string()).describe("Existing rules (verbatim) that the evidence contradicts"),
  habitUpdates: z.array(
    z.object({
      field: z.enum(["sentenceLength", "vocabulary", "punctuation", "humor", "lineBreaks", "fragments"]),
      value: z.string(),
    }),
  ),
  notes: z.string().describe("A short plain-language explanation of what the feedback shows"),
});
