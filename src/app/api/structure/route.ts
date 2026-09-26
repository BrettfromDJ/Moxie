import { jsonError, structured } from "@/lib/server/claude";
import { mockStructure } from "@/lib/server/mock";
import { ANALYST_SYSTEM } from "@/lib/server/prompts";
import { readJson } from "@/lib/server/request";
import { StructureAnalysisSchema } from "@/lib/server/schemas";

export const maxDuration = 120;

// Breaks an admired post into hook / context / turn / payoff and extracts a
// reusable mechanic that can be applied to new material without its wording.
export async function POST(request: Request) {
  try {
    const { text } = await readJson<{ text: string }>(request);
    if (!text?.trim()) return Response.json({ error: "Paste a post first." }, { status: 400 });
    const out = await structured({
      job: "analyze",
      system: ANALYST_SYSTEM,
      schema: StructureAnalysisSchema,
      mock: mockStructure,
      content: [
        {
          type: "text",
          text: `<post>\n${text.slice(0, 10000)}\n</post>

<task>
Explain how this post works as writing.
- hook: what the opening does to earn attention
- context: what background it gives, and how briefly
- turn: where and how it shifts or surprises
- payoff: what the reader walks away with
Then extract the reusable mechanic: a short name, an arrow pattern like "Setup → expectation → flip", why it works, and generic steps that someone could apply to a completely different topic. The steps must not mention this post's topic or reuse its phrases. Finally list the specific qualities worth admiring.
</task>`,
        },
      ],
    });
    return Response.json(out);
  } catch (error) {
    return jsonError(error);
  }
}
