"use client";

import { useEffect, useState } from "react";
import { ListEditor } from "@/components/ListEditor";
import { VoiceCard } from "@/components/VoiceCard";
import { activeProfile, api, splitSamples, uid, useStore } from "@/lib/store";
import type { AdmiredPost, ProfileSuggestion, Sample, VoiceProfile, WritingHabits } from "@/lib/types";

interface Analysis extends Omit<VoiceProfile, "id" | "name" | "samples" | "updatedAt"> {
  sampleKinds: { index: number; kind: string }[];
}

const HABIT_LABELS: Record<keyof WritingHabits, string> = {
  sentenceLength: "Sentence length",
  vocabulary: "Vocabulary",
  punctuation: "Punctuation & caps",
  humor: "Humor",
  lineBreaks: "Line breaks",
  fragments: "Fragments",
};

function emptyProfile(name: string, samples: Sample[]): VoiceProfile {
  return {
    id: uid("v"),
    name,
    summary: "",
    archetype: "",
    signatureStructure: "",
    writingHabits: { sentenceLength: "", vocabulary: "", punctuation: "", humor: "", lineBreaks: "", fragments: "" },
    postHabits: { openings: [], structures: [], endings: [], hashtags: "", emojis: "", callsToAction: "" },
    rules: [],
    avoid: [],
    samples,
    updatedAt: Date.now(),
  };
}

function applyAnalysis(p: VoiceProfile, a: Analysis): VoiceProfile {
  const kinds = new Map(a.sampleKinds.map((k) => [k.index, k.kind]));
  return {
    ...p,
    summary: a.summary,
    archetype: a.archetype,
    signatureStructure: a.signatureStructure,
    writingHabits: a.writingHabits,
    postHabits: a.postHabits,
    rules: a.rules,
    avoid: a.avoid,
    samples: p.samples.map((s, i) => ({ ...s, kind: kinds.get(i) ?? s.kind })),
    updatedAt: Date.now(),
  };
}

export default function VoicePage() {
  const { state, update, hydrated } = useStore();
  const profile = activeProfile(state);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (hydrated && !state.profiles.length) setCreating(true);
  }, [hydrated, state.profiles.length]);

  if (!hydrated) return null;

  return (
    <div className="space-y-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Voice & taste</h1>
        <p className="text-muted text-sm max-w-2xl">
          <span className="font-medium text-fg">My voice</span> is learned from your own writing and decides how drafts sound.{" "}
          <span className="font-medium text-fg">My taste</span> is what you admire in other people&apos;s posts; it shapes
          hooks and structure without replacing your voice.
        </p>
      </header>

      <section className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-lg font-semibold">My voice</h2>
          {state.profiles.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {state.profiles.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    update((s) => ({ ...s, activeProfileId: p.id }));
                    setCreating(false);
                  }}
                  className={`btn btn-sm ${p.id === state.activeProfileId && !creating ? "!border-accent !text-accent" : ""}`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
          <button className="btn btn-sm btn-primary ml-auto" type="button" onClick={() => setCreating(true)}>
            + New voice profile
          </button>
        </div>

        {creating ? (
          <Onboarding
            onDone={(p) => {
              update((s) => ({ ...s, profiles: [...s.profiles, p], activeProfileId: p.id }));
              setCreating(false);
            }}
            onCancel={state.profiles.length ? () => setCreating(false) : undefined}
          />
        ) : profile ? (
          <ProfileEditor key={profile.id} profile={profile} />
        ) : (
          <p className="text-sm text-muted">Pick a profile above.</p>
        )}
      </section>

      <TasteSection />
    </div>
  );
}

function Onboarding({ onDone, onCancel }: { onDone: (p: VoiceProfile) => void; onCancel?: () => void }) {
  const [tab, setTab] = useState<"paste" | "links" | "x" | "none">("paste");
  const [name, setName] = useState("My voice");
  const [raw, setRaw] = useState("");
  const [links, setLinks] = useState("");
  const [handle, setHandle] = useState("");
  const [xAvailable, setXAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/voice/x-import")
      .then((r) => r.json())
      .then((j: { available: boolean }) => setXAvailable(j.available))
      .catch(() => setXAvailable(false));
  }, []);

  async function analyze(samples: Sample[]) {
    if (samples.length < 3) throw new Error("Add at least 3 posts you wrote so there's something to learn from.");
    setBusy("Analyzing your writing…");
    const a = await api<Analysis>("/api/voice/analyze", { samples: samples.map((s) => s.text) });
    onDone(applyAnalysis(emptyProfile(name.trim() || "My voice", samples), a));
  }

  async function submit() {
    setError(null);
    try {
      if (tab === "none") {
        onDone(emptyProfile(name.trim() || "My voice", []));
        return;
      }
      if (tab === "paste") {
        await analyze(splitSamples(raw).map((text) => ({ id: uid("s"), text, source: "pasted" })));
      }
      if (tab === "links") {
        const urls = links.split(/\s+/).filter((u) => /^https?:\/\//.test(u)).slice(0, 60);
        const samples: Sample[] = [];
        const failed: string[] = [];
        for (const [i, url] of urls.entries()) {
          setBusy(`Reading post ${i + 1} of ${urls.length}…`);
          try {
            const x = await api<{ text: string }>("/api/references/fetch", { url });
            samples.push({ id: uid("s"), text: x.text, source: "link" });
          } catch {
            failed.push(url);
          }
        }
        if (failed.length) setError(`Couldn't read ${failed.length} link(s); continuing with the rest.`);
        await analyze(samples);
      }
      if (tab === "x") {
        setBusy("Importing your posts from X…");
        const res = await api<{ samples: { text: string; kind?: string }[] }>("/api/voice/x-import", { username: handle });
        await analyze(res.samples.map((s) => ({ id: uid("s"), text: s.text, kind: s.kind, source: "x" })));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const count = splitSamples(raw).length;
  const TABS = [
    ["paste", "Paste writing samples"],
    ["links", "Paste links to my posts"],
    ["x", "Connect X"],
    ["none", "Start without examples"],
  ] as const;

  return (
    <div className="card p-5 space-y-4 max-w-3xl">
      <label className="block max-w-xs">
        <span className="label">Profile name</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Me on X, Company account" />
      </label>
      <div className="flex gap-1 flex-wrap" role="tablist">
        {TABS.map(([k, label]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            type="button"
            onClick={() => setTab(k)}
            className={`btn btn-sm ${tab === k ? "!border-accent !text-accent" : ""}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "paste" && (
        <div className="space-y-1">
          <textarea
            className="input font-mono text-[13px]"
            rows={12}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            aria-label="Writing samples"
            placeholder={"Paste 10+ posts you wrote. Separate posts with a blank line, or with a line containing ---\n\nThe more representative, the better. Only include your own writing."}
          />
          <p className="text-xs text-muted">{count} post{count === 1 ? "" : "s"} detected</p>
        </div>
      )}
      {tab === "links" && (
        <textarea
          className="input font-mono text-[13px]"
          rows={8}
          value={links}
          onChange={(e) => setLinks(e.target.value)}
          aria-label="Links to your posts"
          placeholder={"One link per line to posts you wrote, e.g.\nhttps://x.com/you/status/123…\nhttps://yourblog.com/post"}
        />
      )}
      {tab === "x" &&
        (xAvailable ? (
          <label className="block max-w-xs">
            <span className="label">Your X username</span>
            <input className="input" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@you" />
          </label>
        ) : (
          <p className="text-sm text-muted">
            {xAvailable === null
              ? "Checking…"
              : "Connecting X needs an X API token configured on the server (X_BEARER_TOKEN). Until then, paste links to your posts or the posts themselves."}
          </p>
        ))}
      {tab === "none" && (
        <p className="text-sm text-muted">
          Starts an empty profile. Drafts will use a plain, natural register, and the profile fills in as you edit results,
          use More like this / Never like this, and mark posts as posted. You can add samples any time.
        </p>
      )}

      {error && <p className="text-sm text-warn">{error}</p>}
      <div className="flex gap-2">
        <button
          className="btn btn-primary"
          type="button"
          disabled={!!busy || (tab === "x" && !xAvailable) || (tab === "paste" && count < 3)}
          onClick={submit}
        >
          {busy ?? (tab === "none" ? "Create profile" : "Analyze my voice")}
        </button>
        {onCancel && (
          <button className="btn" type="button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

function ProfileEditor({ profile }: { profile: VoiceProfile }) {
  const { state, update } = useStore();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<ProfileSuggestion | null>(null);
  const [newSamples, setNewSamples] = useState("");

  const save = (p: Partial<VoiceProfile>) =>
    update((s) => ({
      ...s,
      profiles: s.profiles.map((x) => (x.id === profile.id ? { ...x, ...p, updatedAt: Date.now() } : x)),
    }));

  async function reanalyze() {
    setBusy("reanalyze");
    setError(null);
    try {
      const a = await api<Analysis>("/api/voice/analyze", { samples: profile.samples.map((s) => s.text) });
      const next = applyAnalysis(profile, a);
      save(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function learn() {
    setBusy("learn");
    setError(null);
    try {
      setSuggestion(await api<ProfileSuggestion>("/api/voice/learn", { voice: profile, feedback: state.feedback }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const feedbackCount = state.feedback.length;

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
      <div className="space-y-6">
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold">Voice DNA</h3>
            <span className="text-xs text-muted">Everything here is editable. Correct anything it got wrong.</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Profile name" value={profile.name} onSave={(name) => save({ name })} />
            <Field label="Archetype" value={profile.archetype} onSave={(archetype) => save({ archetype })} />
            <Field label="Signature structure" value={profile.signatureStructure} onSave={(signatureStructure) => save({ signatureStructure })} />
            <Field label="Summary" value={profile.summary} onSave={(summary) => save({ summary })} multiline />
          </div>

          <h4 className="label !mt-2">Writing habits</h4>
          <div className="grid sm:grid-cols-2 gap-3">
            {(Object.keys(HABIT_LABELS) as (keyof WritingHabits)[]).map((k) => (
              <Field
                key={k}
                label={HABIT_LABELS[k]}
                value={profile.writingHabits[k]}
                onSave={(v) => save({ writingHabits: { ...profile.writingHabits, [k]: v } })}
              />
            ))}
          </div>

          <h4 className="label !mt-2">Post habits</h4>
          <div className="grid sm:grid-cols-3 gap-4">
            {(["openings", "structures", "endings"] as const).map((k) => (
              <div key={k}>
                <span className="text-xs font-medium capitalize">{k}</span>
                <ListEditor
                  ariaLabel={`Typical ${k}`}
                  items={profile.postHabits[k]}
                  placeholder={`Add a typical ${k.slice(0, -1)}…`}
                  onChange={(items) => save({ postHabits: { ...profile.postHabits, [k]: items } })}
                />
              </div>
            ))}
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <Field label="Hashtags" value={profile.postHabits.hashtags} onSave={(v) => save({ postHabits: { ...profile.postHabits, hashtags: v } })} />
            <Field label="Emoji" value={profile.postHabits.emojis} onSave={(v) => save({ postHabits: { ...profile.postHabits, emojis: v } })} />
            <Field label="Calls to action" value={profile.postHabits.callsToAction} onSave={(v) => save({ postHabits: { ...profile.postHabits, callsToAction: v } })} />
          </div>

          <div className="grid sm:grid-cols-2 gap-6 pt-2">
            <div>
              <h4 className="label">Rules — always</h4>
              <ListEditor ariaLabel="Rules" items={profile.rules} placeholder="e.g. Lead with the claim" onChange={(rules) => save({ rules })} />
            </div>
            <div>
              <h4 className="label">Avoid list — never</h4>
              <ListEditor
                ariaLabel="Avoid list"
                tone="avoid"
                items={profile.avoid}
                placeholder="e.g. “Here's the thing”, exclamation marks"
                onChange={(avoid) => save({ avoid })}
              />
            </div>
          </div>
        </div>

        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold">Learn from my choices</h3>
            <span className="text-xs text-muted">{feedbackCount} signals so far (likes, rejections, edits, posted)</span>
            <button className="btn btn-sm ml-auto" type="button" disabled={!!busy || feedbackCount < 3} onClick={learn}>
              {busy === "learn" ? "Reviewing…" : "Suggest profile updates"}
            </button>
          </div>
          {suggestion && (
            <SuggestionReview
              suggestion={suggestion}
              profile={profile}
              onApply={(p) => {
                save(p);
                setSuggestion(null);
              }}
              onClose={() => setSuggestion(null)}
            />
          )}
        </div>

        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold">Writing samples ({profile.samples.length})</h3>
            <button className="btn btn-sm ml-auto" type="button" disabled={!!busy || profile.samples.length < 3} onClick={reanalyze}>
              {busy === "reanalyze" ? "Analyzing…" : "Re-analyze from samples"}
            </button>
          </div>
          <p className="text-xs text-muted">
            A few relevant samples are picked for each request (e.g. announcements for announcements) instead of sending them all.
            Re-analyzing replaces the Voice DNA above.
          </p>
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              const add = splitSamples(newSamples).map((text) => ({ id: uid("s"), text, source: "pasted" as const }));
              if (add.length) save({ samples: [...profile.samples, ...add] });
              setNewSamples("");
            }}
          >
            <textarea
              className="input text-sm"
              rows={3}
              value={newSamples}
              onChange={(e) => setNewSamples(e.target.value)}
              placeholder="Add more posts you wrote (separate with a blank line)…"
              aria-label="Add samples"
            />
            <button className="btn btn-sm" type="submit" disabled={!newSamples.trim()}>
              Add samples
            </button>
          </form>
          <ul className="divide-y divide-line max-h-[28rem] overflow-y-auto">
            {profile.samples.map((s) => (
              <li key={s.id} className="py-2 flex gap-3 items-start text-sm group">
                <span className="text-[11px] text-muted w-24 shrink-0 pt-0.5">{s.kind ?? s.source}</span>
                <p className="whitespace-pre-wrap flex-1">{s.text}</p>
                <button
                  className="text-xs text-muted opacity-0 group-hover:opacity-100 focus:opacity-100"
                  type="button"
                  onClick={() => save({ samples: profile.samples.filter((x) => x.id !== s.id) })}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>

        {error && <p className="text-sm text-bad">{error}</p>}

        <button
          className="btn btn-sm !text-bad"
          type="button"
          onClick={() => {
            if (!confirm(`Delete the “${profile.name}” profile?`)) return;
            update((s) => {
              const profiles = s.profiles.filter((p) => p.id !== profile.id);
              return { ...s, profiles, activeProfileId: profiles[0]?.id ?? null };
            });
          }}
        >
          Delete profile
        </button>
      </div>

      <aside className="space-y-3 lg:sticky lg:top-20">
        <h3 className="font-semibold">Share your Voice DNA</h3>
        <VoiceCard profile={profile} />
      </aside>
    </div>
  );
}

function Field({
  label,
  value,
  onSave,
  multiline,
}: {
  label: string;
  value: string;
  onSave: (v: string) => void;
  multiline?: boolean;
}) {
  const common = {
    className: "input text-sm",
    defaultValue: value,
    "aria-label": label,
    onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (e.target.value !== value) onSave(e.target.value);
    },
  };
  return (
    <label className="block" key={value}>
      <span className="text-xs font-medium">{label}</span>
      {multiline ? <textarea rows={2} {...common} /> : <input {...common} />}
    </label>
  );
}

function SuggestionReview({
  suggestion,
  profile,
  onApply,
  onClose,
}: {
  suggestion: ProfileSuggestion;
  profile: VoiceProfile;
  onApply: (p: Partial<VoiceProfile>) => void;
  onClose: () => void;
}) {
  type Item = { key: string; label: string; apply: (p: VoiceProfile) => VoiceProfile };
  const items: Item[] = [
    ...suggestion.addRules.map((r) => ({ key: `r:${r}`, label: `Add rule: ${r}`, apply: (p: VoiceProfile) => ({ ...p, rules: [...p.rules, r] }) })),
    ...suggestion.addAvoid.map((r) => ({ key: `a:${r}`, label: `Avoid: ${r}`, apply: (p: VoiceProfile) => ({ ...p, avoid: [...p.avoid, r] }) })),
    ...suggestion.removeRules.map((r) => ({ key: `x:${r}`, label: `Remove rule: ${r}`, apply: (p: VoiceProfile) => ({ ...p, rules: p.rules.filter((x) => x !== r) }) })),
    ...suggestion.habitUpdates.map((h) => ({
      key: `h:${h.field}`,
      label: `${HABIT_LABELS[h.field as keyof WritingHabits] ?? h.field}: ${h.value}`,
      apply: (p: VoiceProfile) => ({ ...p, writingHabits: { ...p.writingHabits, [h.field]: h.value } }),
    })),
  ];
  const [checked, setChecked] = useState<Set<string>>(new Set(items.map((i) => i.key)));
  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted">{suggestion.notes}</p>
      {items.length === 0 ? (
        <p>No changes are clearly supported yet.</p>
      ) : (
        <ul className="space-y-1">
          {items.map((i) => (
            <li key={i.key}>
              <label className="flex gap-2 items-start">
                <input
                  type="checkbox"
                  checked={checked.has(i.key)}
                  onChange={(e) => {
                    const next = new Set(checked);
                    if (e.target.checked) next.add(i.key);
                    else next.delete(i.key);
                    setChecked(next);
                  }}
                />
                {i.label}
              </label>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        {items.length > 0 && (
          <button
            className="btn btn-primary btn-sm"
            type="button"
            onClick={() => {
              const next = items.filter((i) => checked.has(i.key)).reduce((p, i) => i.apply(p), profile);
              onApply({ rules: next.rules, avoid: next.avoid, writingHabits: next.writingHabits });
            }}
          >
            Apply selected
          </button>
        )}
        <button className="btn btn-sm" type="button" onClick={onClose}>
          Dismiss
        </button>
      </div>
    </div>
  );
}

function TasteSection() {
  const { state, update } = useStore();
  const [text, setText] = useState("");
  const [author, setAuthor] = useState("");
  const [qualities, setQualities] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const taste = state.taste;

  async function add() {
    setError(null);
    let body = text.trim();
    let by = author.trim() || undefined;
    if (/^https?:\/\/\S+$/.test(body)) {
      setBusy(true);
      try {
        const x = await api<{ text: string; author?: string }>("/api/references/fetch", { url: body });
        body = x.text;
        by = by ?? x.author;
      } catch (e) {
        setError((e as Error).message);
        setBusy(false);
        return;
      }
      setBusy(false);
    }
    const post: AdmiredPost = {
      id: uid("t"),
      text: body,
      author: by,
      qualities: qualities.split(",").map((q) => q.trim()).filter(Boolean),
    };
    update((s) => ({ ...s, taste: { ...s.taste, admired: [...s.taste.admired, post] } }));
    setText("");
    setAuthor("");
    setQualities("");
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">My taste</h2>
        <p className="text-sm text-muted max-w-2xl">
          Posts by other people that you think are good, and what you admire about them. Drafts borrow the quality (a sharp hook,
          a useful structure), never the words or the voice.
        </p>
      </div>
      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <div className="card p-5 space-y-3">
          <h3 className="font-semibold text-sm">What I consider good writing</h3>
          <ListEditor
            ariaLabel="Taste qualities"
            items={taste.qualities}
            placeholder="e.g. Specific numbers over adjectives"
            onChange={(q) => update((s) => ({ ...s, taste: { ...s.taste, qualities: q } }))}
          />
        </div>
        <div className="card p-5 space-y-3">
          <h3 className="font-semibold text-sm">Add a post I admire</h3>
          <textarea
            className="input text-sm"
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste the post, or a link to it"
            aria-label="Admired post"
          />
          <div className="grid grid-cols-2 gap-2">
            <input className="input text-sm" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Author (optional)" aria-label="Author" />
            <input
              className="input text-sm"
              value={qualities}
              onChange={(e) => setQualities(e.target.value)}
              placeholder="What you admire, comma separated"
              aria-label="Admired qualities"
            />
          </div>
          {error && <p className="text-xs text-warn">{error}</p>}
          <button className="btn btn-sm" type="button" disabled={!text.trim() || busy} onClick={add}>
            {busy ? "Reading…" : "Add to my taste"}
          </button>
        </div>
      </div>
      {taste.admired.length > 0 && (
        <ul className="grid md:grid-cols-2 gap-3">
          {taste.admired.map((a) => (
            <li key={a.id} className="card p-4 space-y-2 text-sm">
              <p className="whitespace-pre-wrap">{a.text}</p>
              {a.author && <p className="text-xs text-muted">— {a.author}</p>}
              <div className="flex flex-wrap gap-1 items-center">
                {a.qualities.map((q) => (
                  <span key={q} className="text-[11px] rounded-full bg-accent-soft text-accent px-2 py-0.5">
                    {q}
                  </span>
                ))}
                <button
                  className="text-xs text-muted ml-auto"
                  type="button"
                  onClick={() => update((s) => ({ ...s, taste: { ...s.taste, admired: s.taste.admired.filter((x) => x.id !== a.id) } }))}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
