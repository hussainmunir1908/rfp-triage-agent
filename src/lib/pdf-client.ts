"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";
import { normalize } from "./verify";

/**
 * Browser-side PDF handling. Reading the PDF in the browser means only the
 * extracted text (a few hundred KB) is sent to the server, so large RFPs are
 * not blocked by the serverless request-size limit.
 */

type PdfJs = typeof import("pdfjs-dist");
let pdfjsPromise: Promise<PdfJs> | null = null;

async function loadPdfjs(): Promise<PdfJs> {
  pdfjsPromise ??= import("pdfjs-dist").then((mod) => {
    mod.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
    return mod;
  });
  return pdfjsPromise;
}

export async function openPdf(file: File): Promise<PDFDocumentProxy> {
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  return pdfjs.getDocument({ data }).promise;
}

interface TextItemLike {
  str: string;
  hasEOL?: boolean;
}

function isTextItem(item: unknown): item is TextItemLike {
  return typeof item === "object" && item !== null && "str" in item;
}

export async function extractPages(
  pdf: PDFDocumentProxy,
  onPage?: (page: number, total: number) => void,
): Promise<string[]> {
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let text = "";
    for (const item of content.items) {
      if (!isTextItem(item)) continue;
      text += item.str;
      text += item.hasEOL ? "\n" : " ";
    }
    pages.push(text.replace(/[ \t]+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim());
    page.cleanup();
    onPage?.(i, pdf.numPages);
  }
  return pages;
}

export interface HighlightBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface RenderedPage {
  width: number;
  height: number;
  boxes: HighlightBox[];
  /** Whether the quote text was located on the rendered page. */
  found: boolean;
}

/** Draws a page onto a canvas and returns boxes covering the quoted words. */
export async function renderPageWithHighlight(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  quote: string,
  targetWidth: number,
  signal?: AbortSignal,
): Promise<RenderedPage> {
  const pdfjs = await loadPdfjs();
  const page = await pdf.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.max(0.5, Math.min(2.5, targetWidth / base.width));
  const viewport = page.getViewport({ scale });
  const ratio = window.devicePixelRatio || 1;

  canvas.width = Math.floor(viewport.width * ratio);
  canvas.height = Math.floor(viewport.height * ratio);
  canvas.style.width = `${Math.floor(viewport.width)}px`;
  canvas.style.height = `${Math.floor(viewport.height)}px`;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");

  const task = page.render({
    canvas,
    canvasContext: ctx,
    viewport,
    transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined,
  });
  signal?.addEventListener("abort", () => task.cancel());
  try {
    await task.promise;
  } catch (err) {
    if (signal?.aborted) return { width: viewport.width, height: viewport.height, boxes: [], found: false };
    throw err;
  }

  const content = await page.getTextContent();
  // Compare with all punctuation and spacing removed: pdf.js often splits a
  // single word across several text items, so spaces cannot be trusted.
  const squash = (t: string) => normalize(t).replace(/ /g, "");
  type Placed = { start: number; end: number; box: HighlightBox; squashed: string };
  const placed: Placed[] = [];
  let joined = "";
  for (const item of content.items) {
    if (!isTextItem(item) || !("transform" in item) || !("width" in item)) continue;
    const squashed = squash(item.str);
    if (!squashed) continue;
    const tx = pdfjs.Util.transform(viewport.transform, (item as { transform: number[] }).transform);
    const height = Math.hypot(tx[2], tx[3]);
    const start = joined.length;
    joined += squashed;
    placed.push({
      start,
      end: joined.length,
      squashed,
      box: {
        left: tx[4],
        top: tx[5] - height,
        width: (item as { width: number }).width * scale,
        height,
      },
    });
  }

  const q = squash(quote);
  let boxes: HighlightBox[] = [];
  let found = false;
  const at = q.length >= 6 ? joined.indexOf(q) : -1;
  if (at >= 0) {
    const stop = at + q.length;
    boxes = placed.filter((p) => p.start < stop && p.end > at).map((p) => p.box);
    found = boxes.length > 0;
  } else if (q.length >= 6) {
    // close match: outline the pieces of the page whose text sits inside the quote
    boxes = placed.filter((p) => p.squashed.length > 3 && q.includes(p.squashed)).map((p) => p.box);
    found = boxes.length > 0;
  }
  page.cleanup();
  return { width: viewport.width, height: viewport.height, boxes, found };
}
