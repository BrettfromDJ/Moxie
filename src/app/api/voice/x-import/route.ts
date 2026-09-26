import { jsonError } from "@/lib/server/claude";
import { readJson } from "@/lib/server/request";
import { getRecentPosts, getUser, parseHandle, xApiAvailable } from "@/lib/server/xapi";

export const maxDuration = 60;

// Imports a user's recent posts through the official X API when the deployment
// has an X_BEARER_TOKEN. Without one, the UI falls back to links/pasting.
export async function GET() {
  return Response.json({ available: xApiAvailable() });
}

export async function POST(request: Request) {
  try {
    const { username } = await readJson<{ username: string }>(request);
    const user = await getUser(parseHandle(username));
    const posts = await getRecentPosts(user.id, { originalsOnly: false });
    return Response.json({ samples: posts.map((p) => ({ text: p.text, kind: p.isReply ? "reply" : undefined })) });
  } catch (error) {
    return jsonError(error);
  }
}
