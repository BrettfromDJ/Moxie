import type { FeedbackSignal, VoiceProfile } from "./types";

// Fast, deterministic checks that run in the browser on every result.
// The model-based "De-AI this" goes deeper; these catch the obvious stuff instantly.

export interface PatternHit {
  category: string;
  quote: string;
  why: string;
}

const AI_PATTERNS: { re: RegExp; category: string; why: string }[] = [
  { re: /\bit'?s not (just )?(about )?[^.,;\n]{1,40}[,;—–-]+\s*it'?s\b/i, category: "Forced contrast", why: "“It's not X, it's Y” is the most recognizable AI cadence." },
  { re: /\bnot (just )?[^.,;\n]{1,30}[,;—–-]+\s*but\b/i, category: "Forced contrast", why: "Setting up a strawman just to correct it reads templated." },
  { re: /\b(in today'?s|in an ever[- ]changing|fast[- ]paced) (world|landscape|digital age)\b/i, category: "Filler opener", why: "Generic scene-setting that says nothing." },
  { re: /\b(delve|tapestry|testament to|navigate the|realm of|unlock(ing)? the power|game[- ]changer|paradigm shift|leverage synerg)/i, category: "Cliché", why: "Vocabulary strongly associated with generated text." },
  { re: /\b(let that sink in|read that again|this is huge|here'?s the thing|buckle up|a thread 🧵)\b/i, category: "Engagement bait", why: "Stock phrases that signal a template instead of a thought." },
  { re: /\b(ultimately|in conclusion|at the end of the day|the bottom line is|all in all)\b/i, category: "Generic conclusion", why: "Wrap-up phrases that restate instead of adding." },
  { re: /\b(truly|incredibly|absolutely|genuinely|deeply|profoundly) (important|powerful|transformative|valuable)\b/i, category: "Filler intensifier", why: "Intensifiers that inflate without adding meaning." },
  { re: /\b(whether you'?re a|from [a-z]+ to [a-z]+, )/i, category: "Audience hedge", why: "Trying to address everyone addresses no one." },
  { re: /(?:^|\n)\s*(?:[-•]\s*)?[A-Z][^.\n]{0,40}:\s*[A-Z][^.\n]{0,40}\.\s*(?:\n|$)(?:\s*(?:[-•]\s*)?[A-Z][^.\n]{0,40}:\s*[A-Z][^.\n]{0,40}\.\s*(?:\n|$)){2,}/, category: "Template list", why: "Repeated “Label: phrase.” lines read machine-formatted." },
  { re: /—.*—.*—/s, category: "Em dash overuse", why: "Three or more em dashes in a short post is a common tell." },
];

export function findAIPatterns(text: string): PatternHit[] {
  const hits: PatternHit[] = [];
  for (const p of AI_PATTERNS) {
    const m = text.match(p.re);
    if (m) hits.push({ category: p.category, quote: m[0].trim().slice(0, 80), why: p.why });
  }
  return hits;
}

export interface RuleCheck {
  ok: boolean;
  label: string;
  detail?: string;
}

function mentions(text: string, phrase: string): boolean {
  const p = phrase.trim().replace(/^["'“”]+|["'“”]+$/g, "");
  if (p.length < 3 || p.split(/\s+/).length > 6) return false; // only check literal, phrase-like rules
  return text.toLowerCase().includes(p.toLowerCase());
}

export function checkVoiceRules(
  text: string,
  voice: VoiceProfile | null,
  feedback: FeedbackSignal[],
): RuleCheck[] {
  const checks: RuleCheck[] = [];
  if (voice) {
    const broken = voice.avoid.filter((a) => mentions(text, a));
    checks.push(
      broken.length
        ? { ok: false, label: "Avoid list", detail: `Uses: ${broken.join(", ")}` }
        : { ok: true, label: "Avoid list" },
    );
    const hashtags = (text.match(/(^|\s)#\w+/g) ?? []).length;
    if (/never|no |rarely|avoid/i.test(voice.postHabits.hashtags) && hashtags > 0) {
      checks.push({ ok: false, label: "Hashtags", detail: `${hashtags} hashtag(s); you rarely use them` });
    }
    const emojis = (text.match(/\p{Extended_Pictographic}/gu) ?? []).length;
    if (/never|no |rarely|avoid/i.test(voice.postHabits.emojis) && emojis > 0) {
      checks.push({ ok: false, label: "Emoji", detail: `${emojis} emoji; you rarely use them` });
    }
  }
  const rejected = feedback.filter((f) => f.kind === "never" && f.note).map((f) => f.note!);
  const hitRejected = rejected.filter((r) => mentions(text, r));
  if (hitRejected.length) {
    checks.push({ ok: false, label: "Rejected before", detail: hitRejected.join(", ") });
  }
  const ai = findAIPatterns(text);
  checks.push(
    ai.length
      ? { ok: false, label: "AI patterns", detail: ai.map((h) => h.category).join(", ") }
      : { ok: true, label: "No AI patterns" },
  );
  return checks;
}
