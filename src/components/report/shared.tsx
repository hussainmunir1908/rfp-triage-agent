"use client";

import { useMemo } from "react";
import { deadlineStatus } from "@/lib/dates";
import type { DeadlineStatus, Evidence, EvidenceRef, ReportDeadline, TriageReport } from "@/lib/types";
import { Badge, EvidenceLink } from "../ui";

export const CATEGORY_LABELS: Record<string, string> = {
  certification: "Certifications",
  set_aside: "Set-asides",
  security_clearance: "Security and clearances",
  past_performance: "Past performance",
  staffing: "Staffing",
  technical_skill: "Technical skills",
  insurance_bonding: "Insurance and bonding",
  location: "Location and data residency",
  functional: "What the solution must do",
  security_compliance: "Security, hosting and compliance",
  performance_sla: "Performance, service levels and acceptance",
  submission: "How to respond",
  contract_terms: "Contract terms",
  other: "Other",
};

const KIND_ORDER: Record<string, number> = {
  issued: 0,
  questions_due: 1,
  site_visit: 2,
  pre_proposal_conference: 3,
  proposal_due: 4,
  award: 5,
  start_date: 6,
  end_date: 7,
  other: 8,
};

export function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function StatusBadge({ status, days }: { status: DeadlineStatus; days: number | null }) {
  if (status === "undated") return <Badge>No calendar date</Badge>;
  if (status === "superseded") return <Badge>Replaced by a later date</Badge>;
  if (status === "passed") return <Badge>Already happened</Badge>;
  if (status === "expired") return <Badge tone="red">Expired {plural(Math.abs(days ?? 0), "day")} ago</Badge>;
  if (status === "today") return <Badge tone="amber">Due today</Badge>;
  const soon = (days ?? 99) <= 7;
  return <Badge tone={soon ? "amber" : "green"}>In {plural(days ?? 0, "day")}</Badge>;
}

export type LiveDeadline = ReportDeadline & { live: ReturnType<typeof deadlineStatus> };

/** Deadlines judged against the viewer's clock, so a saved report never looks fresher than it is. */
export function useDeadlines(report: TriageReport) {
  const now = useMemo(() => new Date(), []);
  const deadlines: LiveDeadline[] = useMemo(
    () =>
      report.deadlines
        .map((d) => ({ ...d, live: deadlineStatus(d, now) }))
        .sort((a, b) => {
          if (a.date !== b.date && a.live.days !== null && b.live.days !== null)
            return a.live.days - b.live.days;
          if (a.live.days === null && b.live.days !== null) return 1;
          if (a.live.days !== null && b.live.days === null) return -1;
          return (KIND_ORDER[a.kind] ?? 9) - (KIND_ORDER[b.kind] ?? 9);
        }),
    [report.deadlines, now],
  );
  const proposal = deadlines.filter(
    (d) => d.kind === "proposal_due" && d.live.status !== "undated" && d.live.status !== "superseded",
  );
  return {
    now,
    deadlines,
    lastProposal: proposal.at(-1),
    proposalExpired: proposal.length > 0 && proposal.every((d) => d.live.status === "expired"),
    anyExpired: deadlines.some((d) => d.live.status === "expired"),
  };
}

/** Shown when a figure in an item is missing from the quote that is meant to back it. */
export function Caution({ evidence }: { evidence: Evidence | null }) {
  if (!evidence?.caution) return null;
  return <span className="mt-1 block font-mono text-xs text-amber">{evidence.caution}</span>;
}

export function findEvidence(report: TriageReport, id: string) {
  return (
    report.facts.find((f) => f.id === id)?.evidence ??
    report.deadlines.find((d) => d.id === id)?.evidence ??
    report.requirements.find((r) => r.id === id)?.evidence ??
    report.ambiguities.find((a) => a.id === id)?.evidence ??
    null
  );
}

/** Links from a factor or reason back to the items it relied on. */
export function Refs({ refs, report }: { refs: EvidenceRef[]; report: TriageReport }) {
  if (refs.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
      {refs.map((ref) => {
        const evidence = findEvidence(report, ref.id);
        return evidence ? (
          <span key={ref.id} className="inline-flex min-w-0 items-center gap-1.5 text-xs text-ink-3">
            <span className="max-w-[16rem] truncate">{ref.label}</span>
            <EvidenceLink evidence={evidence} label={ref.label} />
          </span>
        ) : (
          <span key={ref.id} className="text-xs text-ink-3">
            {ref.label}
          </span>
        );
      })}
    </div>
  );
}

export function toIsoLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
