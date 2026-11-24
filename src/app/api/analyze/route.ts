import { InputError, MAX_PAGES } from "@/lib/analyze";
import { analyzeWithCache } from "@/lib/cache";
import { QuotaError } from "@/lib/gemini";
import { extractPagesFromPdf } from "@/lib/pdf-server";
import type { StreamEvent } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // Vercel's request body limit is 4.5 MB

class BadRequest extends Error {}

/**
 * POST /api/analyze
 *  - application/json:        { fileName, pages: string[] }   (used by the web UI)
 *  - multipart/form-data:     file=<pdf>                      (for scripts and other clients)
 *  - add ?stream=1 to receive newline-delimited progress events, otherwise plain JSON.
 */
async function readInput(req: Request): Promise<{ pages: string[]; fileName: string }> {
  const type = req.headers.get("content-type") ?? "";

  if (type.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new BadRequest('Attach the PDF as a form field named "file".');
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new BadRequest(
        "File is over the 4 MB upload limit. Use the web app, which reads the PDF in your browser.",
      );
    }
    try {
      const pages = await extractPagesFromPdf(new Uint8Array(await file.arrayBuffer()));
      return { pages, fileName: file.name };
    } catch {
      throw new BadRequest("Could not read that file as a PDF.");
    }
  }

  let body: { pages?: unknown; fileName?: unknown };
  try {
    body = await req.json();
  } catch {
    throw new BadRequest("Send JSON { fileName, pages } or a multipart PDF upload.");
  }
  if (!Array.isArray(body.pages) || body.pages.some((p) => typeof p !== "string")) {
    throw new BadRequest("`pages` must be an array of strings, one per PDF page.");
  }
  if (body.pages.length > MAX_PAGES) throw new BadRequest(`Too many pages (limit ${MAX_PAGES}).`);
  return {
    pages: body.pages as string[],
    fileName: typeof body.fileName === "string" && body.fileName ? body.fileName : "document.pdf",
  };
}

export async function POST(req: Request) {
  const wantsStream = new URL(req.url).searchParams.get("stream") === "1";

  let input: { pages: string[]; fileName: string };
  try {
    input = await readInput(req);
  } catch (err) {
    const message = err instanceof BadRequest ? err.message : "Invalid request.";
    return Response.json({ error: message }, { status: 400 });
  }

  if (!wantsStream) {
    try {
      const report = await analyzeWithCache(input);
      return Response.json(report);
    } catch (err) {
      return Response.json({ error: errorMessage(err) }, { status: statusFor(err) });
    }
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: StreamEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        const report = await analyzeWithCache({
          ...input,
          onProgress: (stage, message) => send({ type: "stage", stage, message }),
        });
        send({ type: "result", report });
      } catch (err) {
        send({ type: "error", message: errorMessage(err) });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function statusFor(err: unknown): number {
  if (err instanceof QuotaError) return 429;
  if (err instanceof InputError) return 422;
  return 500;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Analysis failed.";
}
