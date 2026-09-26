import { jsonError, structured } from "@/lib/server/claude";
import { mockVoice } from "@/lib/server/mock";
import { ANALYST_SYSTEM } from "@/lib/server/prompts";
import { readJson } from "@/lib/server/request";
import { VoiceAnalysisSchema } from "@/lib/server/schemas";

export const maxDuration = 300;

// Turns writing samples into an editable "Voice DNA" profile.
export async function POST(request: Request) {
  try {
    const { samples } = await readJson<{ samples: string[] }>(request);
    const clean = (Array.isArray(samples) ? samples : [])
      .map((s) => String(s).trim())
      .filter(Boolean)
      .slice(0, 150);
    if (clean.length < 3) {
      return Response.json({ error: "Add at least 3 posts you wrote so there's something to learn from." }, { status: 400 });
    }
    const out = await structured({
      job: "analyze",
      system: ANALYST_SYSTEM,
      schema: VoiceAnalysisSchema,
      mock: () => mockVoice(clean.length),
      content: [
        {
          type: "text",
          text: `<samples note="Posts written by one person">\n${clean
            .map((s, i) => `<sample index="${i}">${s.slice(0, 4000)}</sample>`)
            .join("\n")}\n</samples>

<task>
Build a "Voice DNA" profile a ghostwriter could use to write new posts that sound exactly like this person.
- writingHabits: sentence length, vocabulary, punctuation and capitalization, humor, line breaks, use of fragments. Be concrete and cite what you observed.
- postHabits: their typical openings, structures, and endings (as short reusable descriptions, not quotes), plus how they use hashtags, emoji, and calls to action.
- rules: concrete things to always do. avoid: things this person never does (phrases, formatting habits, rhetorical patterns).
- summary, a playful archetype, and their signature structure.
- sampleKinds: classify every sample by index.
Describe how they write, not what they write about.
</task>`,
        },
      ],
    });
    return Response.json(out);
  } catch (error) {
    return jsonError(error);
  }
}
