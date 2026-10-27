import { z } from "zod";
import { AiUnavailableError } from "@/lib/errors";
import type { AIProvider, JsonRequest, JsonResult } from "./provider";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const TIMEOUT_MS = 30_000;
/** Statuses where trying the next model can help: model retired, rate limited, overloaded. */
const TRY_NEXT_MODEL = new Set([404, 408, 429, 500, 502, 503, 504]);

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  usageMetadata?: { totalTokenCount?: number };
  error?: { message?: string };
};

class AttemptError extends Error {
  constructor(message: string, readonly tryNext: boolean) {
    super(message);
  }
}

/** JSON Schema for Gemini's structured output, from the same zod schema that validates the reply. */
function responseSchema(schema: z.ZodType): unknown {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  delete json.$schema;
  return json;
}

/**
 * Gemini over plain REST (no SDK). Models are tried in order: a retired, rate-limited or
 * overloaded model falls through to the next one. Output is constrained by a JSON schema and
 * then validated again with zod, because a schema hint is not a guarantee.
 */
export function createGeminiProvider({ apiKey, models }: { apiKey: string; models: string[] }): AIProvider {
  async function attempt<T>(model: string, req: JsonRequest<T>): Promise<{ value: T; tokens: number }> {
    let res: Response;
    try {
      res = await fetch(`${ENDPOINT}/${model}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: req.system }] },
          contents: [{ role: "user", parts: [{ text: req.prompt }] }],
          generationConfig: {
            temperature: req.temperature ?? 0.2,
            responseMimeType: "application/json",
            responseJsonSchema: responseSchema(req.schema),
          },
        }),
      });
    } catch (err) {
      throw new AttemptError(err instanceof Error ? err.message : "request failed", true);
    }

    const body = (await res.json().catch(() => ({}))) as GeminiResponse;
    if (!res.ok) throw new AttemptError(`HTTP ${res.status}: ${body.error?.message ?? "no message"}`, TRY_NEXT_MODEL.has(res.status));

    const text = (body.candidates?.[0]?.content?.parts ?? [])
      .filter(p => !p.thought && typeof p.text === "string")
      .map(p => p.text)
      .join("");
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new AttemptError(`reply was not JSON (finishReason ${body.candidates?.[0]?.finishReason ?? "unknown"})`, true);
    }
    const result = req.schema.safeParse(parsed);
    if (!result.success) throw new AttemptError(`reply failed validation: ${result.error.issues[0]?.message}`, true);
    return { value: result.data, tokens: body.usageMetadata?.totalTokenCount ?? 0 };
  }

  return {
    name: "gemini",
    async generateJson<T>(req: JsonRequest<T>): Promise<JsonResult<T>> {
      for (const model of models) {
        const started = Date.now();
        try {
          const { value, tokens } = await attempt(model, req);
          const ms = Date.now() - started;
          console.info(`[ai] ${req.feature} model=${model} tokens=${tokens} ms=${ms}`);
          return { value, model, tokens, ms };
        } catch (err) {
          const e = err instanceof AttemptError ? err : new AttemptError(String(err), false);
          console.warn(`[ai] ${req.feature} model=${model} failed after ${Date.now() - started}ms: ${e.message}`);
          if (!e.tryNext) break;
        }
      }
      throw new AiUnavailableError();
    },
  };
}
