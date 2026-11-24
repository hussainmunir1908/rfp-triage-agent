"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { extractPages, openPdf } from "@/lib/pdf-client";
import type { StreamEvent, TriageReport } from "@/lib/types";
import { Footer, Header, Ticker } from "./Chrome";
import { EvidenceContext, type EvidenceTarget } from "./evidence-context";
import { EvidenceViewer } from "./EvidenceViewer";
import { Landing } from "./Landing";
import { Report, ReportNav } from "./Report";
import { STAGE_ORDER, Working, type StageKey } from "./Working";

interface WorkingPhase {
  name: "working";
  file: string;
  /** What the animation shows. It trails `target` so every stage is on screen long enough to read. */
  shown: StageKey;
  /** What has actually happened so far. */
  target: StageKey;
  total: number;
  readPages: number;
  messages: Partial<Record<StageKey, string>>;
  startedAt: number;
  /** When `shown` last changed. */
  shownAt: number;
  result: TriageReport | null;
}

type Phase =
  | { name: "idle" }
  | WorkingPhase
  | { name: "done"; report: TriageReport }
  | { name: "error"; message: string };

const MAX_FILE_BYTES = 50 * 1024 * 1024;

/** Least time each stage stays on screen once the next one is ready. The check is quick but worth seeing. */
const DWELL: Record<StageKey, number> = { read: 250, extract: 350, verify: 2300, judge: 700, done: 900 };

export function Analyzer() {
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [target, setTarget] = useState<{ key: number; value: EvidenceTarget } | null>(null);
  const openCount = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const update = useCallback((patch: (p: WorkingPhase) => Partial<WorkingPhase>) => {
    setPhase((p) => (p.name === "working" ? { ...p, ...patch(p) } : p));
  }, []);

  const advanceTo = useCallback(
    (stage: StageKey, message?: string) =>
      update((p) => ({
        target: STAGE_ORDER.indexOf(stage) > STAGE_ORDER.indexOf(p.target) ? stage : p.target,
        messages: message ? { ...p.messages, [stage]: message } : p.messages,
      })),
    [update],
  );

  // Walk the animation forward one stage at a time, then open the report.
  useEffect(() => {
    if (phase.name !== "working") return;
    const at = STAGE_ORDER.indexOf(phase.shown);
    const goal = STAGE_ORDER.indexOf(phase.target);
    const quick = phase.result?.cached === true;

    if (at < goal) {
      const id = setTimeout(
        () =>
          setPhase((p) =>
            p.name === "working"
              ? { ...p, shown: STAGE_ORDER[STAGE_ORDER.indexOf(p.shown) + 1], shownAt: Date.now() }
              : p,
          ),
        quick ? 120 : DWELL[phase.shown],
      );
      return () => clearTimeout(id);
    }
    if (phase.shown === "done" && phase.result) {
      const report = phase.result;
      const id = setTimeout(() => setPhase({ name: "done", report }), quick ? 250 : DWELL.done);
      return () => clearTimeout(id);
    }
  }, [phase]);

  const run = useCallback(
    async (file: File) => {
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
      setPhase({
        name: "working",
        file: file.name,
        shown: "read",
        target: "read",
        total: 0,
        readPages: 0,
        messages: {},
        startedAt: Date.now(),
        shownAt: Date.now(),
        result: null,
      });

      try {
        const doc = await openPdf(file);
        update(() => ({ total: doc.numPages }));
        const pages = await extractPages(doc, (n, total) => update(() => ({ readPages: n, total })));
        setPdf(doc);
        advanceTo("extract");

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
            advanceTo(event.stage as StageKey, event.message);
          } else if (event.type === "result") {
            finished = true;
            update((p) => ({
              result: event.report,
              target: "done",
              messages: p.messages,
            }));
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
    },
    [advanceTo, update],
  );

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
      <div className="flex min-h-screen flex-col">
        <Header
          onNew={phase.name === "idle" || phase.name === "error" ? undefined : reset}
          busy={phase.name === "working"}
        />
        {report ? null : <Ticker />}

        {phase.name === "idle" || phase.name === "error" ? (
          <Landing onFile={(f) => void run(f)} error={phase.name === "error" ? phase.message : null} />
        ) : null}

        {phase.name === "working" ? (
          <Working
            stage={phase.shown}
            fileName={phase.file}
            total={phase.total}
            readPages={phase.readPages}
            messages={phase.messages}
            startedAt={phase.startedAt}
            stageSince={phase.shownAt}
          />
        ) : null}

        {report ? (
          <>
            <ReportNav report={report} />
            <main className="frame pb-20 pt-5 sm:pt-6">
              <Report report={report} />
            </main>
          </>
        ) : null}

        <div className="flex-1" />
        <Footer />
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
