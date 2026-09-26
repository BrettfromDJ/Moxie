import "server-only";
import type { z } from "zod";
import type {
  AnglesSchema,
  CandidateSchema,
  CandidatesSchema,
  CritiqueSchema,
  DeAISchema,
  ProfileSuggestionSchema,
  StructureAnalysisSchema,
  VoiceAnalysisSchema,
} from "./schemas";
import type { Candidate, GenerateRequest } from "../types";

// Canned responses for MOXIE_MOCK=1, so the whole UI can be exercised without an API key.

type C = z.infer<typeof CandidateSchema>;

const topic = (s: string) => s.trim().split(/\s+/).slice(0, 6).join(" ") || "this idea";

export function mockCandidates(req: GenerateRequest): z.infer<typeof CandidatesSchema> {
  const t = topic(req.thought || req.take);
  const n = req.mode === "formats" ? 4 : req.settings.options;
  const formats = ["one-liner", "short", "long", "thread"] as const;
  const candidates: C[] = Array.from({ length: n }, (_, i) => {
    const format =
      req.mode === "formats"
        ? formats[i]
        : req.settings.format === "auto"
          ? i === n - 1 && n > 2
            ? "thread"
            : "short"
          : req.settings.format;
    const thread = format === "thread";
    return {
      angle: req.chosenAngle?.title ?? ["Observation", "Contrarian", "Compressed insight", "Prediction", "Personal", "Joke"][i % 6],
      structure: ["Setup → expectation → flip", "Specific → broad", "Then → now → so", "One line"][i % 4],
      format,
      text: thread
        ? ""
        : format === "one-liner"
          ? `${t}, but nobody wants to say it out loud.`
          : `(mock ${req.mode} ${i + 1}) Everyone thinks ${t} is the hard part.\n\nIt isn't. The hard part is deciding what you'd stop doing to make room for it.`,
      thread: thread
        ? [
            { role: "hook", text: `I spent a month on ${t}. Here's what surprised me:` },
            { role: "setup", text: "I expected the tools to be the bottleneck. They weren't." },
            { role: "insight", text: "The bottleneck was that nobody had agreed what 'done' looked like." },
            { role: "example", text: "One team shipped in a week once they wrote a single sentence describing the finish line." },
            { role: "close", text: "Write the finish line first. Everything else gets easier." },
          ]
        : [],
      rationale: "Leads with a familiar belief and turns it, which fits how you usually open.",
      voiceMatch: (["strong", "partial", "strong"] as const)[i % 3],
      voiceNote: "Short declaratives, no hashtags, dry close.",
    };
  });
  return {
    candidates,
    formatNote:
      req.mode === "formats" || req.settings.format === "auto"
        ? "A short post fits best: the idea is one turn, and a thread would pad it."
        : "",
    question: req.thought.trim().length < 20 ? "What did you notice that surprised you?" : null,
  };
}

export function mockAngles(): z.infer<typeof AnglesSchema> {
  return {
    angles: [
      { type: "observation", title: "The quiet pattern", summary: "Point out a pattern people see but haven't named.", preview: "Every team I've watched does this and nobody talks about it." },
      { type: "contrarian", title: "The unpopular read", summary: "Argue the common advice gets it backwards.", preview: "The standard advice is wrong, and here's the tell." },
      { type: "prediction", title: "Where this goes", summary: "Extrapolate one step further than anyone is.", preview: "In two years this will look obvious." },
      { type: "personal perspective", title: "What it cost me", summary: "Anchor the point in a specific experience.", preview: "I learned this the expensive way." },
      { type: "compressed insight", title: "One line", summary: "Distill it to a single quotable sentence.", preview: "Speed is a decision, not a skill." },
    ],
    question: null,
  };
}

export function mockRefine(c: Candidate, action: string): z.infer<typeof CandidateSchema> {
  const shorten = (s: string) => s.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ");
  return {
    angle: c.angle,
    structure: c.structure,
    format: c.format === "auto" ? "short" : c.format,
    text: c.text ? (action === "strengthen-hook" ? `Hot take: ${c.text}` : shorten(c.text)) : "",
    thread: c.thread.map(({ role, text }, i) => ({
      role,
      text: action === "strengthen-hook" && i === 0 ? `Nobody tells you this about the work: ${text}` : shorten(text),
    })),
    rationale: `Refined (${action}).`,
    voiceMatch: "strong",
    voiceNote: "Tighter, same voice.",
  };
}

export const mockCritique = (): z.infer<typeof CritiqueSchema> => ({
  verdict: "needs-substance",
  coreThought: "You seem to be saying that the obvious bottleneck isn't the real one.",
  issues: [
    { type: "Vague language", quote: "things are changing", explanation: "Which things, and how? A reader can't picture it." },
    { type: "Obvious conclusion", quote: "", explanation: "The ending is something most readers already believe, so there's no reason to share it." },
  ],
  question: "What did you notice that surprised you?",
});

export const mockDeAI = (text: string): z.infer<typeof DeAISchema> => ({
  flags: [
    { quote: text.slice(0, 30), category: "Forced contrast", why: "Sets up a strawman to knock down.", suggestion: "State the point directly." },
  ],
  rewrite: text.replace(/it'?s not [^,]+, it'?s/i, "It's").replace(/\s*—\s*/g, ". "),
});

export const mockStructure = (): z.infer<typeof StructureAnalysisSchema> => ({
  hook: "Opens with a number and a confession.",
  context: "One line of background that makes the stakes clear.",
  turn: "Reveals the cause was the opposite of what you'd assume.",
  payoff: "A short rule the reader can steal.",
  name: "Confession → reversal → rule",
  pattern: "Admit → subvert → prescribe",
  whyItWorks: "The confession buys trust, the reversal creates surprise, and the rule makes it saveable.",
  steps: ["Admit a specific mistake with a number", "Reveal the unexpected cause", "Turn it into a one-line rule"],
  qualities: ["Specific number in the hook", "No wasted words before the turn"],
});

export const mockVoice = (count: number): z.infer<typeof VoiceAnalysisSchema> => ({
  summary: "Writes short, dry declaratives and lets the last line do the work. Rarely explains the joke.",
  archetype: "The Dry Operator",
  signatureStructure: "Observation → quiet reversal",
  writingHabits: {
    sentenceLength: "Short: 6-10 words on average, with one longer sentence per post",
    vocabulary: "Plain, concrete, operator vocabulary; no jargon",
    punctuation: "Sentence case, periods, almost no exclamation marks",
    humor: "Deadpan understatement",
    lineBreaks: "A blank line before the final beat",
    fragments: "Uses fragments for emphasis at the end",
  },
  postHabits: {
    openings: ["A blunt observation", "\"Most people…\""],
    structures: ["Observation → reversal", "Short list with a twist"],
    endings: ["A short fragment", "A dry understatement"],
    hashtags: "Never uses hashtags",
    emojis: "Rarely uses emoji",
    callsToAction: "No calls to action",
  },
  rules: ["Lead with the claim", "End on the shortest sentence"],
  avoid: ["game-changer", "Exclamation marks", "Thread emoji"],
  sampleKinds: Array.from({ length: count }, (_, i) => ({ index: i, kind: ["observation", "opinion", "announcement"][i % 3] })),
});

export const mockSuggestion = (): z.infer<typeof ProfileSuggestionSchema> => ({
  addRules: ["Prefer concrete numbers over adjectives"],
  addAvoid: ["Rhetorical questions as openers"],
  removeRules: [],
  habitUpdates: [{ field: "lineBreaks", value: "One idea per line, blank line before the close" }],
  notes: "You kept cutting rhetorical openers and adding specific numbers in your edits.",
});

export const mockBlueprint = () => ({
  summary: "Leads with one concrete, slightly uncomfortable observation and stops as soon as it lands. No setup, no moral.",
  signatureMoves: [
    "Anchor the post in one specific number or moment from their own work",
    "State the claim in the first line with no warm-up",
    "Use one short aside in parentheses to sound candid",
    "End on a concrete detail instead of a lesson",
  ],
  hooks: ["A blunt first-person admission", "A surprising number with no context"],
  structures: [
    { name: "Admission → detail", pattern: "Admit it → the detail that proves it", description: "Confess something, then back it with one concrete detail." },
    { name: "Before / after, no moral", pattern: "What I did → what I do now", description: "Show a change of practice and let the reader infer why." },
  ],
  rhythm: "Mostly lowercase, 1-3 short lines, periods over commas, never hashtags or emoji.",
  topics: ["building products", "hiring", "small teams"],
  avoid: ["Threads", "Motivational wrap-ups", "Questions to the audience"],
});

export const mockInspirationPosts = () => [
  { text: "we shipped 11 features last quarter. customers noticed 2 of them.", likes: 4200 },
  { text: "hired someone who asked more questions in the interview than we did. best hire of the year", likes: 3100 },
  { text: "our roadmap had 40 items in january. it has 6 now. revenue is up", likes: 2800 },
  { text: "stopped doing weekly status meetings. nothing broke (one thing got slightly worse)", likes: 1900 },
  { text: "the best onboarding flow we ever built was a 4 minute loom from the founder", likes: 1500 },
];
