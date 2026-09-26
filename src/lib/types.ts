// Shared types used by both the browser app and the API routes.

export type PostType =
  | "original"
  | "quote"
  | "reply"
  | "announcement"
  | "link"
  | "image"
  | "remix";

export type Format =
  | "auto"
  | "one-liner"
  | "short"
  | "long"
  | "thread"
  | "list"
  | "story"
  | "breakdown"
  | "hot-take"
  | "before-after";

export type Length = "tight" | "standard" | "detailed";

export type Angle =
  | "auto"
  | "agree"
  | "push-back"
  | "add-context"
  | "funny"
  | "insightful"
  | "custom";

export type Relationship = "none" | "friend" | "peer" | "stranger" | "customer";

export type Goal = "none" | "reach" | "replies" | "clarity" | "authority";

export type WritingMode = "balanced" | "punchier" | "experimental";

export interface ComposerSettings {
  postType: PostType;
  format: Format;
  length: Length;
  angle: Angle;
  customAngle: string;
  creativity: number; // 0-100
  options: number; // 1-6
  goal: Goal;
  relationship: Relationship;
  mode: WritingMode;
  structureId: string | null;
  charLimit: number; // 280 standard, 25000 premium
}

// ---------- References ----------

export type RefRole = "target" | "facts" | "style" | "context";
export type RefKind = "x-post" | "article" | "page" | "text" | "image";
export type RefStatus = "loading" | "ready" | "failed";

export interface Reference {
  id: string; // stable internal id, never shown to the model as an instruction
  tag: string; // without the "@"
  kind: RefKind;
  role: RefRole;
  status: RefStatus;
  url?: string;
  author?: string;
  title?: string;
  text?: string;
  excerpt?: string;
  parentTag?: string; // "this post replies to @parentTag"
  image?: { dataUrl: string; mediaType: string };
  error?: string;
}

// ---------- Voice & taste ----------

export interface Sample {
  id: string;
  text: string;
  kind?: string; // announcement, observation, opinion, story, ...
  source: "pasted" | "link" | "x" | "posted" | "edit";
}

export interface WritingHabits {
  sentenceLength: string;
  vocabulary: string;
  punctuation: string;
  humor: string;
  lineBreaks: string;
  fragments: string;
}

export interface PostHabits {
  openings: string[];
  structures: string[];
  endings: string[];
  hashtags: string;
  emojis: string;
  callsToAction: string;
}

export interface VoiceProfile {
  id: string;
  name: string;
  summary: string;
  archetype: string;
  signatureStructure: string;
  writingHabits: WritingHabits;
  postHabits: PostHabits;
  rules: string[]; // things to do
  avoid: string[]; // things never to do
  samples: Sample[];
  updatedAt: number;
}

export interface AdmiredPost {
  id: string;
  text: string;
  author?: string;
  qualities: string[]; // what the user admires about it
}

export interface TasteProfile {
  admired: AdmiredPost[];
  qualities: string[]; // general things the user considers good writing
}

export type FeedbackKind = "more" | "never" | "edit" | "posted";

export interface FeedbackSignal {
  id: string;
  kind: FeedbackKind;
  text: string;
  editedText?: string;
  note?: string;
  at: number;
}

// ---------- Structures ----------

export interface Structure {
  id: string;
  name: string;
  pattern: string; // "Setup → expectation → flip"
  description: string;
  steps: string[];
  example?: string;
  custom?: boolean;
}

// ---------- Generation ----------

export type CardRole =
  | "hook"
  | "setup"
  | "insight"
  | "example"
  | "takeaway"
  | "close"
  | "other";

export interface ThreadCard {
  id: string;
  role: CardRole;
  text: string;
}

export interface AngleOption {
  id: string;
  type: string;
  title: string;
  summary: string;
  preview: string;
}

export type VoiceMatch = "strong" | "partial" | "weak";

export interface Candidate {
  id: string;
  angle: string;
  structure: string;
  format: Format;
  text: string; // single post body ("" when it is a thread)
  thread: ThreadCard[]; // [] when it is a single post
  rationale: string;
  voiceMatch: VoiceMatch;
  voiceNote: string;
}

export interface ResolvedReference {
  tag: string;
  role: RefRole;
  kind: RefKind;
  author?: string;
  title?: string;
  url?: string;
  text?: string;
  parentTag?: string;
  image?: { dataUrl: string; mediaType: string };
}

export interface GenerationContext {
  settings: ComposerSettings;
  thought: string;
  take: string;
  references: ResolvedReference[];
  voice: VoiceProfile | null;
  taste: TasteProfile | null;
  feedback: FeedbackSignal[];
  structure: Structure | null;
}

export type GenerateMode =
  | "angles" // propose distinct angles first
  | "variations" // write candidates (optionally for a chosen angle)
  | "surprise" // skip angle selection, less obvious responses
  | "directions" // N completely different directions
  | "formats" // same idea as one-liner / short / long / thread
  | "more-like" // close siblings of a candidate
  | "push"; // push a candidate further

export interface GenerateRequest extends GenerationContext {
  mode: GenerateMode;
  chosenAngle?: AngleOption | null;
  seed?: Candidate | null;
}

export interface GenerateResponse {
  angles?: AngleOption[];
  candidates?: Candidate[];
  formatNote?: string;
  question?: string | null;
}

export type RefineAction =
  | "fit"
  | "shorten"
  | "deai"
  | "strengthen-hook"
  | "pacing"
  | "shorten-card"
  | "custom";

export interface RefineRequest extends GenerationContext {
  action: RefineAction;
  candidate: Candidate;
  cardId?: string;
  instruction?: string;
}

export interface Critique {
  verdict: "ready" | "needs-work" | "needs-substance";
  coreThought: string;
  issues: { type: string; quote: string; explanation: string }[];
  question: string | null;
}

export interface DeAIFlag {
  quote: string;
  category: string;
  why: string;
  suggestion: string;
}

export interface DeAIResult {
  flags: DeAIFlag[];
  rewrite: string;
}

export interface StructureAnalysis {
  hook: string;
  context: string;
  turn: string;
  payoff: string;
  name: string;
  pattern: string;
  whyItWorks: string;
  steps: string[];
  qualities: string[];
}

export interface ProfileSuggestion {
  addRules: string[];
  addAvoid: string[];
  removeRules: string[];
  habitUpdates: { field: string; value: string }[];
  notes: string;
}
