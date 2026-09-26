import { jsonError, structured } from "@/lib/server/claude";
import { mockAngles, mockCandidates } from "@/lib/server/mock";
import { WRITER_SYSTEM, buildGenerate } from "@/lib/server/prompts";
import { newId, normalizeContext, readJson, toCandidate } from "@/lib/server/request";
import { AnglesSchema, CandidatesSchema } from "@/lib/server/schemas";
import type { GenerateMode, GenerateRequest, GenerateResponse } from "@/lib/types";

export const maxDuration = 300;

const MODES: GenerateMode[] = ["angles", "variations", "surprise", "directions", "formats", "more-like", "push"];

export async function POST(request: Request) {
  try {
    const body = normalizeContext(await readJson<GenerateRequest>(request));
    if (!MODES.includes(body.mode)) return Response.json({ error: "Unknown mode." }, { status: 400 });
    if ((body.mode === "more-like" || body.mode === "push") && !body.seed) {
      return Response.json({ error: "A seed candidate is required." }, { status: 400 });
    }
    const content = buildGenerate(body);

    if (body.mode === "angles") {
      const out = await structured({
        job: "write",
        system: WRITER_SYSTEM,
        content,
        schema: AnglesSchema,
        mock: mockAngles,
      });
      const res: GenerateResponse = {
        angles: out.angles.map((a) => ({ id: newId("a"), ...a })),
        question: out.question,
      };
      return Response.json(res);
    }

    const out = await structured({
      job: "write",
      system: WRITER_SYSTEM,
      content,
      schema: CandidatesSchema,
      mock: () => mockCandidates(body),
    });
    const res: GenerateResponse = {
      candidates: out.candidates.map(toCandidate),
      formatNote: out.formatNote || undefined,
      question: out.question,
    };
    return Response.json(res);
  } catch (error) {
    return jsonError(error);
  }
}
