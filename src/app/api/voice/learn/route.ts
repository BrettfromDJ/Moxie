import { jsonError, structured } from "@/lib/server/claude";
import { mockSuggestion } from "@/lib/server/mock";
import { ANALYST_SYSTEM } from "@/lib/server/prompts";
import { readJson } from "@/lib/server/request";
import { ProfileSuggestionSchema } from "@/lib/server/schemas";
import type { FeedbackSignal, VoiceProfile } from "@/lib/types";

export const maxDuration = 300;

// Proposes profile updates from accumulated choices, rejections, and edits.
// Nothing is applied automatically: the user reviews every suggested change.
export async function POST(request: Request) {
  try {
    const { voice, feedback } = await readJson<{ voice: VoiceProfile; feedback: FeedbackSignal[] }>(request);
    if (!voice) return Response.json({ error: "Create a voice profile first." }, { status: 400 });
    const signals = (feedback ?? []).slice(-60);
    if (signals.length < 3) {
      return Response.json({ error: "Not enough feedback yet. Use More like this, Never like this, or edit a few results first." }, { status: 400 });
    }
    const out = await structured({
      job: "analyze",
      system: ANALYST_SYSTEM,
      schema: ProfileSuggestionSchema,
      mock: mockSuggestion,
      content: [
        {
          type: "text",
          text: `<current_profile>
Summary: ${voice.summary}
Habits: ${JSON.stringify(voice.writingHabits)}
Rules: ${JSON.stringify(voice.rules)}
Avoid: ${JSON.stringify(voice.avoid)}
</current_profile>

<feedback>
${signals
  .map((f) => {
    if (f.kind === "edit") return `<edit>\n<before>${f.text}</before>\n<after>${f.editedText ?? ""}</after>\n</edit>`;
    if (f.kind === "never") return `<rejected${f.note ? ` reason="${f.note.replace(/"/g, "'")}"` : ""}>${f.text}</rejected>`;
    if (f.kind === "more") return `<liked>${f.text}</liked>`;
    return `<posted>${f.text}</posted>`;
  })
  .join("\n")}
</feedback>

<task>
Compare what this person chose, rejected, posted, and how they edited drafts against their current profile. Propose only changes that the evidence clearly supports (a pattern seen more than once, or an explicit rejection reason). Rules and avoid entries must be concrete and checkable. Do not duplicate existing rules. Leave lists empty when there is nothing well supported.
</task>`,
        },
      ],
    });
    return Response.json(out);
  } catch (error) {
    return jsonError(error);
  }
}
