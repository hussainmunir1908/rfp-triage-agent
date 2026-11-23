"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { extractPages, openPdf } from "@/lib/pdf-client";
import type { StreamEvent, TriageReport } from "@/lib/types";
import { EvidenceContext, type EvidenceTarget } from "./evidence-context";
import { EvidenceViewer } from "./EvidenceViewer";
import { Report } from "./Report";

type Phase =
  | { name: "idle" }
  | { name: "working"; steps: Step[] }
  | { name: "done"; report: TriageReport }
  | { name: "error"; message: string };

interface Step {
  key: string;
  label: string;
  state: "pending" | "active" | "done";
}

const STEPS: Step[] = [
  { key: "read", label: "Reading the PDF in your browser", state: "pending" },
  { key: "extract", label: "Extracting facts, dates and requirements", state: "pending" },
  { key: "verify", label: "Checking every quote against the document", state: "pending" },
  { key: "judge", label: "Scoring fit and making the call", state: "pending" },
];

const MAX_FILE_BYTES = 50 * 1024 * 1024;

function setStep(steps: Step[], key: string, detail?: string): Step[] {
  const at = steps.findIndex((s) => s.key === key);
  return steps.map((s, i) => ({
    ...s,
    label: i === at && detail ? detail : s.label,
    state: i < at ? "done" : i === at ? "active" : "pending",
  }));
}

export function Analyzer() {
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [target, setTarget] = useState<{ key: number; value: EvidenceTarget } | null>(null);
  const openCount = useRef(0);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const run = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      setPhase({ name: "error", message: "Please choose a PDF file." });
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setPhase({ name: "error", message: "That file is over 50 MB. Try a smaller RFP." });
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setTarget(null);
    setPdf(null);
    let steps = setStep(STEPS, "read");
    setPhase({ name: "working", steps });

    try {
      const doc = await openPdf(file);
      const pages = await extractPages(doc, (n, total) => {
        steps = setStep(STEPS, "read", `Reading the PDF in your browser (page ${n} of ${total})`);
        setPhase({ name: "working", steps });
      });
      setPdf(doc);

      steps = setStep(STEPS, "extract");
      setPhase({ name: "working", steps });

      const res = await fetch("/api/analyze?stream=1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, pages }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? `Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finished = false;

      const handle = (line: string) => {
        if (!line.trim()) return;
        const event = JSON.parse(line) as StreamEvent;
        if (event.type === "stage") {
          steps = setStep(STEPS, event.stage);
          setPhase({ name: "working", steps });
        } else if (event.type === "result") {
          finished = true;
          setPhase({ name: "done", report: event.report });
        } else {
          throw new Error(event.message);
        }
      };

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        lines.forEach(handle);
      }
      handle(buffer);
      if (!finished) throw new Error("The analysis ended without a result. Please try again.");
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setPhase({
        name: "error",
        message: err instanceof Error ? err.message : "Something went wrong reading that file.",
      });
    }
  }, []);

  const onFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file) void run(file);
  };

  const reset = () => {
    abortRef.current?.abort();
    setPhase({ name: "idle" });
    setPdf(null);
    setTarget(null);
  };

  const report = phase.name === "done" ? phase.report : null;

  return (
    <EvidenceContext.Provider
      value={{
        open: (value) => {
          openCount.current += 1;
          setTarget({ key: openCount.current, value });
        },
      }}
    >
      <div className="mx-auto w-full max-w-4xl px-4 pb-24 pt-10 sm:px-6">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-orange-600">idiaz.io</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">RFP Triage Agent</h1>
            <p className="mt-1 max-w-xl text-sm text-slate-600">
              Drop in an RFP and get a bid or no-bid call, with every fact linked back to the page it came from.
            </p>
          </div>
          {phase.name !== "idle" ? (
            <button
              type="button"
              onClick={reset}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Analyze another RFP
            </button>
          ) : null}
        </header>

        {phase.name === "idle" || phase.name === "error" ? (
          <>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                onFiles(e.dataTransfer.files);
              }}
              className={`grid place-items-center rounded-2xl border-2 border-dashed px-6 py-16 text-center transition ${
                dragging ? "border-orange-500 bg-orange-50" : "border-slate-300 bg-white"
              }`}
            >
              <div>
                <p className="text-base font-semibold text-slate-900">Drag an RFP PDF here</p>
                <p className="mt-1 text-sm text-slate-500">Text-based PDFs up to about 100 pages</p>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="mt-5 rounded-md bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
                >
                  Choose a file
                </button>
                <input
                  ref={inputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    onFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </div>
            </div>
            {phase.name === "error" ? (
              <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {phase.message}
              </p>
            ) : null}
          </>
        ) : null}

        {phase.name === "working" ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">Analyzing, this usually takes under a minute</p>
            <ol className="mt-4 space-y-3">
              {phase.steps.map((s) => (
                <li key={s.key} className="flex items-center gap-3 text-sm">
                  <span
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
                      s.state === "done"
                        ? "bg-emerald-500 text-white"
                        : s.state === "active"
                          ? "animate-pulse bg-orange-500 text-white"
                          : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    {s.state === "done" ? "✓" : ""}
                  </span>
                  <span className={s.state === "pending" ? "text-slate-400" : "text-slate-800"}>{s.label}</span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        {report ? <Report report={report} /> : null}
      </div>

      {target ? (
        <EvidenceViewer
          key={target.key}
          pdf={pdf}
          pageCount={report?.page_count ?? 0}
          target={target.value}
          onClose={() => setTarget(null)}
        />
      ) : null}
    </EvidenceContext.Provider>
  );
}
