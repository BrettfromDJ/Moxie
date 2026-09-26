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

**Write** (`/`)
- A composer that asks "What are you thinking about?" You can enter an idea, paste a draft, or write instructions like "Write a quote tweet of @original using the stat from @research."
- Controls for post type (original, quote, reply, announcement, link, image, remix), format, length, voice, angle, creativity, number of options, goal, structure, and writing mode. Format is kept separate from length. Post type changes the model's instructions.
- **Find the tweet** proposes genuinely different angles first; pick one to get drafts. You can also use **Skip to drafts**, **Surprise me** (less obvious responses), **Explore formats** (one-liner / short / long / thread), and **Explore 5 completely different directions**.
- Quote tweets and replies take the source post plus an optional **"Your take"** field. Leave it blank for angles, jot a rough thought, or paste your draft. Replies also have a relationship control (friend / peer / stranger / customer).
- **Find the real thought** diagnoses a weak draft (vague language, obvious conclusion, missing detail…) and asks one useful question.
- Each result has **More like this**, **Never like this** (with an optional reason), **Push further**, **Edit**, **Fit to X**, **Shorten**, **De-AI this**, a free-form revise box, Save, and "I posted this".
- Threads appear as editable cards with roles (hook, setup, insight, example, takeaway, close). You can reorder, add, or delete posts, shorten one, strengthen the opening, or improve pacing.
- Each result shows weighted X character count, reading time, structure, the voice-match *estimate*, avoid-list and AI-pattern checks, and a warning when it repeats something you already posted. It makes no virality predictions.

**References**
- Every link, pasted text, or image becomes a reference with a stable tag (`@link1`, `@text1`, `@image1`). You can rename a tag (renaming rewrites every use), and typing `@` autocompletes. Pasting a lone URL into the composer adds it automatically.
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
