"use client";

import { Bookmark, ChartNoAxesColumn, Heart, MessageCircle, Monitor, Repeat2, Smartphone, Upload } from "lucide-react";
import { useState } from "react";
import { activeProfile, type Identity, useStore } from "@/lib/store";
import { X_LIMIT, splitAtLimit, xLength } from "@/lib/xcount";

// Renders drafts the way they'll look on X (dark mode), so you can see how
// lines wrap and stack, where a long post gets "Show more", and what spills
// past the character limit.

const X = {
  bg: "#000000",
  border: "#2f3336",
  text: "#e7e9ea",
  muted: "#71767b",
  link: "#1d9bf0",
  overflowBg: "rgba(244, 33, 46, 0.28)",
};
const X_FONT = `"Chirp", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
const TOKEN_RE = /(https?:\/\/[^\s]+|@\w{1,15}|#\w+|\[[^\]\n]{1,80}\])/g;

export function useIdentity(): Required<Pick<Identity, "name" | "handle">> & { avatar?: string } {
  const { state } = useStore();
  const profile = activeProfile(state);
  return {
    name: state.identity.name.trim() || profile?.name || "You",
    handle: (state.identity.handle.trim() || "you").replace(/^@/, ""),
    avatar: state.identity.avatar,
  };
}

function Rich({ text }: { text: string }) {
  const parts = text.split(TOKEN_RE);
  return (
    <>
      {parts.map((p, i) => {
        if (!p) return null;
        if (/^https?:\/\//.test(p)) {
          const shown = p.replace(/^https?:\/\/(www\.)?/, "");
          return (
            <span key={i} style={{ color: X.link }}>
              {shown.length > 23 ? `${shown.slice(0, 23)}…` : shown}
            </span>
          );
        }
        if (/^[@#]\w/.test(p)) return <span key={i} style={{ color: X.link }}>{p}</span>;
        if (/^\[[^\]]+\]$/.test(p))
          return (
            <span key={i} className="rounded px-0.5" style={{ background: "rgba(245,176,65,0.18)", color: "#f5b041" }} title="Placeholder: fill this in before posting">
              {p}
            </span>
          );
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

export function Avatar({ size = 40 }: { size?: number }) {
  const id = useIdentity();
  if (id.avatar) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={id.avatar} alt="" width={size} height={size} className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />;
  }
  return (
    <span
      className="rounded-full shrink-0 grid place-items-center font-semibold text-white"
      style={{ width: size, height: size, background: "linear-gradient(135deg,#8b7cf6,#e3a07a)", fontSize: size * 0.42 }}
      aria-hidden
    >
      {id.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function Tweet({
  text,
  limit,
  connectAbove,
  connectBelow,
  trailing,
}: {
  text: string;
  limit: number;
  connectAbove?: boolean;
  connectBelow?: boolean;
  trailing?: React.ReactNode;
}) {
  const id = useIdentity();
  const [expanded, setExpanded] = useState(false);
  const premium = limit > X_LIMIT;
  const length = xLength(text);
  // Standard accounts: show what spills past the limit, like X's composer.
  const [fits, overflow] = !premium && length > limit ? splitAtLimit(text, limit) : [text, ""];
  // Long posts (Premium): the timeline cuts off around 280 and shows "Show more".
  const cut = premium && length > X_LIMIT && !expanded ? splitAtLimit(text, X_LIMIT)[0].trimEnd() : null;

  return (
    <div className="group/tweet relative flex gap-3 px-4" style={{ paddingTop: connectAbove ? 4 : 12 }}>
      <div className="flex flex-col items-center">
        {connectAbove && <span className="absolute top-0 h-1 w-0.5" style={{ background: X.border, left: 35 }} />}
        <Avatar />
        {connectBelow && <span className="w-0.5 flex-1 mt-1" style={{ background: X.border }} />}
      </div>
      <div className="min-w-0 flex-1" style={{ paddingBottom: connectBelow ? 8 : 12 }}>
        <div className="flex items-center gap-1 text-[15px] leading-5 min-w-0">
          <span className="font-bold truncate" style={{ color: X.text }}>
            {id.name}
          </span>
          <span className="truncate" style={{ color: X.muted }}>
            @{id.handle}
          </span>
          <span className="shrink-0 whitespace-nowrap" style={{ color: X.muted }}>
            · now
          </span>
        </div>
        {trailing && (
          <span
            className="absolute right-2 top-1.5 z-10 flex items-center rounded-lg px-1 opacity-100 sm:opacity-0 group-hover/tweet:opacity-100 focus-within:opacity-100 transition-opacity"
            style={{ background: X.bg, boxShadow: `0 0 0 1px ${X.border}` }}
          >
            {trailing}
          </span>
        )}
        <div className="mt-0.5 text-[15px] leading-5 whitespace-pre-wrap break-words" style={{ color: X.text, fontFamily: X_FONT }} data-testid="tweet-text">
          {cut !== null ? (
            <>
              <Rich text={cut} />
              {"… "}
              <button type="button" onClick={() => setExpanded(true)} style={{ color: X.link }} className="hover:underline">
                Show more
              </button>
            </>
          ) : (
            <>
              <Rich text={fits} />
              {overflow && (
                <span style={{ background: X.overflowBg }} title={`${length - limit} characters over X's ${limit} limit`} data-testid="tweet-overflow">
                  {overflow}
                </span>
              )}
            </>
          )}
        </div>
        <div className="mt-3 flex justify-between max-w-[425px] pr-2" style={{ color: X.muted }} aria-hidden>
          <MessageCircle size={17} />
          <Repeat2 size={17} />
          <Heart size={17} />
          <ChartNoAxesColumn size={17} />
          <span className="flex gap-3">
            <Bookmark size={17} />
            <Upload size={17} />
          </span>
        </div>
      </div>
    </div>
  );
}

// The X-style frame around one post or a thread, sized like X's column on desktop or a phone.
export function TweetFrame({ children }: { children: React.ReactNode }) {
  const { state } = useStore();
  const phone = state.previewDevice === "phone";
  return (
    <div
      className="mx-auto rounded-2xl overflow-hidden transition-[max-width] duration-200"
      style={{ background: X.bg, border: `1px solid ${X.border}`, maxWidth: phone ? 390 : 598, fontFamily: X_FONT }}
      data-testid="tweet-frame"
    >
      {children}
    </div>
  );
}

export function DeviceToggle() {
  const { state, update } = useStore();
  const btn = (device: "desktop" | "phone", label: string, icon: React.ReactNode) => (
    <button
      type="button"
      aria-label={`Preview on ${label}`}
      aria-pressed={state.previewDevice === device}
      title={`Preview on ${label}`}
      onClick={() => update((s) => ({ ...s, previewDevice: device }))}
      className={`h-6 w-7 grid place-items-center rounded-md transition-colors ${state.previewDevice === device ? "bg-panel-3 text-fg" : "text-faint hover:text-fg"}`}
    >
      {icon}
    </button>
  );
  return (
    <span className="inline-flex items-center gap-0.5 rounded-lg border border-line p-0.5">
      {btn("desktop", "desktop", <Monitor size={13} />)}
      {btn("phone", "phone", <Smartphone size={13} />)}
    </span>
  );
}

async function downscaleAvatar(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const size = 96;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const scale = Math.max(size / bitmap.width, size / bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  canvas.getContext("2d")!.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h);
  return canvas.toDataURL("image/jpeg", 0.85);
}

// Name, handle and photo used in previews, with a live sample post.
export function IdentityEditor() {
  const { state, update } = useStore();
  const id = state.identity;
  const set = (p: Partial<Identity>) => update((s) => ({ ...s, identity: { ...s.identity, ...p } }));
  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-6 items-start">
      <div className="card p-5 space-y-3">
        <label className="block">
          <span className="label">Display name</span>
          <input className="input" value={id.name} onChange={(e) => set({ name: e.target.value })} placeholder="Your name on X" aria-label="Display name" />
        </label>
        <label className="block">
          <span className="label">Handle</span>
          <div className="flex items-center rounded-[0.625rem] border border-line bg-panel-2 focus-within:border-focus">
            <span className="pl-3 text-muted">@</span>
            <input
              className="flex-1 bg-transparent px-1.5 py-2 text-sm outline-none placeholder:text-faint"
              value={id.handle}
              onChange={(e) => set({ handle: e.target.value.replace(/^@/, "").replace(/[^\w]/g, "").slice(0, 15) })}
              placeholder="yourhandle"
              aria-label="Handle"
            />
          </div>
        </label>
        <div className="flex items-center gap-3">
          <Avatar size={36} />
          <label className="btn btn-sm cursor-pointer">
            Upload photo
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              aria-label="Upload profile photo"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) set({ avatar: await downscaleAvatar(f) });
              }}
            />
          </label>
          {id.avatar && (
            <button type="button" className="text-xs text-muted hover:text-fg" onClick={() => set({ avatar: undefined })}>
              Remove
            </button>
          )}
        </div>
        <p className="text-xs text-faint">Only used for previews in Moxie. Nothing is posted to X.</p>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted">
          <span>Preview</span>
          <DeviceToggle />
        </div>
        <TweetFrame>
          <Tweet text={"shipped the new onboarding today. 4 screens down to 1.\n\nactivation went from 31% to 44% in the first week"} limit={X_LIMIT} />
        </TweetFrame>
      </div>
    </div>
  );
}
