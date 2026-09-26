import { jsonError } from "@/lib/server/claude";
import { readJson } from "@/lib/server/request";

export const maxDuration = 60;

// Imports a user's recent original posts through the official X API when the
// deployment has an X_BEARER_TOKEN. Without one, the UI falls back to links/pasting.
export async function GET() {
  return Response.json({ available: !!process.env.X_BEARER_TOKEN });
}

export async function POST(request: Request) {
  try {
    const token = process.env.X_BEARER_TOKEN;
    if (!token) {
      return Response.json({ error: "Connecting X needs an X API token on the server (X_BEARER_TOKEN). Paste links or posts instead." }, { status: 501 });
    }
    const { username } = await readJson<{ username: string }>(request);
    const handle = String(username ?? "").replace(/^@/, "").trim();
    if (!/^\w{1,15}$/.test(handle)) return Response.json({ error: "Enter a valid X username." }, { status: 400 });
    const headers = { authorization: `Bearer ${token}` };
    const userRes = await fetch(`https://api.x.com/2/users/by/username/${handle}`, { headers });
    if (!userRes.ok) return Response.json({ error: `X API error ${userRes.status} looking up @${handle}.` }, { status: 502 });
    const user = (await userRes.json()) as { data?: { id: string } };
    if (!user.data) return Response.json({ error: `@${handle} wasn't found.` }, { status: 404 });
    const postsRes = await fetch(
      `https://api.x.com/2/users/${user.data.id}/tweets?max_results=100&exclude=retweets&tweet.fields=note_tweet,referenced_tweets`,
      { headers },
    );
    if (!postsRes.ok) return Response.json({ error: `X API error ${postsRes.status} reading posts.` }, { status: 502 });
    const posts = (await postsRes.json()) as {
      data?: { text: string; note_tweet?: { text: string }; referenced_tweets?: { type: string }[] }[];
    };
    const samples = (posts.data ?? []).map((p) => ({
      text: p.note_tweet?.text ?? p.text,
      kind: p.referenced_tweets?.some((r) => r.type === "replied_to") ? "reply" : undefined,
    }));
    return Response.json({ samples });
  } catch (error) {
    return jsonError(error);
  }
}
