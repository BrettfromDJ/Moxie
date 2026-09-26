import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { AppError } from "./claude";

// The app, not the model, retrieves link content. A pasted URL is never treated
// as evidence that the model has read the page.

export interface Extracted {
  kind: "x-post" | "article" | "page";
  url: string;
  author?: string;
  title?: string;
  text: string;
  excerpt: string;
  parent?: { url: string; author?: string; text: string };
}

const MAX_BYTES = 3_000_000;
const TIMEOUT_MS = 12_000;

function isPrivateAddress(ip: string): boolean {
  if (ip.includes(":")) {
    const v = ip.toLowerCase();
    if (v.startsWith("::ffff:")) return isPrivateAddress(v.slice(7));
    return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80");
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new AppError(400, "That doesn't look like a valid URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new AppError(400, "Only http and https links are supported.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new AppError(400, "Local addresses can't be fetched.");
  }
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (!addrs.length) throw new AppError(400, `Couldn't resolve ${host}.`);
  if (addrs.some((a) => isPrivateAddress(a.address))) {
    throw new AppError(400, "Private network addresses can't be fetched.");
  }
  return url;
}

async function safeFetch(raw: string, accept: string, headers: Record<string, string> = {}): Promise<Response> {
  let current = raw;
  for (let hop = 0; hop < 5; hop++) {
    const url = await assertPublicUrl(current);
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; MoxieBot/1.0; +https://github.com/brettfromdj/moxie)",
        accept,
        ...headers,
      },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = new URL(res.headers.get("location")!, url).toString();
      continue;
    }
    return res;
  }
  throw new AppError(502, "Too many redirects.");
}

async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

const X_STATUS = /^https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/([^/]+)\/status(?:es)?\/(\d+)/i;

export function isXUrl(url: string): boolean {
  return X_STATUS.test(url);
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&mdash;/g, "—")
    .replace(/&nbsp;/g, " ");
}

async function fetchXViaApi(id: string, token: string): Promise<Extracted | null> {
  const api = `https://api.x.com/2/tweets/${id}?tweet.fields=text,note_tweet,referenced_tweets,author_id&expansions=author_id,referenced_tweets.id,referenced_tweets.id.author_id&user.fields=username,name`;
  const res = await fetch(api, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return null;
  type Tweet = { id: string; text: string; author_id?: string; note_tweet?: { text: string }; referenced_tweets?: { type: string; id: string }[] };
  const json = (await res.json()) as {
    data?: Tweet;
    includes?: { users?: { id: string; username: string; name: string }[]; tweets?: Tweet[] };
  };
  const t = json.data;
  if (!t) return null;
  const user = (uid?: string) => json.includes?.users?.find((u) => u.id === uid);
  const author = user(t.author_id);
  const text = t.note_tweet?.text ?? t.text;
  const parentRef = t.referenced_tweets?.find((r) => r.type === "replied_to" || r.type === "quoted");
  const parentTweet = parentRef && json.includes?.tweets?.find((x) => x.id === parentRef.id);
  const parentUser = parentTweet ? user(parentTweet.author_id) : undefined;
  return {
    kind: "x-post",
    url: `https://x.com/${author?.username ?? "i"}/status/${id}`,
    author: author ? `${author.name} (@${author.username})` : undefined,
    text,
    excerpt: text.slice(0, 220),
    parent: parentTweet
      ? {
          url: `https://x.com/${parentUser?.username ?? "i"}/status/${parentTweet.id}`,
          author: parentUser ? `${parentUser.name} (@${parentUser.username})` : undefined,
          text: parentTweet.note_tweet?.text ?? parentTweet.text,
        }
      : undefined,
  };
}

async function fetchX(url: string): Promise<Extracted> {
  const m = url.match(X_STATUS)!;
  const token = process.env.X_BEARER_TOKEN;
  if (token) {
    const viaApi = await fetchXViaApi(m[2], token).catch(() => null);
    if (viaApi) return viaApi;
  }
  // Public oEmbed endpoint: no auth, returns the post text for public posts.
  const canonical = `https://twitter.com/${m[1]}/status/${m[2]}`;
  const res = await safeFetch(
    `https://publish.twitter.com/oembed?omit_script=1&dnt=true&url=${encodeURIComponent(canonical)}`,
    "application/json",
  );
  if (!res.ok) {
    throw new AppError(502, "Couldn't read that post from X (it may be private, deleted, or rate limited). Paste its text instead.");
  }
  const data = (await res.json()) as { author_name?: string; author_url?: string; html?: string };
  const p = data.html?.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? "";
  const text = decodeEntities(p.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "")).trim();
  if (!text) throw new AppError(502, "That post has no readable text. Paste it instead.");
  const handle = data.author_url?.split("/").pop();
  return {
    kind: "x-post",
    url: `https://x.com/${m[1]}/status/${m[2]}`,
    author: data.author_name ? `${data.author_name}${handle ? ` (@${handle})` : ""}` : `@${m[1]}`,
    text,
    excerpt: text.slice(0, 220),
  };
}

// textContent glues headings and paragraphs together; add breaks at block boundaries first.
function blockText(html: string): string {
  if (!html) return "";
  const { document } = parseHTML(`<div id="root">${html}</div>`);
  for (const el of document.querySelectorAll("p,h1,h2,h3,h4,h5,h6,li,blockquote,pre,tr,br,div")) {
    el.append("\n");
  }
  return (document.getElementById("root")?.textContent ?? "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function fetchPage(url: string): Promise<Extracted> {
  const res = await safeFetch(url, "text/html,application/xhtml+xml;q=0.9,text/plain;q=0.8");
  if (!res.ok) throw new AppError(502, `The page returned ${res.status}. Paste the text instead.`);
  const type = res.headers.get("content-type") ?? "";
  const body = await readCapped(res);
  if (type.includes("text/plain")) {
    return { kind: "page", url, text: body.slice(0, 50000), excerpt: body.slice(0, 220) };
  }
  if (!type.includes("html")) {
    throw new AppError(415, "That link isn't a web page (PDFs and files aren't supported yet). Paste the text instead.");
  }
  const { document } = parseHTML(body);
  const meta = (name: string) =>
    document.querySelector(`meta[property="${name}"], meta[name="${name}"]`)?.getAttribute("content") ?? undefined;
  const article = new Readability(document as unknown as Document).parse();
  const text = blockText(article?.content ?? "");
  if (text.length < 80) {
    throw new AppError(422, "Couldn't extract readable text from that page (it may need JavaScript or a login). Paste the text instead.");
  }
  const isArticle = meta("og:type") === "article" || !!article?.byline;
  return {
    kind: isArticle ? "article" : "page",
    url,
    title: article?.title || meta("og:title") || undefined,
    author: article?.byline || meta("author") || article?.siteName || meta("og:site_name") || undefined,
    text: text.slice(0, 50000),
    excerpt: (article?.excerpt || meta("og:description") || text).slice(0, 220),
  };
}

export async function extract(url: string): Promise<Extracted> {
  const trimmed = url.trim();
  return isXUrl(trimmed) ? fetchX(trimmed) : fetchPage(trimmed);
}
