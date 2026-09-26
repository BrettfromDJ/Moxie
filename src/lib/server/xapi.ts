import "server-only";
import { AppError } from "./claude";

// Thin wrapper over the official X API v2 (needs X_BEARER_TOKEN).
// Reading posts is billed per post on X's pay-per-use plan.

export const xApiAvailable = () => !!process.env.X_BEARER_TOKEN;

export function parseHandle(input: string): string {
  const raw = String(input ?? "").trim();
  const fromUrl = raw.match(/(?:x|twitter)\.com\/(@?\w{1,15})/i)?.[1];
  const handle = (fromUrl ?? raw).replace(/^@/, "");
  if (!/^\w{1,15}$/.test(handle)) throw new AppError(400, "Enter a valid X username, like @naval or x.com/naval.");
  return handle;
}

async function xGet<T>(path: string): Promise<T> {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) throw new AppError(501, "Reading X profiles needs an X API token on the server (X_BEARER_TOKEN). Paste their posts instead.");
  const res = await fetch(`https://api.x.com/2${path}`, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 401) throw new AppError(502, "X rejected the API token (401). Check X_BEARER_TOKEN.");
  if (res.status === 402 || res.status === 403) throw new AppError(502, `X refused the request (${res.status}). Check your X API credits and spend cap.`);
  if (res.status === 429) throw new AppError(429, "X rate limit reached. Try again in about 15 minutes.");
  if (!res.ok) throw new AppError(502, `X API error ${res.status}.`);
  return (await res.json()) as T;
}

export interface XUser {
  id: string;
  username: string;
  name: string;
  description?: string;
  profile_image_url?: string;
}

export async function getUser(handle: string): Promise<XUser> {
  const out = await xGet<{ data?: XUser }>(`/users/by/username/${handle}?user.fields=name,description,profile_image_url`);
  if (!out.data) throw new AppError(404, `@${handle} wasn't found.`);
  return out.data;
}

export interface XPost {
  text: string;
  likes: number;
  reposts: number;
  isReply: boolean;
}

export async function getRecentPosts(userId: string, opts: { originalsOnly: boolean }): Promise<XPost[]> {
  const exclude = opts.originalsOnly ? "retweets,replies" : "retweets";
  const out = await xGet<{
    data?: {
      text: string;
      note_tweet?: { text: string };
      referenced_tweets?: { type: string }[];
      public_metrics?: { like_count: number; retweet_count: number };
    }[];
  }>(`/users/${userId}/tweets?max_results=100&exclude=${exclude}&tweet.fields=note_tweet,referenced_tweets,public_metrics`);
  return (out.data ?? []).map((p) => ({
    text: p.note_tweet?.text ?? p.text,
    likes: p.public_metrics?.like_count ?? 0,
    reposts: p.public_metrics?.retweet_count ?? 0,
    isReply: !!p.referenced_tweets?.some((r) => r.type === "replied_to"),
  }));
}
