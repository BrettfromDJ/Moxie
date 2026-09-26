"use client";

import { Search } from "lucide-react";
import { PageHeader, SectionTitle } from "@/components/Shell";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { activeSession, api, patchActive, startSession, uid, useStore } from "@/lib/store";
import { BUILT_IN_STRUCTURES } from "@/lib/structures";
import type { Structure, StructureAnalysis } from "@/lib/types";

export default function StructuresPage() {
  const { state, update } = useStore();
  const router = useRouter();
  const [post, setPost] = useState("");
  const [analysis, setAnalysis] = useState<StructureAnalysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  function use(structure: Structure) {
    // Applies to the conversation you're in; starts a new one if that already has drafts.
    update((s) => {
      const base = activeSession(s).turns.length ? startSession(s) : s;
      return patchActive(base, (x) => ({ ...x, settings: { ...x.settings, structureId: structure.id } }));
    });
    router.push("/");
  }

  async function analyze() {
    setBusy(true);
    setError(null);
    setSavedId(null);
    try {
      let text = post.trim();
      if (/^https?:\/\/\S+$/.test(text)) {
        text = (await api<{ text: string }>("/api/references/fetch", { url: text })).text;
        setPost(text);
      }
      setAnalysis(await api<StructureAnalysis>("/api/structure", { text }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function toStructure(a: StructureAnalysis): Structure {
    return { id: uid("st"), name: a.name, pattern: a.pattern, description: a.whyItWorks, steps: a.steps, custom: true };
  }

  function save(a: StructureAnalysis): Structure {
    const existing = state.customStructures.find((s) => s.id === savedId);
    if (existing) return existing;
    const st = toStructure(a);
    update((s) => ({ ...s, customStructures: [...s.customStructures, st] }));
    setSavedId(st.id);
    return st;
  }

  const all = [...BUILT_IN_STRUCTURES, ...state.customStructures];

  return (
    <div className="pb-32">
      <PageHeader title="Structures" />
      <div className="space-y-8 max-w-6xl mx-auto px-5 sm:px-10">
      <p className="text-sm text-muted max-w-2xl -mt-1">
          Reusable mechanics, not copies of successful posts. Pick one to apply to your own idea, or paste a post you admire to see how it works.
      </p>

      <section className="card p-5 space-y-3 max-w-3xl">
        <SectionTitle tone="purple" icon={<Search size={17} />}>Break down a post I admire</SectionTitle>
        <textarea
          className="input"
          rows={4}
          value={post}
          onChange={(e) => setPost(e.target.value)}
          placeholder="Paste a post (or a link to it) to identify its hook, context, turn, and payoff."
          aria-label="Post to analyze"
        />
        <button className="btn btn-primary btn-sm" type="button" disabled={!post.trim() || busy} onClick={analyze}>
          {busy ? "Analyzing…" : "Analyze structure"}
        </button>
        {error && <p className="text-sm text-bad">{error}</p>}
        {analysis && (
          <div className="space-y-4 pt-2">
            <dl className="grid sm:grid-cols-2 gap-3 text-sm">
              {(["hook", "context", "turn", "payoff"] as const).map((k) => (
                <div key={k} className="rounded-lg bg-panel-2 p-3">
                  <dt className="label">{k}</dt>
                  <dd>{analysis[k]}</dd>
                </div>
              ))}
            </dl>
            <div className="text-sm space-y-1">
              <p>
                <span className="font-semibold">{analysis.name}</span> <span className="text-accent">{analysis.pattern}</span>
              </p>
              <p className="text-muted">{analysis.whyItWorks}</p>
              <ol className="list-decimal pl-5">
                {analysis.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button className="btn btn-primary btn-sm" type="button" onClick={() => use(save(analysis))}>
                Use this structure with my idea
              </button>
              <button className="btn btn-sm" type="button" disabled={!!savedId} onClick={() => save(analysis)}>
                {savedId ? "Saved to library" : "Save to library"}
              </button>
              <button
                className="btn btn-sm"
                type="button"
                onClick={() =>
                  update((s) => ({
                    ...s,
                    taste: {
                      ...s.taste,
                      admired: [...s.taste.admired, { id: uid("t"), text: post.trim(), qualities: analysis.qualities }],
                    },
                  }))
                }
              >
                Add to my taste
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {all.map((s) => (
          <article key={s.id} className="card p-4 flex flex-col gap-2">
            <div className="flex items-start gap-2">
              <h3 className="font-semibold">{s.name}</h3>
              {s.custom && <span className="text-[10px] rounded bg-accent-soft text-accent px-1.5 py-0.5">yours</span>}
            </div>
            <p className="text-sm text-accent">{s.pattern}</p>
            <p className="text-sm text-muted flex-1">{s.description}</p>
            {s.example && <p className="text-xs italic text-muted border-l-2 border-line pl-2">{s.example}</p>}
            <div className="flex gap-2 pt-1">
              <button className="btn btn-sm" type="button" onClick={() => use(s)}>
                Use with my idea
              </button>
              {s.custom && (
                <button
                  className="btn btn-sm btn-ghost text-muted"
                  type="button"
                  onClick={() => update((st) => ({ ...st, customStructures: st.customStructures.filter((x) => x.id !== s.id) }))}
                >
                  Delete
                </button>
              )}
            </div>
          </article>
        ))}
      </section>
      </div>
    </div>
  );
}
