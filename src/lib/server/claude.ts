import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";

// Provider details stay behind this module. Each job maps to a model + effort
// level, overridable with env vars so models can be swapped after blind tests.
export type Job = "write" | "analyze" | "edit";

type Effort = "low" | "medium" | "high" | "xhigh" | "max";

const env = process.env;

const JOBS: Record<Job, { model: string; effort: Effort; maxTokens: number }> = {
  // Creative generation: angles, variations, threads.
  write: {
    model: env.MOXIE_WRITER_MODEL ?? "claude-opus-5",
    effort: (env.MOXIE_WRITER_EFFORT as Effort) ?? "medium",
    maxTokens: 16000,
  },
  // Nuanced style analysis: Voice DNA, structure analysis, learning from feedback.
  analyze: {
    model: env.MOXIE_ANALYZE_MODEL ?? env.MOXIE_WRITER_MODEL ?? "claude-opus-5",
    effort: (env.MOXIE_ANALYZE_EFFORT as Effort) ?? "high",
    maxTokens: 16000,
  },
  // Focused edits and checks: fit to X, shorten, de-AI, critique.
  edit: {
    model: env.MOXIE_FAST_MODEL ?? "claude-opus-5",
    effort: (env.MOXIE_FAST_EFFORT as Effort) ?? "low",
    maxTokens: 8000,
  },
};

export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const isMock = () => env.MOXIE_MOCK === "1";

export function modelLabel(provider: Provider | undefined, model: string): string {
  if (provider === "openai") {
    const m = model.match(/^gpt-([\d.]+)(.*)$/i);
    if (!m) return model;
    return `GPT-${m[1]}${m[2].replace(/-(\w)/g, (_, c: string) => ` ${c.toUpperCase()}`)}`;
  }
  const m = model.match(/^claude-(\w+)-(\d+)(?:-(\d+))?/);
  return m ? `Claude ${m[1][0].toUpperCase()}${m[1].slice(1)} ${m[2]}${m[3] ? `.${m[3]}` : ""}` : model;
}

export const claudeModel = (job: Job) => JOBS[job].model;

let client: Anthropic | null = null;
function getClient(): Anthropic {
  client ??= new Anthropic();
  return client;
}

// Server-side refusal fallbacks are available on the Opus 5 / Fable 5 families.
function supportsDefaultFallbacks(model: string): boolean {
  return /^claude-(opus-5|fable-5)/.test(model);
}

export type Provider = "anthropic" | "openai";

export async function structured<S extends z.ZodType>(opts: {
  job: Job;
  system: string;
  content: Anthropic.Beta.BetaContentBlockParam[];
  schema: S;
  mock: () => z.infer<S>;
  provider?: Provider;
}): Promise<z.infer<S>> {
  if (isMock()) {
    await new Promise((r) => setTimeout(r, 400));
    return opts.mock();
  }
  if (opts.provider === "openai") {
    // Loaded lazily so Claude-only setups never touch the OpenAI SDK.
    const { openaiStructured } = await import("./openai");
    return openaiStructured(opts);
  }
  const job = JOBS[opts.job];
  const fallbacks = supportsDefaultFallbacks(job.model);

  let response;
  try {
    response = await getClient().beta.messages.parse({
      model: job.model,
      max_tokens: job.maxTokens,
      thinking: { type: "adaptive" },
      output_config: { effort: job.effort, format: betaZodOutputFormat(opts.schema) },
      // The system prompt is identical across requests of a job, so it is cached.
      system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: opts.content }],
      ...(fallbacks
        ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
        : {}),
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      throw new AppError(500, "The Anthropic API key is missing or invalid. Set ANTHROPIC_API_KEY (or run with MOXIE_MOCK=1 to try the UI).");
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new AppError(429, "Rate limited by the model provider. Try again in a moment.");
    }
    if (error instanceof Anthropic.BadRequestError) {
      throw new AppError(400, `The model rejected the request: ${error.message}`);
    }
    if (error instanceof Anthropic.APIError) {
      throw new AppError(502, `Model provider error (${error.status ?? "network"}): ${error.message}`);
    }
    if (error instanceof Error && /api key|apiKey|authentication/i.test(error.message)) {
      throw new AppError(500, "No Anthropic credentials found. Set ANTHROPIC_API_KEY (or run with MOXIE_MOCK=1 to try the UI).");
    }
    throw error;
  }

  if (response.stop_reason === "refusal") {
    throw new AppError(422, "The model declined this request. Try rephrasing the idea or removing the source that triggered it.");
  }
  if (response.stop_reason === "max_tokens") {
    throw new AppError(502, "The response was cut off. Try fewer options or a shorter format.");
  }
  if (!response.parsed_output) {
    throw new AppError(502, "The model returned an unexpected response. Please try again.");
  }
  return response.parsed_output as z.infer<S>;
}

export function jsonError(error: unknown): Response {
  if (error instanceof AppError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}
