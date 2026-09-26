"use client";

import {
  ArrowUp,
  Check,
  ChevronDown,
  FileText,
  Fingerprint,
  Image as ImageIcon,
  Layers,
  Link as LinkIcon,
  LoaderCircle,
  PenLine,
  Plus,
  Shuffle,
  SlidersHorizontal,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { POST_TYPES } from "@/lib/options";
import { type SendMode, activeSession, isResponding, patchActive, useStore } from "@/lib/store";
import { findStructure } from "@/lib/structures";
import { MenuItem, Popover } from "./Popover";
import { RefChip, useReferenceActions } from "./References";
import { SettingsPanel, settingsSummary, useSettings } from "./SettingsPanel";
import { TagTextarea, unknownTags } from "./TagTextarea";

export const SEND_MODES: Record<SendMode, { title: string; hint: string; icon: React.ReactNode }> = {
  angles: { title: "Find angles", hint: "Suggests distinct angles first; pick one to get drafts", icon: <Sparkles size={16} /> },
  variations: { title: "Write drafts", hint: "Skip angles and go straight to finished drafts", icon: <PenLine size={16} /> },
  surprise: { title: "Surprise me", hint: "Less obvious takes you probably haven't considered", icon: <Shuffle size={16} /> },
  formats: { title: "Explore formats", hint: "Same idea as a one-liner, short post, long post, and thread", icon: <Layers size={16} /> },
  critique: { title: "Find the real thought", hint: "Diagnose what's weak before polishing, and get one useful question", icon: <Stethoscope size={16} /> },
};

const pillBase = "items-center gap-1.5 rounded-full px-2.5 sm:px-3 h-9 text-sm text-muted whitespace-nowrap hover:bg-panel-2 hover:text-fg transition-colors";
const pill = `inline-flex ${pillBase}`;

export function Composer({
  onSend,
  busy,
  autoFocus,
  menuSide = "top",
}: {
  onSend: (mode: SendMode, text: string) => void;
  busy: boolean;
  autoFocus?: boolean;
  menuSide?: "top" | "bottom"; // "bottom" when the composer sits mid-screen
}) {
  const { state, update } = useStore();
  const session = activeSession(state);
  const { settings, set } = useSettings();
  const { addUrl, addText, addImage } = useReferenceActions();
  const responding = isResponding(settings);
  const hasTarget = session.references.some((r) => r.role === "target");
  const loadingRefs = session.references.some((r) => r.status === "loading");
  const hasReadyRef = session.references.some((r) => r.status === "ready");
  const text = session.draft;
  const mode = state.sendMode;
  const canSend = !busy && !loadingRefs && (!!text.trim() || hasReadyRef) && (mode !== "critique" || !!text.trim());
  const unknown = unknownTags(text, session.references);
  const summary = settingsSummary(settings);
  const structure = findStructure(settings.structureId, state.customStructures);
  const profile = state.profiles.find((p) => p.id === state.activeProfileId);
  const [source, setSource] = useState("");

  const setDraft = (draft: string) => update((s) => patchActive(s, (x) => ({ ...x, draft })));
  const appendTag = (tag: string) =>
    update((s) =>
      patchActive(s, (x) => ({ ...x, draft: `${x.draft}${x.draft && !/\s$/.test(x.draft) ? " " : ""}@${tag} ` })),
    );

  function send() {
    if (!canSend) return;
    onSend(mode, text.trim());
  }

  function addSource() {
    const v = source.trim();
    if (!v) return;
    if (/^https?:\/\/\S+$/.test(v)) addUrl(v);
    else addText(v, "target");
    setSource("");
  }

  const postType = POST_TYPES.find((p) => p.value === settings.postType)!;

  return (
    <div className="w-full">
      <div className="rounded-[28px] border border-line bg-panel shadow-[0_8px_30px_rgba(0,0,0,0.06)] focus-within:border-muted/50 transition-colors">
        {/* Sources attached to this conversation */}
        {(session.references.length > 0 || (responding && !hasTarget)) && (
          <div className="flex flex-wrap gap-2 px-4 pt-3">
            {session.references.map((r) => (
              <RefChip key={r.id} reference={r} />
            ))}
            {responding && !hasTarget && (
              <form
                className="flex-1 min-w-[16rem] flex items-center gap-2 rounded-xl border border-dashed border-line px-3 py-1.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  addSource();
                }}
              >
                <span className="text-xs text-muted shrink-0">{settings.postType === "reply" ? "Replying to" : "Quoting"}</span>
                <input
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
                  placeholder="paste the post's link or text"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  aria-label="Source post"
                />
                <button type="submit" className="text-xs font-medium text-accent disabled:opacity-40" disabled={!source.trim()}>
                  Add
                </button>
              </form>
            )}
          </div>
        )}

        <div className="px-4 pt-2">
          <TagTextarea
            ariaLabel="Message"
            autoFocus={autoFocus}
            value={text}
            onChange={setDraft}
            references={session.references}
            onPasteUrl={(url) => addUrl(url)}
            onSubmit={send}
            minRows={1}
            placeholder={
              responding
                ? "Your take (optional). Leave blank to see angles, or jot a rough thought."
                : "What are you thinking about?"
            }
          />
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-1 px-2 pb-2 pt-1">
          <AttachMenu
            side={menuSide}
            onLink={(u) => appendTag(addUrl(u))}
            onText={(t) => appendTag(addText(t))}
            onImage={async (f) => {
              const tag = await addImage(f);
              if (tag) appendTag(tag);
            }}
          />

          <Popover
            side={menuSide}
            label="Post type"
            panelClassName="w-72 p-1.5"
            trigger={() => (
              <span className={pill} data-testid="post-type">
                {postType.label}
                <ChevronDown size={14} />
              </span>
            )}
          >
            {(close) => (
              <div role="menu">
                {POST_TYPES.map((p) => (
                  <MenuItem
                    key={p.value}
                    title={p.label}
                    hint={p.hint}
                    active={p.value === settings.postType}
                    icon={p.value === settings.postType ? <Check size={16} /> : <span className="inline-block w-4" />}
                    onClick={() => {
                      set({ postType: p.value });
                      close();
                    }}
                  />
                ))}
              </div>
            )}
          </Popover>

          <Popover
            side={menuSide}
            label="Settings"
            panelClassName="w-[min(26rem,calc(100vw-2rem))]"
            trigger={() => (
              <span className={pill}>
                <SlidersHorizontal size={15} />
                <span className="hidden sm:inline">{summary.length ? summary.slice(0, 2).join(" · ") : "Settings"}</span>
                {summary.length > 2 && <span className="text-xs">+{summary.length - 2}</span>}
              </span>
            )}
          >
            {() => <SettingsPanel />}
          </Popover>

          <Popover
            side={menuSide}
            label="Voice"
            panelClassName="w-64 p-1.5"
            trigger={() => (
              <span className={`hidden sm:inline-flex ${pillBase}`}>
                <Fingerprint size={15} />
                {profile?.name ?? "No voice"}
              </span>
            )}
          >
            {(close) => (
              <div role="menu">
                {state.profiles.map((p) => (
                  <MenuItem
                    key={p.id}
                    title={p.name}
                    hint={p.archetype || undefined}
                    active={p.id === state.activeProfileId}
                    icon={p.id === state.activeProfileId ? <Check size={16} /> : <span className="inline-block w-4" />}
                    onClick={() => {
                      update((s) => ({ ...s, activeProfileId: p.id }));
                      close();
                    }}
                  />
                ))}
                <MenuItem
                  title="No voice profile"
                  hint="Plain, natural register"
                  active={!state.activeProfileId}
                  icon={!state.activeProfileId ? <Check size={16} /> : <span className="inline-block w-4" />}
                  onClick={() => {
                    update((s) => ({ ...s, activeProfileId: null }));
                    close();
                  }}
                />
                <Link href="/voice" className="block px-3 py-2 text-sm text-accent hover:bg-panel-2 rounded-xl">
                  {state.profiles.length ? "Manage voices →" : "Teach it your voice →"}
                </Link>
              </div>
            )}
          </Popover>

          <div className="ml-auto flex items-center gap-1">
            <Popover
              side={menuSide}
              label="What send does"
              align="end"
              panelClassName="w-80 p-1.5"
              trigger={() => (
                <span className={pill} data-testid="send-mode">
                  {SEND_MODES[mode].icon}
                  <span className="hidden sm:inline">{SEND_MODES[mode].title}</span>
                  <ChevronDown size={14} />
                </span>
              )}
            >
              {(close) => (
                <div role="menu">
                  {(Object.keys(SEND_MODES) as SendMode[]).map((m) => (
                    <MenuItem
                      key={m}
                      icon={SEND_MODES[m].icon}
                      title={SEND_MODES[m].title}
                      hint={SEND_MODES[m].hint}
                      active={m === mode}
                      onClick={() => {
                        update((s) => ({ ...s, sendMode: m }));
                        close();
                      }}
                    />
                  ))}
                </div>
              )}
            </Popover>
            <button
              type="button"
              onClick={send}
              disabled={!canSend}
              aria-label={SEND_MODES[mode].title}
              title={loadingRefs ? "Reading links…" : SEND_MODES[mode].title}
              className="h-9 w-9 rounded-full bg-fg text-bg grid place-items-center disabled:opacity-25 transition-opacity"
            >
              {busy || loadingRefs ? <LoaderCircle size={18} className="animate-spin" /> : <ArrowUp size={18} />}
            </button>
          </div>
        </div>
      </div>

      {(unknown.length > 0 || structure) && (
        <p className="text-xs text-muted mt-2 px-4 space-x-3">
          {unknown.length > 0 && (
            <span className="text-warn">
              {unknown.map((t) => `@${t}`).join(", ")} {unknown.length === 1 ? "isn't a source" : "aren't sources"}; sent as a normal mention.
            </span>
          )}
          {structure && (
            <span>
              Structure: <span className="text-fg">{structure.name}</span>{" "}
              <button type="button" className="underline" onClick={() => set({ structureId: null })}>
                remove
              </button>
            </span>
          )}
        </p>
      )}
    </div>
  );
}

function AttachMenu({
  side,
  onLink,
  onText,
  onImage,
}: {
  side: "top" | "bottom";
  onLink: (url: string) => void;
  onText: (text: string) => void;
  onImage: (file: File) => void;
}) {
  const [view, setView] = useState<"menu" | "link" | "text">("menu");
  const [value, setValue] = useState("");
  const file = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={file}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="hidden"
        aria-label="Upload image"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onImage(f);
        }}
      />
      <Popover
        side={side}
        label="Add a source"
        panelClassName="w-80 p-1.5"
        trigger={() => (
          <span className="h-9 w-9 rounded-full grid place-items-center text-muted hover:bg-panel-2 hover:text-fg" onClick={() => setView("menu")}>
            <Plus size={20} />
          </span>
        )}
      >
        {(close) =>
          view === "menu" ? (
            <div role="menu">
              <MenuItem icon={<LinkIcon size={16} />} title="Add a link" hint="A post on X, an article, or any page" onClick={() => setView("link")} />
              <MenuItem icon={<FileText size={16} />} title="Paste text" hint="A post, notes, a quote, a stat" onClick={() => setView("text")} />
              <MenuItem
                icon={<ImageIcon size={16} />}
                title="Upload an image"
                hint="A screenshot or photo to write about"
                onClick={() => {
                  close();
                  file.current?.click();
                }}
              />
              <p className="px-3 py-2 text-xs text-muted">Tip: paste a link straight into the message box, and type @ to refer to a source.</p>
            </div>
          ) : (
            <form
              className="p-2 space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                const v = value.trim();
                if (!v) return;
                if (view === "link") {
                  if (!/^https?:\/\//.test(v)) return;
                  onLink(v);
                } else onText(v);
                setValue("");
                setView("menu");
                close();
              }}
            >
              {view === "link" ? (
                <input autoFocus className="input" placeholder="https://…" value={value} onChange={(e) => setValue(e.target.value)} aria-label="Link" />
              ) : (
                <textarea autoFocus className="input" rows={4} placeholder="Paste text…" value={value} onChange={(e) => setValue(e.target.value)} aria-label="Text source" />
              )}
              <div className="flex gap-2 justify-end">
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => setView("menu")}>
                  Back
                </button>
                <button type="submit" className="btn btn-sm btn-primary" disabled={!value.trim() || (view === "link" && !/^https?:\/\//.test(value.trim()))}>
                  Add
                </button>
              </div>
            </form>
          )
        }
      </Popover>
    </>
  );
}
