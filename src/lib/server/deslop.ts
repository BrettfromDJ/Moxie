import "server-only";
import { z } from "zod";
import { findSlop, mentions } from "../checks";
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

function problemsFor(c: Candidate, ctx: GenerationContext): string[] {
  const text = fullText(c);
  const out = findSlop(text, ctx.voice).map((h) => `${h.category}: “${h.quote}”`);
  for (const a of ctx.voice?.avoid ?? []) if (mentions(text, a)) out.push(`On the author's avoid list: “${a}”`);
  for (const f of ctx.feedback) if (f.kind === "never" && f.note && mentions(text, f.note)) out.push(`The author rejected this before: “${f.note}”`);
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
  const flagged = candidates
    .map((c, index) => ({ c, index, problems: problemsFor(c, ctx) }))
    .filter((x) => x.problems.length);
  if (!flagged.length) return candidates;

  const query = [ctx.thought, ctx.take].join("\n");
  const drafts = flagged
    .map(({ c, index, problems }) => {
      const body = c.thread.length ? c.thread.map((t, i) => `[${i + 1} ${t.role}] ${t.text}`).join("\n") : c.text;
      return `<draft index="${index}" format="${c.format}">\n${body}\n<problems>\n${problems.map((p) => `- ${p}`).join("\n")}\n</problems>\n</draft>`;
    })
    .join("\n\n");

  try {
    const out = await structured({
      job: "write",
      system: WRITER_SYSTEM,
      schema: RewritesSchema,
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

<task>
These drafts contain phrasing that reads as generated. Rewrite each one so it sounds like the author typed it: fix every listed problem, and anything else in the same family you notice. Rewrite the sentence around the problem rather than swapping in a synonym; often the fix is to say the thing plainly or cut it. Keep the point, the facts, the format, and roughly the same length. Keep every post under ${ctx.settings.charLimit} characters. Don't add new claims. Return every draft listed, by index.
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
