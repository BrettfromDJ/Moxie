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

**Write** (`/`): a dark, Fey-inspired workspace
- A floating dock at the bottom switches between Write, Voice & taste, Structures, De-AI, Library, and recent drafts. **⌘K** (or the search button) opens a command menu. Use it to search past drafts, start a new one, change the post type, send mode, or voice, and jump to any page.
- The page header shows the current settings as filter pills (for example **Post | Reply**, **Length | Tight ×**). Click a pill to change it, click × to reset it, or click **+** for every setting.
- The composer works like a command bar: a panel for your message, then an action bar with **+** (sources), a summary of your settings, and the send button. Enter sends and Shift+Enter adds a new line. What's one click away:
  - **+**: add a link, pasted text, or an image as a source.
  - **Post type** and **Voice** (header pills): original, quote, reply, announcement, link, image, or remix, and which voice profile to write in.
  - **All settings** (the header's **+**): a Midjourney-style panel of pill options for format, length, number of options, creativity, angle, reply relationship, goal, style, structure, and X Premium limits.
  - **Send mode** (the arrow next to the send button): **Find angles** (the default), **Write drafts**, **Surprise me**, **Explore formats**, or **Find the real thought** (a critique of your draft).
- Results appear as a conversation. Angles show as a numbered table, like a stock screener; click one to get drafts. Button actions ("More like #2", "Push #1 further", "Fresh set", "5 different directions", "Try other formats") show up as small bubbles in the conversation. Follow-up messages keep the earlier context.
- Each draft card shows the text, one line of facts (X character count, reading time, a voice-match estimate, and any problems), and an icon row: copy, edit, more like this, never like this, push further, and Fit to X. Less common actions sit in a "…" menu: ask for a change, shorten, De-AI, strengthen the hook or opening, improve pacing, save, and "I posted this".
- Threads display as numbered posts. Hover a post to reorder, shorten, or delete it.
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

**Structures** (`/structures`): a library of reusable mechanics ("Setup → expectation → flip", old world vs. new world, compressed insight…). Paste a post you admire to break it into hook / context / turn / payoff, save the structure, and **use it with your idea**.

**De-AI** (`/de-ai`): a standalone checker, usable without a profile. It gives instant pattern hits plus model-flagged issues, with suggestions and a cleaner rewrite.

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
