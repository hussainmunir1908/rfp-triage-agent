"use client";

import type { ReactNode } from "react";
import type { Evidence } from "@/lib/types";
import { useEvidence } from "./evidence-context";

export function Section({
  id,
  title,
  hint,
  children,
}: {
  id?: string;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h2>
        {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>{children}</div>;
}

type Tone = "slate" | "green" | "red" | "amber" | "blue";

const TONES: Record<Tone, string> = {
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  blue: "bg-sky-50 text-sky-700 ring-sky-200",
};

export function Badge({ tone = "slate", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

/** Small button that opens the source page and highlights the quote. */
export function EvidenceLink({ evidence, label }: { evidence: Evidence | null; label: string }) {
  const { open } = useEvidence();
  if (!evidence) return <span className="text-xs text-slate-400">no source</span>;

  const tone = evidence.verified ? (evidence.match === "exact" ? "green" : "blue") : "amber";
  const text = evidence.verified
    ? `p. ${evidence.page}${evidence.match === "close" ? " (close match)" : ""}`
    : "unverified";
  return (
    <button
      type="button"
      onClick={() => open({ label, evidence })}
      title={evidence.verified ? "Show this in the document" : "The quote could not be found in the document"}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset transition hover:brightness-95 ${TONES[tone]}`}
    >
      {evidence.verified ? <CheckIcon /> : <WarnIcon />}
      {text}
    </button>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-3 w-3" fill="currentColor" aria-hidden>
      <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.8 3.8 6.8-6.8a1 1 0 0 1 1.4 0Z" />
    </svg>
  );
}

function WarnIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-3 w-3" fill="currentColor" aria-hidden>
      <path d="M10 2a1 1 0 0 1 .9.5l7.5 13A1 1 0 0 1 17.5 17h-15a1 1 0 0 1-.9-1.5l7.5-13A1 1 0 0 1 10 2Zm0 5a1 1 0 0 0-1 1v3a1 1 0 1 0 2 0V8a1 1 0 0 0-1-1Zm0 7a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" />
    </svg>
  );
}
