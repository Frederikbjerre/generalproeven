import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { supabaseEnabled } from "./supabase/config";

const MODEL = "claude-sonnet-5-5";

const client = new Anthropic();

export class ClaudeError extends Error {}

type Effort = "low" | "medium" | "high";

function requireKey() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ClaudeError("Mangler ANTHROPIC_API_KEY. Tilføj den i .env.local og genstart serveren.");
  }
  // On Vercel without Supabase there is no login, so anyone could spend the API credit.
  if (process.env.VERCEL && !supabaseEnabled && process.env.ALLOW_PUBLIC_AI !== "1") {
    throw new ClaudeError(
      "AI er slået fra på denne offentlige side, fordi login ikke er sat op. Sæt Supabase op, eller sæt ALLOW_PUBLIC_AI=1.",
    );
  }
}

function toClaudeError(err: unknown): unknown {
  if (err instanceof Anthropic.AuthenticationError) {
    return new ClaudeError("Mangler eller ugyldig ANTHROPIC_API_KEY på serveren.");
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new ClaudeError("For mange kald lige nu – prøv igen om lidt.");
  }
  if (err instanceof Anthropic.APIError) {
    return new ClaudeError(`AI-kaldet fejlede (${err.status ?? "netværk"}): ${err.message}`);
  }
  return err;
}

/** One structured-output call. Returns the parsed object or throws ClaudeError with a Danish message. */
export async function callJson<T extends z.ZodType>(opts: {
  schema: T;
  system: string;
  user: string;
  effort?: Effort;
  maxTokens?: number;
}): Promise<z.infer<T>> {
  requireKey();
  let response;
  try {
    response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: opts.maxTokens ?? 16000,
      // Server-side fallback: if a safety classifier declines, the API re-runs on a fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: opts.system,
      messages: [{ role: "user", content: opts.user }],
      output_config: {
        effort: opts.effort ?? "medium",
        format: zodOutputFormat(opts.schema),
      },
    });
  } catch (err) {
    throw toClaudeError(err);
  }

  if (response.stop_reason === "refusal") {
    throw new ClaudeError("Modellen afviste at svare på dette materiale.");
  }
  if (response.stop_reason === "max_tokens") {
    throw new ClaudeError("Svaret blev afkortet. Prøv med kortere materiale.");
  }
  if (!response.parsed_output) {
    throw new ClaudeError("Kunne ikke læse AI-svaret som struktureret data.");
  }
  return response.parsed_output as z.infer<T>;
}

/** Streams plain text deltas from one call. Throws ClaudeError on API errors or refusals. */
export async function* streamText(opts: {
  system: string;
  user: string;
  effort?: Effort;
  maxTokens?: number;
}): AsyncGenerator<string> {
  requireKey();
  try {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: opts.maxTokens ?? 2000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: opts.system,
      messages: [{ role: "user", content: opts.user }],
      output_config: { effort: opts.effort ?? "low" },
    });
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield event.delta.text;
      }
    }
    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal") {
      throw new ClaudeError("Modellen afviste at svare.");
    }
  } catch (err) {
    throw toClaudeError(err);
  }
}

export function errorResponse(err: unknown) {
  const message = err instanceof ClaudeError ? err.message : "Uventet fejl på serveren.";
  if (!(err instanceof ClaudeError)) console.error(err);
  return Response.json({ error: message }, { status: 500 });
}
