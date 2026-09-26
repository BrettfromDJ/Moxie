import type { PostType, Sample } from "./types";

// Picks a small, relevant set of the user's own posts for each request instead
// of sending their whole archive: lexical similarity (TF-IDF cosine) to the
// current thought, boosted when the sample's kind matches the post type.

const STOP = new Set(
  "a an the and or but if of to in on for with at by from is are was were be been it this that these those i you we they he she my your our their me us them as so not no do does did have has had just about into than then there here what when where who why how all any can will would should could very really".split(
    " ",
  ),
);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .split(/[^\p{L}\p{N}']+/u)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

function vectorize(tokens: string[], idf: Map<string, number>): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
  const v = new Map<string, number>();
  for (const [t, n] of tf) v.set(t, n * (idf.get(t) ?? 1));
  return v;
}

function cosine(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const [, x] of a) na += x * x;
  for (const [, y] of b) nb += y * y;
  for (const [t, x] of a) dot += x * (b.get(t) ?? 0);
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

const KIND_FOR_POST_TYPE: Record<PostType, string[]> = {
  original: ["observation", "opinion", "insight", "story"],
  quote: ["reaction", "opinion", "quote"],
  reply: ["reply", "reaction", "conversation"],
  announcement: ["announcement", "launch", "news"],
  link: ["link", "recommendation", "announcement"],
  image: ["image", "story", "observation"],
  remix: ["observation", "opinion", "insight"],
};

export function selectExamples(
  samples: Sample[],
  query: string,
  postType: PostType,
  k = 6,
): Sample[] {
  if (samples.length <= k) return samples;
  const docs = samples.map((s) => tokenize(s.text));
  const df = new Map<string, number>();
  for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) ?? 0) + 1);
  const idf = new Map<string, number>();
  for (const [t, n] of df) idf.set(t, Math.log(1 + samples.length / n));
  const q = vectorize(tokenize(query), idf);
  const wanted = KIND_FOR_POST_TYPE[postType];
  const scored = samples.map((s, i) => {
    const kindBoost = s.kind && wanted.some((w) => s.kind!.toLowerCase().includes(w)) ? 0.25 : 0;
    // Posts the user actually shipped are the strongest voice evidence.
    const sourceBoost = s.source === "posted" || s.source === "edit" ? 0.1 : 0;
    return { s, score: cosine(q, vectorize(docs[i], idf)) + kindBoost + sourceBoost };
  });
  scored.sort((a, b) => b.score - a.score);
  // Keep a couple of slots for variety so a narrow query does not starve the voice signal.
  const top = scored.slice(0, k - 2).map((x) => x.s);
  const rest = scored.slice(k - 2);
  for (let i = 0; i < 2 && rest.length; i++) {
    top.push(rest.splice(Math.floor(rest.length / 2), 1)[0].s);
  }
  return top;
}

// Jaccard similarity on word 3-grams; used to warn when a draft repeats a prior post.
function shingles(text: string): Set<string> {
  const t = tokenize(text);
  const out = new Set<string>();
  for (let i = 0; i + 2 < t.length; i++) out.add(`${t[i]} ${t[i + 1]} ${t[i + 2]}`);
  if (t.length < 3 && t.length) out.add(t.join(" "));
  return out;
}

export function mostSimilar(
  text: string,
  prior: string[],
): { text: string; score: number } | null {
  const a = shingles(text);
  if (!a.size) return null;
  let best: { text: string; score: number } | null = null;
  for (const p of prior) {
    const b = shingles(p);
    if (!b.size) continue;
    let inter = 0;
    for (const x of a) if (b.has(x)) inter++;
    const score = inter / (a.size + b.size - inter);
    if (!best || score > best.score) best = { text: p, score };
  }
  return best;
}
