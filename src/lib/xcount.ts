// X's weighted character counting (a close approximation of twitter-text v3):
// - most Latin/punctuation code points count 1, CJK and other wide scripts count 2
// - every emoji sequence counts 2
// - every URL counts 23 no matter how long it is

export const X_LIMIT = 280;
export const X_PREMIUM_LIMIT = 25000;
const URL_WEIGHT = 23;

const URL_RE = /\bhttps?:\/\/[^\s]+|\b(?:[a-z0-9-]+\.)+(?:com|org|net|io|co|ai|dev|app|xyz|me|so|gg|ly)\b(?:\/[^\s]*)?/gi;

const LIGHT_RANGES: [number, number][] = [
  [0, 4351],
  [8192, 8205],
  [8208, 8223],
  [8242, 8247],
];

function codePointWeight(cp: number): number {
  for (const [lo, hi] of LIGHT_RANGES) if (cp >= lo && cp <= hi) return 1;
  return 2;
}

const EMOJI_RE = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;

let segmenter: Intl.Segmenter | null = null;
function graphemes(text: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    segmenter ??= new Intl.Segmenter(undefined, { granularity: "grapheme" });
    return Array.from(segmenter.segment(text), (s) => s.segment);
  }
  return Array.from(text);
}

export function xLength(text: string): number {
  let total = 0;
  const withoutUrls = text.replace(URL_RE, () => {
    total += URL_WEIGHT;
    return "";
  });
  for (const g of graphemes(withoutUrls.normalize("NFC"))) {
    if (EMOJI_RE.test(g)) {
      total += 2;
      continue;
    }
    for (const ch of g) total += codePointWeight(ch.codePointAt(0)!);
  }
  return total;
}

export function readingSeconds(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round((words / 230) * 60));
}

export function formatReadingTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s read`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m}m ${s}s read` : `${m}m read`;
}

// Splits text at the point where X's weighted count passes `limit`, so the
// overflow can be highlighted the way X's composer does.
export function splitAtLimit(text: string, limit: number): [string, string] {
  const urls = Array.from(text.matchAll(new RegExp(URL_RE.source, URL_RE.flags)), (m) => [m.index!, m.index! + m[0].length] as const);
  const segs: { index: number; segment: string }[] =
    typeof Intl !== "undefined" && "Segmenter" in Intl
      ? Array.from((segmenter ??= new Intl.Segmenter(undefined, { granularity: "grapheme" })).segment(text), (s) => ({ index: s.index, segment: s.segment }))
      : Array.from(text).reduce<{ index: number; segment: string }[]>((acc, ch) => {
          const prev = acc[acc.length - 1];
          acc.push({ index: prev ? prev.index + prev.segment.length : 0, segment: ch });
          return acc;
        }, []);
  let total = 0;
  let si = 0;
  while (si < segs.length) {
    const pos = segs[si].index;
    const url = urls.find(([start]) => start === pos);
    let weight: number;
    let next = si + 1;
    if (url) {
      weight = URL_WEIGHT;
      while (next < segs.length && segs[next].index < url[1]) next++;
    } else {
      const g = segs[si].segment;
      weight = EMOJI_RE.test(g) ? 2 : Array.from(g).reduce((w, ch) => w + codePointWeight(ch.codePointAt(0)!), 0);
    }
    if (total + weight > limit) return [text.slice(0, pos), text.slice(pos)];
    total += weight;
    si = next;
  }
  return [text, ""];
}
