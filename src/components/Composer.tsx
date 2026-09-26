"use client";

import {
  ChevronDown,
  CornerDownLeft,
  FileText,
  Image as ImageIcon,
  Layers,
  Link as LinkIcon,
  LoaderCircle,
  PenLine,
  Plus,
  Shuffle,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import { useRef, useState } from "react";
import { POST_TYPES } from "@/lib/options";
import { type SendMode, activeSession, isResponding, patchActive, useStore } from "@/lib/store";
import { MenuItem, Popover } from "./Popover";
import { RefChip, useReferenceActions } from "./References";
import { settingsSummary, useSettings } from "./SettingsPanel";
import { Logo } from "./Shell";
import { TagTextarea, unknownTags } from "./TagTextarea";

export const SEND_MODES: Record<SendMode, { title: string; hint: string; icon: React.ReactNode }> = {
  angles: { title: "Find angles", hint: "Suggests distinct angles first; pick one to get drafts", icon: <Sparkles size={16} /> },
  variations: { title: "Write drafts", hint: "Skip angles and go straight to finished drafts", icon: <PenLine size={16} /> },
  surprise: { title: "Surprise me", hint: "Less obvious takes you probably haven't considered", icon: <Shuffle size={16} /> },
  formats: { title: "Explore formats", hint: "Same idea as a one-liner, short post, long post, and thread", icon: <Layers size={16} /> },
  critique: { title: "Find the real thought", hint: "Diagnose what's weak before polishing, and get one useful question", icon: <Stethoscope size={16} /> },
};

// Fey-style command composer: a panel with a context chip and the message,
// and a separate action bar below it.
export function Composer({
  onSend,
  busy,
  autoFocus,
  compact,
}: {
  onSend: (mode: SendMode, text: string) => void;
  busy: boolean;
  autoFocus?: boolean;
  compact?: boolean; // conversation view: hide the header row to save space
}) {
  const { state, update } = useStore();
  const session = activeSession(state);
  const { settings } = useSettings();
  const { addUrl, addText, addImage } = useReferenceActions();
  const responding = isResponding(settings);
  const hasTarget = session.references.some((r) => r.role === "target");
  const loadingRefs = session.references.some((r) => r.status === "loading");
  const hasReadyRef = session.references.some((r) => r.status === "ready");
  const text = session.draft;
  const mode = state.sendMode;
  const canSend = !busy && !loadingRefs && (!!text.trim() || hasReadyRef) && (mode !== "critique" || !!text.trim());
  const unknown = unknownTags(text, session.references);
  const profile = state.profiles.find((p) => p.id === state.activeProfileId);
  const postType = POST_TYPES.find((p) => p.value === settings.postType)!;
  const summary = [postType.label, ...settingsSummary(settings), profile ? `Voice: ${profile.name}` : "No voice profile"].join(", ");
  const [source, setSource] = useState("");

  const setDraft = (draft: string) => update((s) => patchActive(s, (x) => ({ ...x, draft })));
  const appendTag = (tag: string) =>
    update((s) => patchActive(s, (x) => ({ ...x, draft: `${x.draft}${x.draft && !/\s$/.test(x.draft) ? " " : ""}@${tag} ` })));

  function send() {
    if (canSend) onSend(mode, text.trim());
  }

  function addSource() {
    const v = source.trim();
    if (!v) return;
    if (/^https?:\/\/\S+$/.test(v)) addUrl(v);
    else addText(v, "target");
    setSource("");
  }

  return (
    <div className="w-full space-y-2.5">
      <div className="rounded-2xl border border-line bg-panel-2 shadow-[0_24px_70px_rgba(0,0,0,0.45)] focus-within:border-line-strong transition-colors">
        {!compact && (
          <div className="flex items-center gap-3 px-4 py-3 border-b border-line">
            <span className="inline-flex items-center gap-2 rounded-full bg-panel-3 pl-1.5 pr-3 py-1 text-xs font-semibold">
              <span className="h-5 w-5 rounded-full bg-black grid place-items-center">
                <Logo size={13} />
              </span>
              {postType.label}
            </span>
            <span className="ml-auto text-xs text-muted hidden sm:flex items-center gap-1.5">
              {responding ? "Add the post, then your take" : "Type a thought and hit"} <span className="kbd">return</span>
            </span>
          </div>
        )}

        {(session.references.length > 0 || (responding && !hasTarget)) && (
          <div className="flex flex-wrap gap-2 px-5 pt-4">
            {session.references.map((r) => (
              <RefChip key={r.id} reference={r} />
            ))}
            {responding && !hasTarget && (
              <form
                className="flex-1 min-w-[16rem] flex items-center gap-2 rounded-xl border border-dashed border-line-strong px-3 py-1.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  addSource();
                }}
              >
                <span className="text-xs text-muted shrink-0">{settings.postType === "reply" ? "Replying to" : "Quoting"}</span>
                <input
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
                  placeholder="paste the post's link or text"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  aria-label="Source post"
                />
                <button type="submit" className="text-xs font-medium text-fg disabled:opacity-40" disabled={!source.trim()}>
                  Add
                </button>
              </form>
            )}
          </div>
        )}

        <div className={`px-5 ${compact ? "py-3" : "pt-4 pb-6"}`}>
          <TagTextarea
            ariaLabel="Message"
            autoFocus={autoFocus}
            value={text}
            onChange={setDraft}
            references={session.references}
            onPasteUrl={(url) => addUrl(url)}
            onSubmit={send}
            minRows={compact ? 1 : 2}
            placeholder={
              responding
                ? "Your take (optional). Leave blank to see angles."
                : compact
                  ? "Follow up, or start a new thought…"
                  : "A rough thought, a draft, or paste a link…"
            }
          />
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2 h-14 rounded-2xl border border-line bg-panel-2 pl-2 pr-2 shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
        <AttachMenu
          onLink={(u) => appendTag(addUrl(u))}
          onText={(t) => appendTag(addText(t))}
          onImage={async (f) => {
            const tag = await addImage(f);
            if (tag) appendTag(tag);
          }}
        />
        <p className="flex-1 min-w-0 truncate text-sm text-faint" title={summary}>
          {unknown.length > 0 ? (
            <span className="text-warn">
              {unknown.map((t) => `@${t}`).join(", ")} {unknown.length === 1 ? "isn't a source" : "aren't sources"}; sent as a mention
            </span>
          ) : (
            summary
          )}
        </p>
        <div className="flex items-stretch h-10 rounded-xl border border-line bg-panel-3/60">
          <button
            type="button"
            onClick={send}
            disabled={!canSend}
            className="flex items-center gap-2 pl-3.5 pr-3 text-sm font-medium disabled:text-faint rounded-l-xl hover:bg-panel-3 disabled:hover:bg-transparent"
            aria-label={SEND_MODES[mode].title}
            data-testid="send"
          >
            {busy || loadingRefs ? <LoaderCircle size={16} className="animate-spin" /> : SEND_MODES[mode].icon}
            <span className="hidden sm:inline">{loadingRefs ? "Reading links…" : SEND_MODES[mode].title}</span>
            <CornerDownLeft size={14} className="text-muted" />
          </button>
          <Popover
            label="What send does"
            align="end"
            side="top"
            panelClassName="w-80 p-1.5"
            className="flex"
            trigger={() => (
              <span className="flex items-center px-2 border-l border-line text-muted hover:text-fg hover:bg-panel-3 rounded-r-xl cursor-pointer" data-testid="send-mode">
                <ChevronDown size={15} />
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
        </div>
      </div>
    </div>
  );
}

function AttachMenu({
  onLink,
  onText,
  onImage,
}: {
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
        side="top"
        label="Add a source"
        panelClassName="w-80 p-1.5"
        trigger={() => (
          <span
            className="h-10 w-10 grid place-items-center rounded-xl text-muted hover:bg-panel-3 hover:text-fg"
            title="Add a source"
            onClick={() => setView("menu")}
          >
            <Plus size={19} />
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
              <p className="px-3 py-2 text-xs text-muted">Tip: paste a link straight into the message, and type @ to refer to a source.</p>
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
