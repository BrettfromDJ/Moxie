"use client";

import { useMemo, useRef } from "react";
import type { VoiceProfile } from "@/lib/types";

// Shareable "Voice DNA" card. All numbers are measured from the user's own
// samples; nothing here predicts performance.

export function voiceStats(p: VoiceProfile) {
  const texts = p.samples.map((s) => s.text);
  const sentences = texts.flatMap((t) => t.split(/(?<=[.!?])\s+|\n+/).map((x) => x.trim()).filter(Boolean));
  const words = sentences.map((s) => s.split(/\s+/).filter(Boolean).length);
  const avgSentence = words.length ? words.reduce((a, b) => a + b, 0) / words.length : 0;
  const avgChars = texts.length ? texts.reduce((a, t) => a + t.length, 0) / texts.length : 0;
  const lowercaseStarts = texts.filter((t) => /^[a-z]/.test(t.trim())).length;
  const questions = texts.filter((t) => t.includes("?")).length;
  return {
    samples: texts.length,
    avgSentence: Math.round(avgSentence * 10) / 10,
    avgChars: Math.round(avgChars),
    lowercasePct: texts.length ? Math.round((lowercaseStarts / texts.length) * 100) : 0,
    questionPct: texts.length ? Math.round((questions / texts.length) * 100) : 0,
  };
}

export function VoiceCard({ profile }: { profile: VoiceProfile }) {
  const stats = useMemo(() => voiceStats(profile), [profile]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const lines = [
    ["Archetype", profile.archetype || "—"],
    ["Signature structure", profile.signatureStructure || "—"],
    ["Avg sentence", stats.samples ? `${stats.avgSentence} words` : "—"],
    ["Avg post", stats.samples ? `${stats.avgChars} characters` : "—"],
    ["Opens with", profile.postHabits.openings.slice(0, 2).join(" / ") || "—"],
    ["Humor", profile.writingHabits.humor || "—"],
    ["Never", profile.avoid.slice(0, 3).join(", ") || "—"],
  ];

  function asText() {
    return `My writing Voice DNA (${profile.name})\n${lines.map(([k, v]) => `${k}: ${v}`).join("\n")}\nMeasured from ${stats.samples} of my posts.`;
  }

  function download() {
    const canvas = canvasRef.current!;
    const W = 1200;
    const H = 675;
    canvas.width = W;
    canvas.height = H;
    const g = canvas.getContext("2d")!;
    const grad = g.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, "#1e1b4b");
    grad.addColorStop(1, "#4f46e5");
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    g.fillStyle = "rgba(255,255,255,0.65)";
    g.font = "600 26px system-ui, sans-serif";
    g.fillText("VOICE DNA", 72, 96);
    g.fillStyle = "#fff";
    g.font = "700 64px system-ui, sans-serif";
    g.fillText(fit(g, profile.archetype || profile.name, W - 144), 72, 172);
    let y = 250;
    for (const [k, v] of lines.slice(1)) {
      g.fillStyle = "rgba(255,255,255,0.6)";
      g.font = "500 24px system-ui, sans-serif";
      g.fillText(k.toUpperCase(), 72, y);
      g.fillStyle = "#fff";
      g.font = "500 30px system-ui, sans-serif";
      g.fillText(fit(g, v, W - 420), 380, y);
      y += 62;
    }
    g.fillStyle = "rgba(255,255,255,0.55)";
    g.font = "400 22px system-ui, sans-serif";
    g.fillText(`Measured from ${stats.samples} posts · made with moxie`, 72, H - 56);
    const a = document.createElement("a");
    a.download = `voice-dna-${profile.name.toLowerCase().replace(/\W+/g, "-")}.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl p-6 text-white bg-gradient-to-br from-indigo-950 to-indigo-600 shadow-lg">
        <p className="text-xs tracking-widest text-white/60 font-semibold">VOICE DNA</p>
        <p className="text-2xl font-bold mt-1">{profile.archetype || profile.name}</p>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          {lines.slice(1).map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-white/60">{k}</dt>
              <dd className="truncate" title={v}>
                {v}
              </dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-white/50 mt-4">Measured from {stats.samples} of your posts.</p>
      </div>
      <div className="flex gap-2">
        <button className="btn btn-sm" type="button" onClick={download}>
          Download image
        </button>
        <button className="btn btn-sm" type="button" onClick={() => navigator.clipboard.writeText(asText())}>
          Copy as text
        </button>
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

function fit(g: CanvasRenderingContext2D, text: string, max: number): string {
  if (g.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && g.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
}
