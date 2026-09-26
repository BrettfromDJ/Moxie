import type {
  Angle,
  ComposerSettings,
  Format,
  Goal,
  Length,
  PostType,
  Relationship,
  WritingMode,
} from "./types";
import { X_LIMIT } from "./xcount";

type Option<T> = { value: T; label: string; hint: string };

export const POST_TYPES: (Option<PostType> & { instruction: string })[] = [
  {
    value: "original",
    label: "Original post",
    hint: "Stands on its own",
    instruction:
      "Write an original post. It must establish its own context and communicate a complete thought to someone scrolling past with no background.",
  },
  {
    value: "quote",
    label: "Quote tweet",
    hint: "React to a visible source",
    instruction:
      "Write a quote tweet. The source post (role=target) is visible right above it, so never summarize or restate it. Add something the source does not have: a reaction, an implication, an argument, a joke, or new context.",
  },
  {
    value: "reply",
    label: "Reply",
    hint: "Join a conversation",
    instruction:
      "Write a reply to the target post. Speak naturally to its author as a person in the conversation, contribute something to the exchange, and keep it conversational rather than broadcast-style. Do not open by restating what they said.",
  },
  {
    value: "announcement",
    label: "Announcement",
    hint: "News and key details",
    instruction:
      "Write an announcement. Lead with the news itself, then the key details in a clear order (what, who it is for, when/where, how to get it). Keep hype low and specifics high.",
  },
  {
    value: "link",
    label: "Link post",
    hint: "Why the link matters",
    instruction:
      "Write a post that shares a link. Give readers a concrete reason to care about the linked material (the most surprising finding, the useful part, or why it matters now). Do not just describe the page.",
  },
  {
    value: "image",
    label: "Image post",
    hint: "Writing around an image",
    instruction:
      "Write a post that accompanies the attached image. Use what is actually visible in the image plus the supplied context; do not describe the image literally unless that is the point.",
  },
  {
    value: "remix",
    label: "Revisit / remix",
    hint: "Fresh take on an old post",
    instruction:
      "Revisit an existing post or idea (usually the target reference). Develop a fresh version: a new framing, a sharper point, or what the author has learned since. Do not paraphrase the original line by line.",
  },
];

export const FORMATS: (Option<Format> & { instruction: string })[] = [
  { value: "auto", label: "Auto", hint: "Recommend a format", instruction: "Choose the format that best fits the idea, and say briefly why in the rationale." },
  { value: "one-liner", label: "One-liner", hint: "A single line", instruction: "A single line. No line breaks." },
  { value: "short", label: "Short post", hint: "A few lines", instruction: "A short post: one to four short lines." },
  { value: "long", label: "Long-form", hint: "A long single post", instruction: "A long-form single post with paragraphs separated by blank lines." },
  { value: "thread", label: "Thread", hint: "Several connected posts", instruction: "A thread: several posts, each able to stand on its own, with roles hook/setup/insight/example/takeaway/close. The first post must make people want the rest." },
  { value: "list", label: "List", hint: "Parallel items", instruction: "A list post: a short framing line, then parallel, concrete items." },
  { value: "story", label: "Story", hint: "A moment that happened", instruction: "A story: a specific moment, told in order, ending on what it meant." },
  { value: "breakdown", label: "Breakdown", hint: "How something works", instruction: "A breakdown: explain how something works or why something happened, step by step." },
  { value: "hot-take", label: "Hot take", hint: "A sharp opinion", instruction: "A hot take: a strong, defensible opinion stated plainly with one reason. Not rage bait." },
  { value: "before-after", label: "Before / after", hint: "A change of mind", instruction: "A before-and-after post: what the author used to think or do, what changed, and what they do now." },
];

export const LENGTHS: (Option<Length> & { instruction: string })[] = [
  { value: "tight", label: "Tight", hint: "Minimum words", instruction: "Use as few words as the format allows. Cut anything non-essential." },
  { value: "standard", label: "Standard", hint: "Balanced", instruction: "Include the details that make the point land, nothing more." },
  { value: "detailed", label: "Detailed", hint: "More depth", instruction: "Include more supporting detail, examples, or steps within the format." },
];

export const ANGLES: (Option<Angle> & { instruction: string })[] = [
  { value: "auto", label: "Auto", hint: "Find the best angles", instruction: "Pick whatever angle makes the strongest post." },
  { value: "agree", label: "Agree", hint: "Build on it", instruction: "Agree with the source or premise, and build on it with something new rather than just endorsing it." },
  { value: "push-back", label: "Push back", hint: "Respectful disagreement", instruction: "Push back. Disagree clearly and specifically, with a reason, without being hostile." },
  { value: "add-context", label: "Add context", hint: "What's missing", instruction: "Add context the audience is missing: history, a mechanism, a caveat, or a relevant fact from the references." },
  { value: "funny", label: "Funny", hint: "Make it land as humor", instruction: "Make it funny in the author's style of humor. The joke must still say something." },
  { value: "insightful", label: "Insightful", hint: "The non-obvious point", instruction: "Find the non-obvious insight: an implication or pattern most people would miss." },
  { value: "custom", label: "Custom…", hint: "Your own direction", instruction: "" },
];

export const RELATIONSHIPS: (Option<Relationship> & { instruction: string })[] = [
  { value: "none", label: "Not specified", hint: "", instruction: "" },
  { value: "friend", label: "Friend", hint: "Casual, in-jokes ok", instruction: "The author knows this person well: casual, warm, teasing is fine." },
  { value: "peer", label: "Peer", hint: "Collegial", instruction: "The author is a peer in the same field: direct, collegial, can assume shared context." },
  { value: "stranger", label: "Stranger", hint: "Respectful, clear", instruction: "The author does not know this person: respectful, self-contained, no assumed familiarity." },
  { value: "customer", label: "Customer", hint: "Helpful, accountable", instruction: "This person is a customer of the author: helpful, accountable, specific about next steps, never defensive." },
];

export const GOALS: (Option<Goal> & { instruction: string })[] = [
  { value: "none", label: "No specific goal", hint: "", instruction: "" },
  { value: "reach", label: "Reach", hint: "Broad appeal", instruction: "Favor broad legibility: someone outside the author's niche should get it instantly." },
  { value: "replies", label: "Replies", hint: "Invite conversation", instruction: "Favor posts that invite genuine replies (an open question, a take people will want to add to) without begging for engagement." },
  { value: "clarity", label: "Clarity", hint: "Be understood", instruction: "Favor being understood exactly: plain words, one idea." },
  { value: "authority", label: "Authority", hint: "Show expertise", instruction: "Favor demonstrating expertise through specifics and earned detail, not credentials." },
];

export const MODES: (Option<WritingMode> & { instruction: string })[] = [
  { value: "balanced", label: "Balanced", hint: "", instruction: "" },
  { value: "punchier", label: "Punchier", hint: "", instruction: "Lean punchier: shorter sentences, stronger verbs, faster payoff." },
  { value: "experimental", label: "Experimental", hint: "", instruction: "Be experimental with form and framing while keeping the author's voice and facts intact." },
];

export function creativityInstruction(level: number): string {
  if (level <= 15)
    return "Light cleanup only. Keep the author's wording and structure; fix clarity, rhythm, and typos. Change as little as possible.";
  if (level <= 40)
    return "Tighten. Keep the author's framing and most of their exact phrases; cut, reorder, and sharpen, but it should still read as their sentence.";
  if (level <= 70)
    return "Rework. Keep the idea, the facts, and the author's best phrases; restructure freely. Don't swap their plain words for fancier ones.";
  return "Rethink the framing. Try new angles and structures for the same idea, still in the author's plain voice. Never change the facts or their position.";
}

export function creativityLabel(level: number): string {
  if (level <= 15) return "Clean up";
  if (level <= 40) return "Tighten";
  if (level <= 70) return "Rework";
  return "Rethink";
}

export const DEFAULT_SETTINGS: ComposerSettings = {
  postType: "original",
  format: "auto",
  length: "standard",
  angle: "auto",
  customAngle: "",
  creativity: 35,
  options: 3,
  goal: "none",
  relationship: "none",
  mode: "balanced",
  structureId: null,
  charLimit: X_LIMIT,
  provider: "anthropic",
};

export function labelFor<T extends string>(list: Option<T>[], value: T): string {
  return list.find((o) => o.value === value)?.label ?? value;
}
