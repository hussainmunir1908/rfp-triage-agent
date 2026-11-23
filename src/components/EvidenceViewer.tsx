"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { renderPageWithHighlight, type HighlightBox } from "@/lib/pdf-client";
import type { EvidenceTarget } from "./evidence-context";
import { Badge } from "./ui";

interface Props {
  pdf: PDFDocumentProxy | null;
  pageCount: number;
  target: EvidenceTarget;
  onClose: () => void;
}

/**
 * Side panel that shows the real PDF page with the cited passage highlighted.
 * Mount it with a fresh `key` for each target so its state starts clean.
 */
export function EvidenceViewer({ pdf, pageCount, target, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  // pdf.js cannot draw onto one canvas twice at once, so renders run one after another.
  const renderQueue = useRef<Promise<unknown>>(Promise.resolve());
  const [page, setPage] = useState(() => Math.min(Math.max(target.evidence.page, 1), Math.max(pageCount, 1)));
  const [boxes, setBoxes] = useState<HighlightBox[]>([]);
  const [found, setFound] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const goTo = (next: number) => {
    setLoading(true);
    setError(null);
    setPage(next);
  };

  useEffect(() => {
    if (!pdf || !canvasRef.current || !bodyRef.current) return;
    let cancelled = false;
    const controller = new AbortController();
    const width = bodyRef.current.clientWidth - 32;
    // Only highlight on the page the evidence points to.
    const quote = page === target.evidence.page ? target.evidence.quote : "";
    const canvas = canvasRef.current;
    const job = renderQueue.current
      .catch(() => undefined)
      .then(() =>
        cancelled ? null : renderPageWithHighlight(pdf, page, canvas, quote, width, controller.signal),
      );
    renderQueue.current = job;
    job
      .then((res) => {
        if (!res) return;
        if (cancelled) return;
        setBoxes(res.boxes);
        setFound(res.found || quote === "");
        setLoading(false);
        const first = res.boxes[0];
        if (first && bodyRef.current) {
          bodyRef.current.scrollTo({ top: Math.max(0, first.top - 120), behavior: "smooth" });
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Could not render this page");
        setLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [target, pdf, page]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const ev = target.evidence;

  return (
    <aside
      role="dialog"
      aria-label="Source in document"
      className="fixed inset-y-0 right-0 z-40 flex w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl"
    >
      <header className="flex items-start justify-between gap-3 border-b border-slate-200 p-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{target.label}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {ev.verified ? (
              <Badge tone={ev.match === "exact" ? "green" : "blue"}>
                {ev.match === "exact" ? "Exact quote found" : "Close match found"}
              </Badge>
            ) : (
              <Badge tone="amber">Quote not found in document</Badge>
            )}
            {ev.corrected_from_page ? (
              <Badge tone="slate">Page corrected from {ev.corrected_from_page}</Badge>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
          aria-label="Close"
        >
          Close
        </button>
      </header>

      <div className="border-b border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Quoted from the document</p>
        <blockquote className="mt-1 border-l-2 border-amber-400 pl-3 text-sm leading-relaxed text-slate-800">
          {ev.quote || "No quote"}
        </blockquote>
        {!ev.verified ? (
          <p className="mt-2 text-xs text-amber-800">
            This text could not be matched to the PDF, so treat the claim as unconfirmed and check the
            document.
          </p>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-2 text-sm">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => goTo(page - 1)}
          className="rounded-md px-2 py-1 text-slate-700 hover:bg-slate-100 disabled:opacity-40"
        >
          Previous
        </button>
        <span className="text-slate-600">
          Page {page} of {pageCount}
        </span>
        <button
          type="button"
          disabled={page >= pageCount}
          onClick={() => goTo(page + 1)}
          className="rounded-md px-2 py-1 text-slate-700 hover:bg-slate-100 disabled:opacity-40"
        >
          Next
        </button>
      </div>

      <div ref={bodyRef} className="relative flex-1 overflow-auto bg-slate-100 p-4">
        {!pdf ? (
          <p className="text-sm text-slate-600">
            The original PDF is not loaded, only the quote is available.
          </p>
        ) : (
          <div className="relative mx-auto w-fit bg-white shadow">
            <canvas ref={canvasRef} className="block" />
            {boxes.map((b, i) => (
              <span
                key={i}
                className="pointer-events-none absolute rounded-sm bg-amber-300/50 ring-1 ring-amber-500/60"
                style={{ left: b.left - 1, top: b.top - 1, width: b.width + 2, height: b.height + 2 }}
              />
            ))}
            {loading ? (
              <div className="absolute inset-0 grid place-items-center bg-white/70 text-sm text-slate-600">
                Rendering page...
              </div>
            ) : null}
          </div>
        )}
        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        {!loading && !found && page === ev.page ? (
          <p className="mt-3 text-xs text-slate-600">
            The page is shown, but the exact words could not be outlined on it. Use the quote above to find
            them.
          </p>
        ) : null}
      </div>
    </aside>
  );
}
