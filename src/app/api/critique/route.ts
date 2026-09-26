import { jsonError, structured } from "@/lib/server/claude";
import { mockCritique } from "@/lib/server/mock";
import { EDITOR_SYSTEM } from "@/lib/server/prompts";
import { readJson } from "@/lib/server/request";
import { CritiqueSchema } from "@/lib/server/schemas";

export const maxDuration = 120;

// "Help me find the actual thought": diagnose why a draft feels weak and, if it
// needs substance, ask one useful question instead of polishing sentences.
export async function POST(request: Request) {
  try {
    const { draft, context } = await readJson<{ draft: string; context?: string }>(request);
    if (!draft?.trim()) return Response.json({ error: "Write something first." }, { status: 400 });
    const out = await structured({
      job: "edit",
      system: EDITOR_SYSTEM,
      schema: CritiqueSchema,
      mock: mockCritique,
      content: [
        {
          type: "text",
          text: `${context ? `<reference note="What the author is responding to">\n${context.slice(0, 6000)}\n</reference>\n\n` : ""}<draft>\n${draft.slice(0, 10000)}\n</draft>

<task>
Diagnose this draft before anyone polishes it.
- Work out the actual thought the author is reaching for and state it plainly.
- List only the specific problems that matter: vague language, an obvious conclusion, missing detail, no reason to keep reading, a buried point, or claims with no support. Quote the exact words. Skip nitpicks.
- If the draft lacks substance (not just wording), ask ONE question that would help the author discover the idea, e.g. "What did you notice that surprised you?" Make it specific to this draft. Otherwise question is null.
- verdict: "ready" if it only needs light polish, "needs-work" if the thought is there but the writing hides it, "needs-substance" if the idea itself is not there yet.
</task>`,
        },
      ],
    });
    return Response.json(out);
  } catch (error) {
    return jsonError(error);
  }
}
