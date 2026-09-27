import "server-only";
import { z } from "zod";
import { findSlop, mentions } from "../checks";
import { mostSimilar } from "../retrieval";
import type { Candidate, CardRole, GenerationContext } from "../types";
import { structured } from "./claude";
import { WRITER_SYSTEM, voiceBlock } from "./prompts";
import { newId } from "./request";

// Second pass that catches "AI slop" before the author sees it: every draft is
// checked for generated-text patterns, the author's avoid list, and phrasings
// they rejected before. Only drafts with problems are sent back, once, with the
// exact offending phrases.

const RewritesSchema = z.object({
  rewrites: z.array(
    z.object({
      index: z.number(),
      text: z.string().describe("The rewritten single post, or empty for a thread"),
      thread: z
        .array(z.object({ role: z.enum(["hook", "setup", "insight", "example", "takeaway", "close", "other"]), text: z.string() }))
        .describe("The rewritten thread posts, or empty for a single post"),
    }),
  ),
});

const fullText = (c: Candidate) => (c.thread.length ? c.thread.map((t) => t.text).join("\n\n") : c.text);

// Openers: the first line is where drafts most often echo the author's own
// message back at them, and where a set of candidates collapses into one.
const STOP = new Set("a an and are as at be but by for from has have he i in is it its it's of on or so that the their them they this to was we what with you".split(" "));
function words(text: string): string[] {
  return text.toLowerCase().replace(/[’']/g, "").replace(/out ?loud/g, "outloud").split(/[^\p{L}\p{N}]+/u).filter((w) => w && !STOP.has(w));
}
function stem(w: string): string {
  return w.replace(/(ing|ed|es|s)$/, "") || w;
}
// Share of the shorter text's content words that also appear in the longer one.
function overlap(a: string, b: string): number {
  const A = new Set(words(a).map(stem));
  const B = new Set(words(b).map(stem));
  if (Math.min(A.size, B.size) < 3) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / Math.min(A.size, B.size);
}
function firstLine(c: Candidate): string {
  const t = (c.thread.length ? c.thread[0].text : c.text).trim();
  return (t.split(/\n|(?<=[.!?])\s/)[0] ?? "").trim();
}
function openingWords(line: string): string {
  return line.toLowerCase().replace(/[’']/g, "").split(/\s+/).slice(0, 3).join(" ");
}

function openerProblems(candidates: Candidate[], ctx: GenerationContext): string[][] {
  const out = candidates.map(() => [] as string[]);
  // At "clean up" and "tighten" the author's message is the draft, so echoing it is the point.
  const echoCheck = ctx.settings.creativity > 40;
  const author = [ctx.thought, ctx.take].map((t) => t.trim()).filter(Boolean);
  const firsts = candidates.map(firstLine);
  firsts.forEach((line, i) => {
    if (!line) return;
    if (echoCheck && author.some((a) => overlap(line, a) >= 0.6))
      out[i].push(`Opener restates the author's own message: “${line}”. They already said that. Open with something that adds to it (the specific detail, an example, what follows), not a reworded version of it.`);
    for (let j = 0; j < i; j++) {
      if (!firsts[j]) continue;
      if (openingWords(line) === openingWords(firsts[j]) || overlap(line, firsts[j]) >= 0.6) {
        out[i].push(`Opens the same way as another draft (“${firsts[j]}”). Give this one a different first line and a different opening shape.`);
        break;
      }
    }
  });
  return out;
}

function problemsFor(c: Candidate, ctx: GenerationContext, extra: string[] = []): string[] {
  const text = fullText(c);
  const out = findSlop(text, ctx.voice).map((h) => `${h.category}: “${h.quote}”`);
  out.push(...extra);
  for (const a of ctx.voice?.avoid ?? []) if (mentions(text, a)) out.push(`On the author's avoid list: “${a}”`);
  for (const f of ctx.feedback) if (f.kind === "never" && f.note && mentions(text, f.note)) out.push(`The author rejected this before: “${f.note}”`);
  // Learning from an inspiration must never turn into copying them.
  for (const i of ctx.taste?.inspirations ?? []) {
    const m = mostSimilar(text, i.posts.map((p) => p.text));
    if (m && m.score >= 0.2) out.push(`Too close to a real post by ${i.handle ? `@${i.handle}` : i.name}: “${m.text.slice(0, 120)}”. Keep the technique, change the words.`);
  }
  return out;
}

// Rough stand-in used by MOXIE_MOCK so the flow is exercisable without an API key.
function mockRewrite(text: string): string {
  return text
    .replace(/Everyone thinks (.+?) is the hard part\.\s*It isn't\.\s*/i, "$1 wasn't the hard part for us. ")
    .replace(/\s*—\s*/g, ". ")
    .replace(/,? but nobody wants to say it out loud\./i, ". Took me a while to admit it.");
}

export async function deslop(candidates: Candidate[], ctx: GenerationContext): Promise<Candidate[]> {
  const openers = openerProblems(candidates, ctx);
  const flagged = candidates
    .map((c, index) => ({ c, index, problems: problemsFor(c, ctx, openers[index]) }))
    .filter((x) => x.problems.length);
  if (!flagged.length) return candidates;

  const query = [ctx.thought, ctx.take].join("\n");
  const drafts = flagged
    .map(({ c, index, problems }) => {
      const body = c.thread.length ? c.thread.map((t, i) => `[${i + 1} ${t.role}] ${t.text}`).join("\n") : c.text;
      return `<draft index="${index}" format="${c.format}">\n${body}\n<problems>\n${problems.map((p) => `- ${p}`).join("\n")}\n</problems>\n</draft>`;
    })
    .join("\n\n");
  const others = candidates
    .map(firstLine)
    .filter(Boolean)
    .map((l) => `- ${l}`)
    .join("\n");

  try {
    const out = await structured({
      job: "write",
      system: WRITER_SYSTEM,
      schema: RewritesSchema,
      provider: ctx.settings.provider,
      mock: () => ({
        rewrites: flagged.map(({ c, index }) => ({
          index,
          text: c.thread.length ? "" : mockRewrite(c.text),
          thread: c.thread.map((t) => ({ role: t.role, text: mockRewrite(t.text) })),
        })),
      }),
      content: [
        {
          type: "text",
          text: `${voiceBlock(ctx.voice, query, ctx.settings.postType)}

${drafts}

<other_openers note="First lines of every draft in this set">
${others}
</other_openers>

<task>
These drafts contain phrasing that reads as generated. Rewrite each one so it sounds like the author typed it: fix every listed problem, and anything else in the same family you notice. Rewrite the sentence around the problem rather than swapping in a synonym; often the fix is to say the thing plainly or cut it. Keep the point, the facts, the format, and roughly the same length. A rewritten opener must not match any line in <other_openers> either. Keep every post under ${ctx.settings.charLimit} characters. Don't add new claims. Return every draft listed, by index.
</task>`,
        },
      ],
    });
    const byIndex = new Map(out.rewrites.map((r) => [r.index, r]));
    return candidates.map((c, i) => {
      const r = byIndex.get(i);
      if (!r) return c;
      if (c.thread.length) {
        if (!r.thread.length) return c;
        return { ...c, thread: r.thread.map((t) => ({ id: newId("t"), role: t.role as CardRole, text: t.text })) };
      }
      return r.text.trim() ? { ...c, text: r.text } : c;
    });
  } catch (error) {
    // The first drafts are still usable; the card will show what's wrong.
    console.error("deslop pass failed", error);
    return candidates;
  }
}
