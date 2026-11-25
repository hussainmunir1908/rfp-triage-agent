"use client";

import type { CheckStatus, TriageReport } from "@/lib/types";
import { Badge, Card, EvidenceLink, Section } from "../ui";
import { Refs } from "./shared";

const CHECK_LABELS: Record<CheckStatus, { text: string; tone: "green" | "amber" | "red" | "slate" }> = {
  met: { text: "Met", tone: "green" },
  unknown: { text: "Confirm", tone: "amber" },
  at_risk: { text: "At risk", tone: "amber" },
  blocked: { text: "Blocked", tone: "red" },
};

export function Fit({ report }: { report: TriageReport }) {
  return (
    <div className="grid gap-5 xl:grid-cols-2 xl:items-start">
      <Section id="score" title="Fit score" hint="starts at 5, each factor adds or subtracts">
        <Card className="p-0 sm:p-0">
          <ul>
            {report.factors.map((f, i) => (
              <li
                key={i}
                className="grid grid-cols-[auto_1fr] gap-x-4 border-b border-line px-4 py-3 text-sm sm:px-5"
              >
                <span
                  className={`grid h-9 w-11 place-items-center border text-[19px] ${
                    f.impact > 0
                      ? "border-green/30 bg-green-wash text-green"
                      : f.impact < 0
                        ? "border-red/30 bg-red-wash text-red"
                        : "border-line-2 bg-paper-2 text-ink-2"
                  }`}
                  style={{ fontFamily: "var(--f-pixel)" }}
                >
                  {f.impact > 0 ? `+${f.impact}` : f.impact}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold">{f.name}</p>
                  <p className="leading-relaxed text-ink-2">{f.reason}</p>
                  <Refs refs={f.refs} report={report} />
                </div>
              </li>
            ))}
          </ul>
          <p className="px-4 py-3 font-mono text-xs leading-relaxed text-ink-3 sm:px-5">
            Final score {report.fit_score}/10. A score of 6 or more with no deal-breaker recommends a bid.
          </p>
        </Card>
      </Section>

      {report.qualification_checks.length > 0 ? (
        <Section id="qualify" title="Can we qualify?" hint="mandatory eligibility vs. the idiaz.io profile">
          <Card className="p-0 sm:p-0">
            <ul>
              {report.qualification_checks.map((q) => {
                const label = CHECK_LABELS[q.status];
                return (
                  <li
                    key={q.requirement_id}
                    className="grid gap-x-4 gap-y-1 border-b border-line px-4 py-3 text-sm sm:grid-cols-[auto_1fr_auto] sm:px-5"
                  >
                    <div>
                      <Badge tone={label.tone}>{label.text}</Badge>
                    </div>
                    <div className="min-w-0">
                      <p className="leading-relaxed">{q.requirement}</p>
                      <p className="mt-0.5 leading-relaxed text-ink-3">{q.note}</p>
                    </div>
                    <div>
                      <EvidenceLink evidence={q.evidence} label={q.requirement} />
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="px-4 py-3 font-mono text-xs leading-relaxed text-ink-3 sm:px-5">
              The profile does not state years in business, past projects, certifications or insurance, so
              those show as Confirm. An unconfirmed item caps the score at 8, or at 7 when three or more are
              open.
            </p>
          </Card>
        </Section>
      ) : null}
    </div>
  );
}
