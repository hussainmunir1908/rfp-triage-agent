import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

export const PRIMARY_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";
const FALLBACKS = (process.env.GEMINI_FALLBACK_MODELS || "gemini-3.6-flash,gemini-3.1-flash-lite")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set on the server.");
  client ??= new GoogleGenAI({ apiKey });
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

export interface GenerateResult<T> {
  data: T;
  model: string;
}

/**
 * Structured generation. Retries transient errors and falls back to other
 * models if the primary one is overloaded or rate limited.
 */
export async function generateJson<T>(opts: {
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  maxOutputTokens?: number;
}): Promise<GenerateResult<T>> {
  const ai = getClient();
  const models = [PRIMARY_MODEL, ...FALLBACKS.filter((m) => m !== PRIMARY_MODEL)];
  const responseJsonSchema = jsonSchemaFor(opts.schema);
  let lastError: unknown;

  for (const model of models) {
    for (let attempt = 0; attempt < 3; attempt++) {
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
          },
        });
        const raw = res.text;
        if (!raw) throw new Error("Model returned an empty response");
        const parsed = opts.schema.safeParse(JSON.parse(raw));
        if (!parsed.success) {
          throw new Error(`Model output did not match the schema: ${parsed.error.message.slice(0, 300)}`);
        }
        return { data: parsed.data, model };
      } catch (err) {
        lastError = err;
        const status = statusOf(err);
        const transient = status === 429 || status === 500 || status === 503 || status === undefined;
        if (status === 404 || status === 400 || status === 401 || status === 403) break;
        if (!transient) break;
        await sleep(1500 * 2 ** attempt);
      }
    }
  }
  const message = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`Gemini request failed: ${message.slice(0, 300)}`);
}
