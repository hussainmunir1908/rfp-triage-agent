"use client";

import type { TriageReport } from "@/lib/types";
import { Card, EvidenceLink, Section } from "../ui";
import { Caution, Refs } from "./shared";

function Bullets({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <p className="mt-3 text-sm text-ink-3">{empty}</p>;
  return (
    <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-2">
      {items.map((t, i) => (
        <li key={i} className="flex gap-2.5">
          <span className="mt-[7px] h-[6px] w-[6px] shrink-0 bg-accent outline outline-1 outline-ink" />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

export function Overview({ report, onFlags }: { report: TriageReport; onFlags: () => void }) {
  const bid = report.decision === "BID";
  const known = report.facts.filter((f) => f.value !== "Not stated");
  const unknown = report.facts.filter((f) => f.value === "Not stated");

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-12 xl:items-start">
        <Section
          id="call"
          title={bid ? "Why we should bid" : "Why we should not bid"}
          hint="three strongest reasons"
          className="xl:col-span-7"
        >
          <Card>
            <ol className="space-y-4">
              {report.reasons.map((r, i) => (
                <li key={i} className="flex gap-4 text-sm">
                  <span
                    className="grid h-8 w-8 shrink-0 place-items-center bg-ink text-[19px] text-paper"
                    style={{ fontFamily: "var(--f-pixel)" }}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <p className="leading-relaxed">{r.text}</p>
                    <Refs refs={r.refs} report={report} />
                  </div>
                </li>
              ))}
            </ol>
          </Card>

          {report.deal_breakers.length > 0 ? (
            <div className="mt-4 rounded-[6px] border border-red/30 bg-red-wash p-4 sm:p-5">
              <h3 className="label text-red">Deal-breakers</h3>
              <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-red">
                {report.deal_breakers.map((d, i) => (
                  <li key={i} className="border-l-2 border-red/50 pl-3">
                    {d.text}
                    <Refs refs={d.refs} report={report} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Section>

        <div className="min-w-0 space-y-5 xl:col-span-5">
          <Section id="change" title="What would change the call">
            <Card>
              <Bullets items={report.would_change_mind} empty="Nothing identified." />
            </Card>
          </Section>

          {report.ambiguities.length > 0 ? (
            <button
              type="button"
              onClick={onFlags}
              className="flex w-full items-center justify-between gap-3 rounded-[6px] border border-amber/30 bg-amber-wash px-4 py-3 text-left text-sm text-amber transition-colors hover:border-amber"
            >
              <span>
                <span className="label mr-2">Flagged</span>
                {report.ambiguities.length} ambiguous point{report.ambiguities.length === 1 ? "" : "s"} in the
                document. The agent did not pick a reading.
              </span>
              <span className="label shrink-0">See them</span>
            </button>
          ) : null}
        </div>
      </div>

      <Section id="summary" title="About this RFP" hint="what the agency wants">
        <Card>
          <p className="max-w-[90ch] text-[15px] leading-[1.7] sm:text-base">{report.summary}</p>
          {known.length > 0 ? (
            <dl className="mt-5 grid gap-x-6 gap-y-4 border-t border-line pt-5 sm:grid-cols-2 xl:grid-cols-3">
              {known.map((f) => (
                <div key={f.label} className="min-w-0">
                  <dt className="flex flex-wrap items-center gap-2">
                    <span className="label text-ink-3">{f.label}</span>
                    {f.evidence ? <EvidenceLink evidence={f.evidence} label={f.label} /> : null}
                  </dt>
                  <dd className="mt-1 break-words text-sm leading-relaxed">{f.value}</dd>
                  <Caution evidence={f.evidence} />
                </div>
              ))}
            </dl>
          ) : null}
          {unknown.length > 0 ? (
            <p className="mt-4 font-mono text-xs leading-relaxed text-ink-3">
              Not stated in the document: {unknown.map((f) => f.label.toLowerCase()).join(", ")}.
            </p>
          ) : null}
        </Card>
      </Section>

      {report.open_questions.length > 0 ? (
        <details className="rounded-[6px] border border-line bg-card">
          <summary className="label cursor-pointer px-4 py-3 text-ink sm:px-5">
            Questions to ask the agency // {report.open_questions.length}
          </summary>
          <div className="border-t border-line px-4 pb-4 sm:px-5">
            <Bullets items={report.open_questions} empty="None." />
          </div>
        </details>
      ) : null}
    </div>
  );
}
