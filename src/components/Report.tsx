"use client";

import { useMemo, useState } from "react";
import { deadlineStatus, formatDate } from "@/lib/dates";
import type {
  CheckStatus,
  DeadlineStatus,
  Evidence,
  EvidenceRef,
  ReportDeadline,
  TriageReport,
} from "@/lib/types";
import { Badge, Card, EvidenceLink, Section } from "./ui";

const CATEGORY_LABELS: Record<string, string> = {
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

const CHECK_LABELS: Record<CheckStatus, { text: string; tone: "green" | "amber" | "red" | "slate" }> = {
  met: { text: "Met", tone: "green" },
  unknown: { text: "Confirm", tone: "amber" },
  at_risk: { text: "At risk", tone: "amber" },
  blocked: { text: "Blocked", tone: "red" },
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

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function StatusBadge({ status, days }: { status: DeadlineStatus; days: number | null }) {
  if (status === "undated") return <Badge>No calendar date</Badge>;
  if (status === "superseded") return <Badge>Replaced by a later date</Badge>;
  if (status === "passed") return <Badge>Already happened</Badge>;
  if (status === "expired") return <Badge tone="red">Expired {plural(Math.abs(days ?? 0), "day")} ago</Badge>;
  if (status === "today") return <Badge tone="amber">Due today</Badge>;
  const soon = (days ?? 99) <= 7;
  return <Badge tone={soon ? "amber" : "green"}>In {plural(days ?? 0, "day")}</Badge>;
}

export function Report({ report }: { report: TriageReport }) {
  // Recompute against the viewer's clock so a saved report never looks fresher than it is.
  const now = useMemo(() => new Date(), []);
  const deadlines: (ReportDeadline & { live: ReturnType<typeof deadlineStatus> })[] = useMemo(
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
  const proposalExpired = proposal.length > 0 && proposal.every((d) => d.live.status === "expired");
  const anyExpired = deadlines.some((d) => d.live.status === "expired");
  const lastProposal = proposal.at(-1);

  const grouped = useMemo(() => {
    const map = new Map<string, TriageReport["requirements"]>();
    for (const r of report.requirements) {
      map.set(r.category, [...(map.get(r.category) ?? []), r]);
    }
    return [...map.entries()];
  }, [report.requirements]);

  const v = report.verification;
  const c = report.coverage;
  const bid = report.decision === "BID";

  return (
    <div className="space-y-8">
      {/* Decision ------------------------------------------------------ */}
      <Card className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div
          className={`flex h-28 w-28 shrink-0 flex-col items-center justify-center rounded-2xl ${
            bid ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
          }`}
        >
          <span className="text-4xl font-bold leading-none">{report.fit_score}</span>
          <span className="mt-1 text-xs font-medium uppercase tracking-wide">fit / 10</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-md px-2.5 py-1 text-sm font-bold tracking-wide text-white ${
                bid ? "bg-emerald-600" : "bg-red-600"
              }`}
            >
              {bid ? "BID" : "NO BID"}
            </span>
            {report.fast_no_bid ? <Badge tone="red">Fast no-bid: not our kind of work</Badge> : null}
            {proposalExpired ? <Badge tone="red">Proposal deadline passed</Badge> : null}
            {report.cached ? <Badge tone="blue">Saved result, no new AI call</Badge> : null}
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">{report.recommendation_summary}</p>
          <p className="mt-2 text-xs text-slate-500">
            {report.file_name} &middot; {plural(report.page_count, "page")} &middot; read by {report.model}
          </p>
        </div>
      </Card>

      {/* Expiry banner (bonus feature) -------------------------------- */}
      {proposalExpired && lastProposal ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">This RFP has already closed.</p>
          <p className="mt-1">
            The proposal deadline was {formatDate(lastProposal.date)} (
            {plural(Math.abs(lastProposal.live.days ?? 0), "day")} ago). The fit assessment below is still
            valid for judging similar work, but there is nothing left to bid on unless the agency reissues or
            extends it.
          </p>
        </div>
      ) : anyExpired ? (
        <div
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        >
          Some dates in this document have already passed. They are marked in the key dates table.
        </div>
      ) : null}

      {/* Verification (bonus feature) --------------------------------- */}
      <Card className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {v.verified} of {v.total} cited quotes found in the document
          </p>
          <p className="text-xs text-slate-500">
            Every fact below links to the page it came from. Code checks that each quote exists in the PDF
            text; it cannot prove the model read it correctly, so open the page to confirm anything important.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="green">{v.exact} exact</Badge>
          {v.close > 0 ? <Badge tone="blue">{v.close} close</Badge> : null}
          {v.unverified > 0 ? <Badge tone="amber">{v.unverified} unverified</Badge> : null}
          {v.dates_corrected > 0 ? <Badge tone="amber">{v.dates_corrected} dates corrected</Badge> : null}
        </div>
        <div className="basis-full border-t border-slate-100 pt-2">
          <p className="text-sm font-semibold text-slate-900">
            Recall check: {c.statements - c.unreviewed} of {c.statements} sentences that sound like
            obligations were accounted for
          </p>
          <p className="text-xs text-slate-500">
            Code looks for sentences with words like must, shall, required, may not, grounds for, terminate or
            a deadline in days, plus numbered requirement ids. {c.matched} were already in the first pass
            {c.added > 0 ? `, ${c.added} more were added by a second look` : ""}
            {c.set_aside > 0 ? `, ${c.set_aside} were set aside as definitions or boilerplate` : ""}.
            {c.unreviewed > 0
              ? ` ${c.unreviewed} could not be reviewed, so the requirements list may be incomplete.`
              : ""}{" "}
            An obligation worded without those cues is not covered by this check.
          </p>
          {/lite/i.test(report.model) ? (
            <p className="mt-1 text-xs font-medium text-amber-700">
              The main model was busy, so part of this report was written by a lighter fallback model (
              {report.model}). It tends to list fewer requirements; run it again later for a fuller read.
            </p>
          ) : null}
        </div>
      </Card>

      {/* 01 Summary ---------------------------------------------------- */}
      <Section title="Summary">
        <Card>
          <p className="text-sm leading-relaxed text-slate-800">{report.summary}</p>
        </Card>
        <Card className="mt-3">
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {report.facts.map((f) => (
              <div key={f.label}>
                <dt className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                  {f.label}
                  {f.evidence ? <EvidenceLink evidence={f.evidence} label={f.label} /> : null}
                </dt>
                <dd
                  className={`mt-0.5 text-sm ${f.value === "Not stated" ? "text-slate-400" : "text-slate-900"}`}
                >
                  {f.value}
                </dd>
                <Caution evidence={f.evidence} />
              </div>
            ))}
          </dl>
        </Card>
      </Section>

      {/* 02 Key dates -------------------------------------------------- */}
      <Section title="Key dates" hint={`Checked against today, ${formatDate(toIsoLocal(now))}`}>
        {deadlines.length === 0 ? (
          <Card>
            <p className="text-sm text-slate-500">Not stated. No dates were found in the document.</p>
          </Card>
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">What</th>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {deadlines.map((d) => (
                  <tr
                    key={d.id}
                    className={
                      d.live.status === "expired"
                        ? "bg-red-50/40"
                        : d.live.status === "superseded"
                          ? "text-slate-400"
                          : ""
                    }
                  >
                    <td
                      className={`px-4 py-3 align-top font-medium ${
                        d.live.status === "superseded" ? "text-slate-500" : "text-slate-900"
                      }`}
                    >
                      {d.what}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {d.date !== "Not stated" ? (
                        <>
                          <span
                            className={
                              d.live.status === "superseded"
                                ? "text-slate-500 line-through"
                                : "text-slate-900"
                            }
                          >
                            {formatDate(d.date)}
                          </span>
                          {d.time_text ? (
                            <span className="block text-xs text-slate-500">{d.time_text}</span>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-slate-600">{d.date_text || "Not stated"}</span>
                      )}
                      {d.note ? <span className="mt-1 block text-xs text-amber-700">{d.note}</span> : null}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <StatusBadge status={d.live.status} days={d.live.days} />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <EvidenceLink evidence={d.evidence} label={d.what} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </Section>

      {/* 03 Requirements ---------------------------------------------- */}
      <Section title="Requirements" hint={`${report.requirements.length} found`}>
        {grouped.length === 0 ? (
          <Card>
            <p className="text-sm text-slate-500">Not stated. No requirements were found.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {grouped.map(([category, items]) => (
              <Card key={category}>
                <h3 className="mb-2 text-sm font-semibold text-slate-900">
                  {CATEGORY_LABELS[category] ?? category}
                </h3>
                <ul className="divide-y divide-slate-100">
                  {items.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-start justify-between gap-2 py-2 text-sm">
                      <span className="min-w-0 flex-1 text-slate-800">
                        {r.text}{" "}
                        <Badge tone={r.mandatory ? "red" : "slate"}>
                          {r.mandatory ? "Mandatory" : "Optional"}
                        </Badge>{" "}
                        {r.source === "sweep" ? <Badge tone="blue">Added by second look</Badge> : null}
                        <Caution evidence={r.evidence} />
                      </span>
                      <EvidenceLink evidence={r.evidence} label={r.text} />
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        )}
      </Section>

      {/* Can we qualify? ----------------------------------------------- */}
      {report.qualification_checks.length > 0 ? (
        <Section
          title="Can we qualify?"
          hint="Mandatory eligibility items checked against the idiaz.io profile"
        >
          <Card>
            <ul className="divide-y divide-slate-100">
              {report.qualification_checks.map((q) => {
                const label = CHECK_LABELS[q.status];
                return (
                  <li
                    key={q.requirement_id}
                    className="flex flex-wrap items-start justify-between gap-2 py-2.5 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-slate-800">
                        <Badge tone={label.tone}>{label.text}</Badge> {q.requirement}
                      </p>
                      <p className="mt-0.5 text-slate-500">{q.note}</p>
                    </div>
                    <EvidenceLink evidence={q.evidence} label={q.requirement} />
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
              The profile does not state years in business, past projects, certifications or insurance, so
              those show as Confirm. An unconfirmed item caps the score at 8, or at 7 when three or more are
              open.
            </p>
          </Card>
        </Section>
      ) : null}

      {/* 04 Fit score -------------------------------------------------- */}
      <Section title="Fit score" hint="Starts at 5, each factor adds or subtracts">
        <Card>
          <ul className="divide-y divide-slate-100">
            {report.factors.map((f, i) => (
              <li key={i} className="flex items-start gap-3 py-2.5 text-sm">
                <span
                  className={`mt-0.5 w-9 shrink-0 rounded-md px-1.5 py-0.5 text-center text-xs font-bold ${
                    f.impact > 0
                      ? "bg-emerald-50 text-emerald-700"
                      : f.impact < 0
                        ? "bg-red-50 text-red-700"
                        : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {f.impact > 0 ? `+${f.impact}` : f.impact}
                </span>
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{f.name}</p>
                  <p className="text-slate-600">{f.reason}</p>
                  <Refs refs={f.refs} report={report} />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
            Final score {report.fit_score}/10. A score of 6 or more with no deal-breaker recommends a bid.
          </p>
        </Card>
      </Section>

      {/* 05 Bid / no-bid ---------------------------------------------- */}
      <Section title={bid ? "Why we should bid" : "Why we should not bid"} hint="Three strongest reasons">
        <Card>
          <ol className="space-y-3">
            {report.reasons.map((r, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-900 text-xs font-bold text-white">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-slate-800">{r.text}</p>
                  <Refs refs={r.refs} report={report} />
                </div>
              </li>
            ))}
          </ol>
        </Card>

        {report.deal_breakers.length > 0 ? (
          <Card className="mt-3 border-red-200 bg-red-50/50">
            <h3 className="mb-2 text-sm font-semibold text-red-800">Deal-breakers</h3>
            <ul className="space-y-2 text-sm text-red-900">
              {report.deal_breakers.map((d, i) => (
                <li key={i}>
                  {d.text}
                  <Refs refs={d.refs} report={report} />
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Card>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">What would change the call</h3>
            {report.would_change_mind.length === 0 ? (
              <p className="text-sm text-slate-500">Nothing identified.</p>
            ) : (
              <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-700">
                {report.would_change_mind.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Questions to ask the agency</h3>
            {report.open_questions.length === 0 ? (
              <p className="text-sm text-slate-500">None.</p>
            ) : (
              <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-700">
                {report.open_questions.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </Section>

      {/* Ambiguities --------------------------------------------------- */}
      {report.ambiguities.length > 0 ? (
        <Section title="Flagged as ambiguous" hint="The agent did not pick a reading for these">
          <Card>
            <ul className="divide-y divide-slate-100">
              {report.ambiguities.map((a) => (
                <li key={a.id} className="flex flex-wrap items-start justify-between gap-2 py-2 text-sm">
                  <span className="min-w-0 flex-1 text-slate-800">
                    {a.issue} {a.source === "figures" ? <Badge tone="blue">Found by code</Badge> : null}
                  </span>
                  <EvidenceLink evidence={a.evidence} label="Ambiguity" />
                </li>
              ))}
            </ul>
          </Card>
        </Section>
      ) : null}

      <JsonExport report={report} />
    </div>
  );
}

/** Shown when a figure in an item is missing from the quote that is meant to back it. */
function Caution({ evidence }: { evidence: Evidence | null }) {
  if (!evidence?.caution) return null;
  return <span className="mt-0.5 block text-xs text-amber-700">{evidence.caution}</span>;
}

function toIsoLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Links from a factor or reason back to the items it relied on. */
function Refs({ refs, report }: { refs: EvidenceRef[]; report: TriageReport }) {
  if (refs.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      {refs.map((ref) => {
        const evidence = findEvidence(report, ref.id);
        return evidence ? (
          <span key={ref.id} className="inline-flex items-center gap-1 text-xs text-slate-500">
            <span className="max-w-[16rem] truncate">{ref.label}</span>
            <EvidenceLink evidence={evidence} label={ref.label} />
          </span>
        ) : (
          <span key={ref.id} className="text-xs text-slate-500">
            {ref.label}
          </span>
        );
      })}
    </div>
  );
}

function findEvidence(report: TriageReport, id: string) {
  return (
    report.facts.find((f) => f.id === id)?.evidence ??
    report.deadlines.find((d) => d.id === id)?.evidence ??
    report.requirements.find((r) => r.id === id)?.evidence ??
    report.ambiguities.find((a) => a.id === id)?.evidence ??
    null
  );
}

function JsonExport({ report }: { report: TriageReport }) {
  const [copied, setCopied] = useState(false);
  const json = useMemo(() => JSON.stringify(report, null, 2), [report]);

  const download = () => {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.file_name.replace(/\.pdf$/i, "")}-triage.json`;
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
    <Section title="JSON" hint="The same report for other systems">
      <Card>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={download}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
          >
            Download JSON
          </button>
          <button
            type="button"
            onClick={copy}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {copied ? "Copied" : "Copy JSON"}
          </button>
        </div>
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-slate-600">Preview</summary>
          <pre className="mt-2 max-h-96 overflow-auto rounded-lg bg-slate-900 p-3 text-xs leading-relaxed text-slate-100">
            {json}
          </pre>
        </details>
      </Card>
    </Section>
  );
}
