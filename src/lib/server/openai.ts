import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { z } from "zod";
import { AppError, type Job } from "./claude";

// OpenAI models, used when the author picks OpenAI in the composer. Prompts are
// shared with Claude; only the transport differs (Responses API + structured output).

const env = process.env;
export const DEFAULT_OPENAI_MODEL = "gpt-5.6-sol";

export const openaiAvailable = () => !!env.OPENAI_API_KEY;

export function openaiModel(job: Job): string {
  const main = env.MOXIE_OPENAI_MODEL || DEFAULT_OPENAI_MODEL;
  return job === "edit" ? env.MOXIE_OPENAI_FAST_MODEL || main : main;
}

let client: OpenAI | null = null;

type InputPart = { type: "input_text"; text: string } | { type: "input_image"; image_url: string; detail: "auto" };

function toInput(content: Anthropic.Beta.BetaContentBlockParam[]): InputPart[] {
  const parts: InputPart[] = [];
  for (const b of content) {
    if (b.type === "text") parts.push({ type: "input_text", text: b.text });
    else if (b.type === "image" && b.source.type === "base64") {
      parts.push({ type: "input_image", image_url: `data:${b.source.media_type};base64,${b.source.data}`, detail: "auto" });
    }
  }
  return parts;
}

export async function openaiStructured<S extends z.ZodType>(opts: {
  job: Job;
  system: string;
  content: Anthropic.Beta.BetaContentBlockParam[];
  schema: S;
}): Promise<z.infer<S>> {
  if (!openaiAvailable()) {
    throw new AppError(501, "OpenAI isn't set up. Add OPENAI_API_KEY to .env.local and restart the app.");
  }
  client ??= new OpenAI();
  const model = openaiModel(opts.job);
  const effort = env.MOXIE_OPENAI_REASONING as "low" | "medium" | "high" | undefined;

  let response;
  try {
    response = await client.responses.parse({
      model,
      instructions: opts.system,
      input: [{ role: "user", content: toInput(opts.content) }],
      text: { format: zodTextFormat(opts.schema, "moxie_output") },
      max_output_tokens: opts.job === "edit" ? 8000 : 16000,
      ...(effort ? { reasoning: { effort } } : {}),
    });
  } catch (error) {
    if (error instanceof OpenAI.AuthenticationError) {
      throw new AppError(500, "OpenAI rejected the API key. Check OPENAI_API_KEY.");
    }
    if (error instanceof OpenAI.RateLimitError) {
      throw new AppError(429, "Rate limited by OpenAI (or out of credits). Try again in a moment.");
    }
    if (error instanceof OpenAI.NotFoundError) {
      throw new AppError(400, `OpenAI doesn't recognize the model "${model}". Set MOXIE_OPENAI_MODEL to a model your account can use.`);
    }
    if (error instanceof OpenAI.BadRequestError) {
      throw new AppError(400, `OpenAI rejected the request: ${error.message}`);
    }
    if (error instanceof OpenAI.APIError) {
      throw new AppError(502, `OpenAI error (${error.status ?? "network"}): ${error.message}`);
    }
    throw error;
  }

  if (response.status === "incomplete") {
    throw new AppError(502, "OpenAI's response was cut off. Try fewer options or a shorter format.");
  }
  if (!response.output_parsed) {
    throw new AppError(422, "OpenAI declined or returned an unexpected response. Try rephrasing, or switch to Claude.");
  }
  return response.output_parsed as z.infer<S>;
}
