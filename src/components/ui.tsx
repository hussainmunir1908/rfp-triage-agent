"use client";

import type { ReactNode } from "react";
import type { Evidence } from "@/lib/types";
import { useEvidence } from "./evidence-context";

export function Section({
  id,
  title,
  hint,
  aside,
  children,
  className = "",
}: {
  id?: string;
  title: string;
  hint?: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`min-w-0 scroll-mt-28 ${className}`}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <h2 className="text-[clamp(1.15rem,1.7vw,1.5rem)] font-semibold tracking-tight">{title}</h2>
          {hint ? <p className="font-mono text-xs text-ink-3">{`// ${hint}`}</p> : null}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[6px] border border-line bg-card p-4 sm:p-5 ${className}`}>{children}</div>;
}

type Tone = "slate" | "green" | "red" | "amber" | "blue";

const TONES: Record<Tone, string> = {
  slate: "border-line-2 bg-paper-2 text-ink-2",
  green: "border-green/30 bg-green-wash text-green",
  red: "border-red/30 bg-red-wash text-red",
  amber: "border-amber/30 bg-amber-wash text-amber",
  blue: "border-sky/30 bg-sky-wash text-sky",
};

const DARK_TONES: Record<Tone, string> = {
  slate: "border-paper/20 bg-paper/10 text-paper/75",
  green: "border-mint/50 bg-mint/15 text-mint",
  red: "border-coral/50 bg-coral/15 text-coral",
  amber: "border-accent/50 bg-accent/15 text-accent",
  blue: "border-ice/50 bg-ice/15 text-ice",
};

export function Badge({
  tone = "slate",
  dark = false,
  children,
}: {
  tone?: Tone;
  dark?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-[4px] border px-1.5 py-[1px] font-mono text-[11px] font-medium leading-[1.5] ${
        dark ? DARK_TONES[tone] : TONES[tone]
      }`}
    >
      {children}
    </span>
  );
}

/** Ten blocks, one per point of the fit score. */
export function Meter({ value, tone }: { value: number; tone: string }) {
  return (
    <div className="flex gap-[3px]" role="img" aria-label={`${value} out of 10`}>
      {Array.from({ length: 10 }, (_, i) => (
        <span
          key={i}
          className="h-[14px] w-[clamp(10px,1.6vw,18px)]"
          style={{ background: i < value ? tone : "var(--night-line)" }}
        />
      ))}
    </div>
  );
}

/** Small button that opens the source page and highlights the quote. */
export function EvidenceLink({ evidence, label }: { evidence: Evidence | null; label: string }) {
  const { open } = useEvidence();
  if (!evidence) return <span className="font-mono text-xs text-ink-3">no source</span>;

  const tone = evidence.verified ? (evidence.match === "exact" ? "green" : "blue") : "amber";
  const text = evidence.verified
    ? `p. ${evidence.page}${evidence.match === "close" ? " (close)" : ""}`
    : "unverified";
  return (
    <button
      type="button"
      onClick={() => open({ label, evidence })}
      title={evidence.verified ? "Show this in the document" : "The quote could not be found in the document"}
      className={`inline-flex shrink-0 items-center gap-1 rounded-[4px] border px-1.5 py-[1px] font-mono text-[11px] font-medium leading-[1.5] transition-colors hover:border-current ${TONES[tone]}`}
    >
      {evidence.verified ? <CheckIcon /> : <WarnIcon />}
      {text}
    </button>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 10 10"
      className="h-[10px] w-[10px]"
      fill="currentColor"
      shapeRendering="crispEdges"
      aria-hidden
    >
      <path d="M8 2h1v1H8zM7 3h1v1H7zM6 4h1v1H6zM5 5h1v1H5zM1 5h1v1H1zM2 6h1v1H2zM3 7h1v1H3zM4 6h1v1H4z" />
    </svg>
  );
}

function WarnIcon() {
  return (
    <svg
      viewBox="0 0 10 10"
      className="h-[10px] w-[10px]"
      fill="currentColor"
      shapeRendering="crispEdges"
      aria-hidden
    >
      <path d="M4 1h2v5H4zM4 7h2v2H4z" />
    </svg>
  );
}
