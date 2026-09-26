import { jsonError, structured } from "@/lib/server/claude";
import { deslop } from "@/lib/server/deslop";
import { mockRefine } from "@/lib/server/mock";
import { WRITER_SYSTEM, buildRefine } from "@/lib/server/prompts";
import { normalizeContext, readJson, toCandidate } from "@/lib/server/request";
import { RefinedSchema } from "@/lib/server/schemas";
import type { Candidate, RefineAction, RefineRequest } from "@/lib/types";
import { xLength } from "@/lib/xcount";

export const maxDuration = 300;

const ACTIONS: RefineAction[] = ["fit", "shorten", "deai", "strengthen-hook", "pacing", "shorten-card", "custom"];

const overLimit = (c: Candidate, limit: number) =>
  c.thread.length ? c.thread.some((t) => xLength(t.text) > limit) : xLength(c.text) > limit;

export async function POST(request: Request) {
  try {
    const raw = await readJson<RefineRequest>(request);
    if (!raw.candidate) return Response.json({ error: "A candidate is required." }, { status: 400 });
    if (!ACTIONS.includes(raw.action)) return Response.json({ error: "Unknown action." }, { status: 400 });
    // Refinement works on the candidate itself, so an empty composer is fine.
    const body = normalizeContext({ ...raw, thought: raw.thought || " " });
    const job = body.action === "pacing" || body.action === "custom" || body.action === "strengthen-hook" ? "write" : "edit";

    const run = async (req: RefineRequest) =>
      toCandidate(
        (
          await structured({
            job,
            system: WRITER_SYSTEM,
            content: buildRefine(req),
            schema: RefinedSchema,
            provider: req.settings.provider,
            mock: () => ({ candidate: mockRefine(req.candidate, req.action) }),
          })
        ).candidate,
      );

    let result = await run(body);
    // Models are imprecise at counting characters: verify "Fit to X" and retry once with the real count.
    if (body.action === "fit" && overLimit(result, body.settings.charLimit)) {
      const counts = result.thread.length
        ? result.thread.map((t, i) => `post ${i + 1}: ${xLength(t.text)}`).join(", ")
        : `${xLength(result.text)}`;
      result = await run({
        ...body,
        candidate: result,
        action: "custom",
        instruction: `This is still over the ${body.settings.charLimit}-character limit (measured: ${counts}). Cut further so every post is under ${body.settings.charLimit - 10} characters, keeping the point intact.`,
      });
    }
    [result] = await deslop([result], body);
    return Response.json({
      candidate: { ...result, id: body.candidate.id },
      stillOver: overLimit(result, body.settings.charLimit),
    });
  } catch (error) {
    return jsonError(error);
  }
}
