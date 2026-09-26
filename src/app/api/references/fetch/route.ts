import { jsonError } from "@/lib/server/claude";
import { extract } from "@/lib/server/extract";
import { readJson } from "@/lib/server/request";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { url } = await readJson<{ url: string }>(request);
    if (!url) return Response.json({ error: "A URL is required." }, { status: 400 });
    return Response.json(await extract(url));
  } catch (error) {
    return jsonError(error);
  }
}
