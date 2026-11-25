"use client";

import { useMemo, useState } from "react";
import { complianceMatrix } from "@/lib/matrix";
import type { TriageReport } from "@/lib/types";
import { Badge, Card, EvidenceLink, Section } from "../ui";

export function Evidence({ report }: { report: TriageReport }) {
  const v = report.verification;
  const c = report.coverage;

  return (
    <div className="space-y-5">
      <Section
        id="evidence"
        title="How far to trust this"
        hint="every claim is checked by code, not by the model"
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <p className="label text-ink-3">evidence // quotes</p>
            <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-[clamp(1.8rem,3vw,2.5rem)] font-bold leading-none tracking-tight">
                {v.verified}
                <span className="text-ink-3">/{v.total}</span>
              </span>
              <span className="text-sm font-medium">cited quotes found in the document</span>
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge tone="green">{v.exact} exact</Badge>
              {v.close > 0 ? <Badge tone="blue">{v.close} close</Badge> : null}
              {v.unverified > 0 ? <Badge tone="amber">{v.unverified} unverified</Badge> : null}
              {v.dates_corrected > 0 ? <Badge tone="amber">{v.dates_corrected} dates corrected</Badge> : null}
            </div>
            <p className="mt-3 font-mono text-xs leading-relaxed text-ink-3">
              Code confirms each quote exists in the PDF. It cannot prove the reading is right, so open the
              page.
            </p>
          </Card>

          <Card>
            <p className="label text-ink-3">evidence // recall</p>
            <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-[clamp(1.8rem,3vw,2.5rem)] font-bold leading-none tracking-tight">
                {c.statements - c.unreviewed}
                <span className="text-ink-3">/{c.statements}</span>
              </span>
              <span className="text-sm font-medium">obligation-like sentences accounted for</span>
            </p>
            <p className="mt-3 font-mono text-xs leading-relaxed text-ink-3">
              Sentences with must, shall, may not, terminate and similar cues. {c.matched} were already in the
              first pass
              {c.added > 0 ? `, ${c.added} more were added by a second look` : ""}
              {c.set_aside > 0 ? `, ${c.set_aside} were set aside as definitions or boilerplate` : ""}. An
              obligation worded without those cues is not covered.
            </p>
            {c.unreviewed > 0 ? (
              <p className="mt-2 border-l-2 border-amber pl-3 font-mono text-xs leading-relaxed text-amber">
                {c.unreviewed} could not be reviewed, so the requirements list may be incomplete.
              </p>
            ) : null}
          </Card>
        </div>
      </Section>

      {report.ambiguities.length > 0 ? (
        <Section
          id="ambiguous"
          title="Flagged as ambiguous"
          hint="the agent did not pick a reading for these"
        >
          <Card className="p-0 sm:p-0">
            <ul>
              {report.ambiguities.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-line px-4 py-3 text-sm last:border-b-0 sm:px-5"
                >
                  <span className="min-w-0 flex-1 leading-relaxed">
                    {a.issue} {a.source === "figures" ? <Badge tone="blue">Found by code</Badge> : null}
                  </span>
                  <EvidenceLink evidence={a.evidence} label="Ambiguity" />
                </li>
              ))}
            </ul>
          </Card>
        </Section>
      ) : null}

      <Exports report={report} />
    </div>
  );
}

function Exports({ report }: { report: TriageReport }) {
  const [copied, setCopied] = useState(false);
  const json = useMemo(() => JSON.stringify(report, null, 2), [report]);

  const save = (content: string, type: string, suffix: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.file_name.replace(/\.pdf$/i, "")}-${suffix}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be blocked; download still works */
    }
  };

  return (
    <Section id="json" title="Export" hint="JSON for other systems, a CSV matrix for the bid team">
      <Card>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => save(json, "application/json", "triage.json")}
            className="rounded-[6px] border-2 border-ink bg-accent px-4 py-2 text-sm font-bold text-ink shadow-[3px_3px_0_0_var(--ink)] transition-transform hover:-translate-x-px hover:-translate-y-px active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
          >
            Download JSON
          </button>
          <button
            type="button"
            onClick={() => save(complianceMatrix(report), "text/csv;charset=utf-8", "compliance-matrix.csv")}
            className="rounded-[6px] border-2 border-ink px-4 py-2 text-sm font-semibold transition-colors hover:bg-ink hover:text-paper"
          >
            Download compliance matrix (CSV)
          </button>
          <button
            type="button"
            onClick={copy}
            className="rounded-[6px] border border-line-2 px-4 py-2 text-sm font-medium transition-colors hover:bg-paper-2"
          >
            {copied ? "Copied" : "Copy JSON"}
          </button>
        </div>
        <details className="mt-4">
          <summary className="label cursor-pointer text-ink-2">Preview</summary>
          <pre className="mt-3 max-h-96 overflow-auto rounded-[6px] bg-night p-4 font-mono text-xs leading-relaxed text-paper/90">
            {json}
          </pre>
        </details>
      </Card>
    </Section>
  );
}
