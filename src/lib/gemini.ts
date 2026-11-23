import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";

/**
 * Gemini access with a small model pool.
 *
 * The free tier limits each model separately (for example 20 requests per day),
 * so a single model runs dry quickly. We keep an ordered list of models, skip
 * the ones that reported an exhausted quota, and move on to the next.
 */

const DEFAULT_MODELS = [
  "gemini-3.5-flash",
  "gemini-3.6-flash",
  "gemini-3.7-flash",
  "gemini-3.8-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
];

const MODELS = (process.env.GEMINI_MODELS || DEFAULT_MODELS.join(","))
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

/** A stalled request must not hang the analysis; time out and try the next model. */
const REQUEST_TIMEOUT_MS = 75_000;

const THINKING = (process.env.GEMINI_THINKING_LEVEL || "LOW").toUpperCase();
const thinkingConfig =
  THINKING in ThinkingLevel
    ? { thinkingLevel: ThinkingLevel[THINKING as keyof typeof ThinkingLevel] }
    : undefined;

const BUSY_MESSAGE = "The AI service is very busy right now. Please try again in a minute.";

export class QuotaError extends Error {
  constructor() {
    super(
      "The free AI quota is used up for now. Daily limits reset at midnight Pacific time, please try again later.",
    );
  }
}

/** model -> time (ms since epoch) before which we should not call it again */
const unavailableUntil = new Map<string, number>();

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set on the server.");
  client ??= new GoogleGenAI({ apiKey, httpOptions: { timeout: REQUEST_TIMEOUT_MS } });
  return client;
}

function jsonSchemaFor(schema: z.ZodType): Record<string, unknown> {
  const js = z.toJSONSchema(schema) as Record<string, unknown>;
  delete js.$schema;
  return js;
}

function statusOf(err: unknown): number | undefined {
  const e = err as { status?: number; code?: number };
  return e?.status ?? e?.code;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface QuotaInfo {
  daily: boolean;
  retryAfterMs: number;
}

function readQuotaError(err: unknown): QuotaInfo {
  const text = String((err as Error)?.message ?? err);
  const delay = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(text);
  const retryAfterMs = delay ? Math.ceil(Number(delay[1]) * 1000) : 60_000;
  const daily = /PerDay|per day/i.test(text) || retryAfterMs > 120_000;
  return { daily, retryAfterMs };
}

export interface GenerateResult<T> {
  data: T;
  model: string;
}

export async function generateJson<T>(opts: {
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  maxOutputTokens?: number;
}): Promise<GenerateResult<T>> {
  const ai = getClient();
  const responseJsonSchema = jsonSchemaFor(opts.schema);
  let lastError: unknown;
  let sawQuota = false;
  let triedAny = false;

  // Overloaded models (503) usually recover within seconds, so sweep the pool a few times.
  for (let round = 0; round < 3; round++) {
    let transient = false;
    for (const model of MODELS) {
      if ((unavailableUntil.get(model) ?? 0) > Date.now()) {
        sawQuota = true;
        continue;
      }
      triedAny = true;

      for (let attempt = 0; attempt < 2; attempt++) {
        const started = Date.now();
        try {
          const res = await ai.models.generateContent({
            model,
            contents: opts.prompt,
            config: {
              systemInstruction: opts.system,
              temperature: 0,
              maxOutputTokens: opts.maxOutputTokens ?? 32768,
              responseMimeType: "application/json",
              responseJsonSchema,
              ...(thinkingConfig ? { thinkingConfig } : {}),
            },
          });
          const raw = res.text;
          if (!raw) throw new Error("Model returned an empty response");
          const parsed = opts.schema.safeParse(JSON.parse(raw));
          if (!parsed.success) {
            throw new Error(`Model output did not match the schema: ${parsed.error.message.slice(0, 300)}`);
          }
          console.info(`[gemini] ${model} ok in ${Date.now() - started}ms`);
          return { data: parsed.data, model };
        } catch (err) {
          lastError = err;
          const status = statusOf(err);
          console.warn(
            `[gemini] ${model} failed (${status ?? "no status"}): ${String((err as Error)?.message ?? err).slice(0, 140)}`,
          );

          if (status === 429) {
            sawQuota = true;
            const q = readQuotaError(err);
            if (q.daily) {
              unavailableUntil.set(model, Date.now() + Math.min(q.retryAfterMs, 6 * 3600_000));
              break; // next model
            }
            if (attempt === 0 && q.retryAfterMs <= 25_000) {
              await sleep(q.retryAfterMs + 250);
              continue; // per-minute limit: wait it out once
            }
            unavailableUntil.set(model, Date.now() + 60_000);
            break;
          }
          if (status === 404 || status === 400 || status === 403) {
            unavailableUntil.set(model, Date.now() + 3600_000); // not usable with this key
            break;
          }
          // 5xx, malformed output, network: try the next model, sweep again later
          transient = true;
          break;
        }
      }
    }
    if (!transient) break;
    await sleep(4000 * (round + 1));
  }

  if (sawQuota && (!triedAny || statusOf(lastError) === 429)) throw new QuotaError();
  if (statusOf(lastError) === 503) throw new Error(BUSY_MESSAGE);
  console.error("[gemini] giving up:", lastError);
  throw new Error("The AI model could not complete the request. Please try again in a moment.");
}
