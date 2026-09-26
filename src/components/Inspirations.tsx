"use client";

import { ChevronDown, LoaderCircle, Trash2, UserRoundPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { api, splitSamples, uid, useStore } from "@/lib/store";
import type { Inspiration, InspirationBlueprint, InspirationPost, InspirationStrength } from "@/lib/types";
import { SectionTitle } from "./Shell";

const STRENGTHS: { value: InspirationStrength; label: string; hint: string }[] = [
  { value: "light", label: "A hint", hint: "Your voice, with a few of their techniques" },
  { value: "blend", label: "Blend", hint: "Your ideas, shaped by their rhythm and moves" },
  { value: "strong", label: "Strongly", hint: "Written the way they would, with your ideas" },
];

interface Learned {
  handle?: string;
  name: string;
  avatar?: string;
  bio?: string;
  posts: InspirationPost[];
  blueprint: InspirationBlueprint;
}

export function useInspirations() {
  const { state, update } = useStore();
  const list = state.taste.inspirations ?? [];
  const set = (fn: (l: Inspiration[]) => Inspiration[]) =>
    update((s) => ({ ...s, taste: { ...s.taste, inspirations: fn(s.taste.inspirations ?? []) } }));
  return { list, set };
}

// "Writers I learn from": add an X account you admire, and drafts borrow how
// they write (not what they say).
export function InspirationsSection() {
  const { list, set } = useInspirations();
  const [handle, setHandle] = useState("");
  const [paste, setPaste] = useState(false);
  const [name, setName] = useState("");
  const [posts, setPosts] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [xApi, setXApi] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/inspiration")
      .then((r) => r.json())
      .then((j: { xApi: boolean }) => {
        setXApi(j.xApi);
        if (!j.xApi) setPaste(true);
      })
      .catch(() => setXApi(false));
  }, []);

  async function learn() {
    setBusy(true);
    setError(null);
    try {
      const body = paste ? { name: name.trim(), posts: splitSamples(posts) } : { handle };
      const out = await api<Learned>("/api/inspiration", body);
      const item: Inspiration = { id: uid("i"), ...out, strength: "blend", enabled: true, addedAt: Date.now() };
      set((l) => [item, ...l.filter((x) => !(x.handle && x.handle.toLowerCase() === out.handle?.toLowerCase()))]);
      setHandle("");
      setName("");
      setPosts("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const pasteCount = splitSamples(posts).length;
  const canSubmit = paste ? name.trim() && pasteCount >= 5 : handle.trim().length > 1;

  return (
    <section className="space-y-5" aria-label="Writers I learn from">
      <div className="space-y-2">
        <SectionTitle tone="purple" icon={<UserRoundPlus size={17} />}>
          Writers I learn from
        </SectionTitle>
        <p className="text-sm text-muted max-w-2xl">
          Add an X account whose posts you love. Moxie studies how they write (their openings, rhythm, and signature moves) and
          shapes your drafts with it. It never copies their words, topics, or stories.
        </p>
      </div>

      <form
        className="card p-5 space-y-3 max-w-3xl"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit && !busy) learn();
        }}
      >
        {!paste ? (
          <div className="flex gap-2">
            <div className="flex-1 flex items-center rounded-[0.625rem] border border-line bg-panel-2 focus-within:border-focus">
              <span className="pl-3 text-muted">@</span>
              <input
                className="flex-1 bg-transparent px-1.5 py-2.5 text-sm outline-none placeholder:text-faint"
                placeholder="handle or x.com/handle"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                aria-label="X handle"
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={!canSubmit || busy}>
              {busy ? <LoaderCircle size={15} className="animate-spin" /> : null}
              {busy ? "Studying their posts…" : "Learn their style"}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <input className="input" placeholder="Their name or @handle" value={name} onChange={(e) => setName(e.target.value)} aria-label="Writer name" />
            <textarea
              className="input text-sm"
              rows={6}
              placeholder={"Paste 5+ of their best posts, separated by a blank line"}
              value={posts}
              onChange={(e) => setPosts(e.target.value)}
              aria-label="Their posts"
            />
            <div className="flex items-center gap-3">
              <button className="btn btn-primary" type="submit" disabled={!canSubmit || busy}>
                {busy ? <LoaderCircle size={15} className="animate-spin" /> : null}
                {busy ? "Studying their posts…" : "Learn their style"}
              </button>
              <span className="text-xs text-muted">{pasteCount} posts detected</span>
            </div>
          </div>
        )}
        {error && <p className="text-sm text-warn">{error}</p>}
        <p className="text-xs text-faint">
          {xApi === false ? (
            "Reading X profiles needs an X API token on the server (X_BEARER_TOKEN), so paste their posts for now."
          ) : (
            <>
              {paste ? "Or " : "Uses the X API: about $0.50 per account. Or "}
              <button type="button" className="underline underline-offset-2" onClick={() => setPaste(!paste)}>
                {paste ? "enter an X handle" : "paste their posts instead"}
              </button>
              .
            </>
          )}
        </p>
      </form>

      {list.length > 0 && (
        <ul className="grid lg:grid-cols-2 gap-4">
          {list.map((i) => (
            <InspirationCard
              key={i.id}
              item={i}
              onChange={(next) => set((l) => l.map((x) => (x.id === i.id ? next : x)))}
              onRemove={() => set((l) => l.filter((x) => x.id !== i.id))}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function InspirationCard({ item: i, onChange, onRemove }: { item: Inspiration; onChange: (i: Inspiration) => void; onRemove: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <li className={`card p-5 space-y-4 ${i.enabled ? "" : "opacity-60"}`} data-testid="inspiration">
      <div className="flex items-center gap-3">
        {i.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={i.avatar} alt="" className="h-10 w-10 rounded-full border border-line" />
        ) : (
          <span className="h-10 w-10 rounded-full bg-[#8b7cf6]/15 text-[#a89bff] grid place-items-center font-semibold">
            {i.name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <p className="font-medium truncate">{i.name}</p>
          {i.handle && (
            <a href={`https://x.com/${i.handle}`} target="_blank" rel="noreferrer" className="text-xs text-muted hover:text-fg">
              @{i.handle}
            </a>
          )}
        </div>
        <label className="ml-auto flex items-center gap-2 text-xs text-muted cursor-pointer">
          <input
            type="checkbox"
            className="accent-[var(--accent)]"
            checked={i.enabled}
            onChange={(e) => onChange({ ...i, enabled: e.target.checked })}
            aria-label={`Use ${i.name}'s style`}
          />
          In use
        </label>
        <button type="button" className="text-muted hover:text-bad" onClick={onRemove} aria-label={`Remove ${i.name}`}>
          <Trash2 size={15} />
        </button>
      </div>

      <p className="text-sm text-muted">{i.blueprint.summary}</p>

      <div>
        <span className="label">How much to lean on them</span>
        <div className="inline-flex items-center rounded-full border border-line bg-panel-2 p-1 gap-1" role="radiogroup">
          {STRENGTHS.map((s) => (
            <button
              key={s.value}
              type="button"
              role="radio"
              aria-checked={i.strength === s.value}
              title={s.hint}
              onClick={() => onChange({ ...i, strength: s.value })}
              className={`h-7 px-3 rounded-full text-xs transition-colors ${i.strength === s.value ? "bg-panel-3 text-fg" : "text-muted hover:text-fg"}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-faint mt-1.5">{STRENGTHS.find((s) => s.value === i.strength)?.hint}</p>
      </div>

      <button type="button" className="flex items-center gap-1 text-xs text-muted hover:text-fg" onClick={() => setOpen(!open)} aria-expanded={open}>
        <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        {open ? "Hide" : "See"} what Moxie learned
      </button>
      {open && (
        <div className="space-y-3 text-sm">
          <div>
            <span className="label">Signature moves</span>
            <ul className="space-y-1">
              {i.blueprint.signatureMoves.map((m) => (
                <li key={m} className="flex gap-2">
                  <span className="text-good">✓</span>
                  {m}
                </li>
              ))}
            </ul>
          </div>
          <p>
            <span className="text-muted">Openings: </span>
            {i.blueprint.hooks.join("; ")}
          </p>
          <p>
            <span className="text-muted">Rhythm: </span>
            {i.blueprint.rhythm}
          </p>
          <p>
            <span className="text-muted">Shapes: </span>
            {i.blueprint.structures.map((s) => s.pattern).join("; ")}
          </p>
          <p>
            <span className="text-muted">Never: </span>
            {i.blueprint.avoid.join("; ")}
          </p>
          <p className="text-xs text-faint">Learned from {i.posts.length} of their posts.</p>
        </div>
      )}
    </li>
  );
}
