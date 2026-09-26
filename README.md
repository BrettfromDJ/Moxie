# Moxie

A writing tool that turns rough thoughts, drafts, and source material into posts for X that sound like you. It finds stronger angles, applies proven writing structures, and learns your voice and taste over time.

> Teach it what sounds like you, then get several useful ways to say what you mean.

## Run it

```bash
npm install
cp .env.example .env.local   # add your ANTHROPIC_API_KEY
npm run dev                  # http://localhost:3000
```

To try the whole UI without an API key, run `MOXIE_MOCK=1 npm run dev`. Every model call then returns canned data.

## What's in it

**Write** (`/`): a ChatGPT-style layout with a dark, Fey-inspired look
- A sidebar lists your past drafts (conversations), grouped by date. It also has **New draft**, **Search** (⌘K), and links to Voice & taste and Library. It collapses, and on phones it's a slide-out drawer.
- **⌘K** opens a command menu. Use it to search past drafts, start a new one, change the post type, send mode, or voice, and jump to any page.
- One big composer asks "What are you thinking about?". Enter sends and Shift+Enter adds a new line. Its toolbar keeps everything else one click away:
  - **+**: add a link, pasted text, or an image as a source.
  - **Post type**: original, quote, reply, announcement, link, image, or remix.
  - **Settings**: a Midjourney-style panel of pill options for format, length, number of options, creativity, angle, reply relationship, goal, style, and X Premium limits.
  - **Voice**: pick which voice profile to write in, and switch the writers you learn from on or off.
  - **Send mode** (next to the send button): **Find angles** (the default), **Write drafts**, **Surprise me**, **Explore formats**, **Find the real thought** (a critique of your draft), or **Check for AI writing** (paste any post to get flags and a cleaner version).
- Results appear as a conversation. Angles show as a numbered table, like a stock screener; click one to get drafts. Button actions ("More like #2", "Push #1 further", "Fresh set", "5 different directions", "Try other formats") show up as small bubbles in the conversation. Follow-up messages keep the earlier context.
- Each draft card shows the text, one line of facts (X character count, reading time, a voice-match estimate, and any problems), and an icon row: copy, edit, more like this, never like this, push further, and Fit to X. Less common actions sit in a "…" menu: ask for a change, shorten, De-AI, strengthen the hook or opening, improve pacing, save, and "I posted this".
- Drafts are shown as they'll look on X (dark mode), with your name, handle, and photo, and blue links, @mentions, and #hashtags. A **Desktop / Phone** toggle shows how lines wrap at each width. Text past X's limit is highlighted in red, like X's composer. With X Premium on, long posts get X's "Show more" cutoff. [Placeholders] are highlighted so you remember to fill them in.
- Threads display as connected posts. Hover a post to reorder, shorten, or delete it.
- Set the name, handle, and photo used in previews under Voice & taste, in "How your posts look".
- For quotes and replies, the composer asks for the source post, and your message becomes your (optional) take.
- Starter chips on the empty screen set up common tasks: reply to a post, quote tweet, announce something, write a thread, polish a draft.

**References**
- Every link, pasted text, or image becomes a chip above the message box, with a stable tag (`@link1`, `@text1`, `@image1`). Click a chip to rename it (renaming rewrites every use), change its role, or remove it. Typing `@` autocompletes. Pasting a lone URL into the composer adds it automatically.
- Each reference has a role: **target** (what you're responding to), **facts**, **style example only**, or **background**. You can also set "replies to @x" relationships.
- The server fetches link content, not the model: X posts via the X API (if `X_BEARER_TOKEN` is set) or public oEmbed, and pages via Mozilla Readability. If a source can't be read, the card says so and asks you to paste the text instead.
- Your instructions and the source material go to the model in separate blocks. Source content is marked as data, never instructions.

**Voice & taste** (`/voice`)
- Four onboarding paths: paste writing samples, paste links to your posts, connect X (needs `X_BEARER_TOKEN`), or start without examples.
- An editable **Voice DNA** covers writing habits, post habits (openings, structures, endings, hashtags, emoji, CTAs), rules, and an avoid list.
- **Suggest profile updates** turns your likes, rejections, edits, and posted items into proposed rule changes. You approve each one.
- For each request, a small relevant set of your samples is retrieved (TF-IDF plus post-type matching); the whole archive is never sent.
- **My taste** is kept separate from **my voice**. Admired posts teach qualities, never wording.
- A shareable Voice DNA card can be downloaded as a PNG or copied as text. Its stats are measured from your samples.

**Writers I learn from** (on Voice & taste)
- Add an X account you admire, by @handle or profile link. Moxie reads their best-performing recent original posts through the X API (about $0.50 per account; needs `X_BEARER_TOKEN`). Without a token, paste their posts instead.
- It then works out how they write (signature moves, openings, rhythm, recurring shapes, what they never do) and shows you what it learned.
- Choose how much drafts lean on each writer: **A hint** (your voice with a few of their techniques), **Blend**, or **Strongly** (written the way they would, with your ideas). Toggle writers on or off from the composer's Voice menu.
- It never copies their words, topics, or stories. Any draft that comes out too close to one of their real posts is rewritten automatically.

**Structures** are no longer picked by hand. The built-in library, plus the recurring shapes learned from your inspirations, is offered to the model as an optional toolkit, varied across drafts and never forced.

**Library** (`/library`): saved drafts, posted history, and every learning signal. You can delete anything you don't want it to learn from.

## How it's built

- Next.js (App Router) + TypeScript + Tailwind. The app is local-first: profiles, taste, feedback, and drafts live in the browser's `localStorage`. The API routes are stateless and receive only the slice of state each request needs.
- `src/lib/server/claude.ts` keeps the model provider behind one interface. Each job has its own model and effort level, all overridable with env vars, so you can swap models after blind tests:

  | Job | Used for | Default |
  |---|---|---|
  | `write` | angles, drafts, threads, pacing | `claude-opus-5`, effort `medium` |
  | `analyze` | Voice DNA, structure analysis, learning from feedback | `claude-opus-5`, effort `high` |
  | `edit` | Fit to X, shorten, De-AI, critique | `claude-opus-5`, effort `low` |

  Every call uses structured outputs (Zod schemas in `src/lib/server/schemas.ts`), adaptive thinking, a cached system prompt, and server-side refusal fallbacks (`fallbacks: "default"`) on models that support them.
- Prompts are built in `src/lib/server/prompts.ts`. The per-control instructions live in `src/lib/options.ts`.
- **Fit to X** checks the model's output against a weighted character counter (`src/lib/xcount.ts`: URLs count 23, emoji and CJK count 2) and retries once if the output is still over the limit.

## Configuration

See `.env.example`. Only `ANTHROPIC_API_KEY` is required.
