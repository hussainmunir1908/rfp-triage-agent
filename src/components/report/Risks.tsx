"use client";

import type { ReportRisk, TriageReport } from "@/lib/types";
import { Badge, Card, EvidenceLink, Section } from "../ui";

const SEVERITY: Record<
  ReportRisk["severity"],
  { label: string; tone: "red" | "amber" | "slate"; heading: string; color: string }
> = {
  high: { label: "High", tone: "red", heading: "Could hurt most", color: "var(--red)" },
  medium: { label: "Medium", tone: "amber", heading: "Worth pricing in", color: "var(--amber)" },
  info: { label: "Note", tone: "slate", heading: "For the record", color: "var(--ink-3)" },
};

const SCANNED =
  "liability caps, indemnity, service credits and penalties, termination, IP ownership, payment terms, insurance, bonds, onsite work, breach costs and always-on service levels";

export function Risks({ report }: { report: TriageReport }) {
  const risks = report.risks ?? [];
  const groups = (["high", "medium", "info"] as const)
    .map((s) => [s, risks.filter((r) => r.severity === s)] as const)
    .filter(([, items]) => items.length > 0);

  return (
    <Section id="risks" title="Risk clauses" hint="found by code, each with the page it sits on">
      {risks.length === 0 ? (
        <Card>
          <p className="text-sm leading-relaxed">
            No risk clauses of the kinds below were found in this document.
          </p>
          <p className="mt-2 font-mono text-xs leading-relaxed text-ink-3">
            The scan looks for wording about {SCANNED}. A clause phrased differently would not be found, and a
            very short document may simply not say.
          </p>
        </Card>
      ) : (
        <div className="space-y-5">
          {groups.map(([severity, items]) => (
            <div key={severity}>
              <h3 className="label mb-2 flex items-center gap-2 text-ink-2">
                <span
                  className="inline-block h-[9px] w-[9px]"
                  style={{ background: SEVERITY[severity].color }}
                />
                {`${SEVERITY[severity].heading} // ${items.length}`}
              </h3>
              <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                {items.map((r, i) => (
                  <Card key={`${r.rule}-${i}`} className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={SEVERITY[r.severity].tone}>{SEVERITY[r.severity].label}</Badge>
                      <h4 className="text-[15px] font-semibold leading-tight">{r.title}</h4>
                    </div>
                    <p className="text-sm leading-relaxed text-ink-2">{r.why}</p>
                    <blockquote className="border-l-2 border-accent pl-3 font-mono text-xs leading-relaxed text-ink-2">
                      {r.evidence.quote}
                    </blockquote>
                    <div className="mt-auto">
                      <EvidenceLink evidence={r.evidence} label={r.title} />
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
          <p className="font-mono text-xs leading-relaxed text-ink-3">
            The scan looks for wording about {SCANNED}. A clause phrased differently would not be found, so
            treat this as a head start, not a legal review.
          </p>
        </div>
      )}
    </Section>
  );
}
