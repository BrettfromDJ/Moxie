import { jsonError, structured } from "@/lib/server/claude";
import { mockDeAI } from "@/lib/server/mock";
import { EDITOR_SYSTEM } from "@/lib/server/prompts";
import { readJson } from "@/lib/server/request";
import { DeAISchema } from "@/lib/server/schemas";

export const maxDuration = 120;

// "De-AI this": works standalone (no profile needed) so it can be a free, shareable tool.
export async function POST(request: Request) {
  try {
    const { text, avoid = [], rejected = [] } = await readJson<{
      text: string;
      avoid?: string[];
      rejected?: string[];
    }>(request);
    if (!text?.trim()) return Response.json({ error: "Paste a post first." }, { status: 400 });
    const personal = [...avoid, ...rejected].slice(0, 40);
    const out = await structured({
      job: "edit",
      system: EDITOR_SYSTEM,
      schema: DeAISchema,
      mock: () => mockDeAI(text),
      content: [
        {
          type: "text",
          text: `<post>\n${text.slice(0, 10000)}\n</post>
${personal.length ? `\n<author_dislikes>\n${personal.map((p) => `- ${p}`).join("\n")}\n</author_dislikes>\n` : ""}
<task>
Flag everything in this post that reads as generic or machine-written:
- forced contrasts ("It's not X, it's Y", "not just X but Y")
- filler and throat-clearing, scene-setting openers
- generic conclusions that restate instead of adding
- clichés and stock vocabulary (delve, tapestry, game-changer, unlock, landscape, testament)
- engagement bait, stacked em dashes, rule-of-three padding, empty intensifiers
- anything in the author's dislikes list
Quote the exact text for each flag and suggest a cleaner replacement for just that part. Only flag real problems; a clean post can have zero flags.
Then give the full rewrite with every fix applied. Keep the meaning, the facts, the format, and the author's voice. Do not add new claims.
</task>`,
        },
      ],
    });
    return Response.json(out);
  } catch (error) {
    return jsonError(error);
  }
}
