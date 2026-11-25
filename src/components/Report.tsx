"use client";

import { useMemo, useState } from "react";
import { deadlineStatus, formatDate } from "@/lib/dates";
import { complianceMatrix } from "@/lib/matrix";
import type {
  CheckStatus,
  DeadlineStatus,
  Evidence,
  EvidenceRef,
  ReportDeadline,
  TriageReport,
} from "@/lib/types";
import { GHOST, ROBOT, STAR, ZZZ } from "./pixel/art";
import { Sprite } from "./pixel/Sprite";
import { Badge, Card, EvidenceLink, Meter, Section } from "./ui";

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

/** Sticky strip of links to the report sections. It sits outside the content frame so it spans the screen. */
export function ReportNav({ report }: { report: TriageReport }) {
  const nav: [string, string][] = [
    ["decision", "Decision"],
    ["summary", "Summary"],
    ["dates", "Key dates"],
    ["requirements", "Requirements"],
    ...(report.qualification_checks.length > 0
      ? ([["qualify", "Can we qualify?"]] as [string, string][])
      : []),
    ["score", "Fit score"],
    ["call", "The call"],
    ...(report.ambiguities.length > 0 ? ([["ambiguous", "Ambiguous"]] as [string, string][]) : []),
    ["json", "Export"],
  ];

  return (
    <nav aria-label="Report sections" className="sticky top-14 z-20 border-b border-line bg-paper">
      <ul className="frame flex gap-1 overflow-x-auto py-2">
        {nav.map(([id, label]) => (
          <li key={id} className="shrink-0">
            <a
              href={`#${id}`}
              className="label block whitespace-nowrap rounded-[4px] px-2.5 py-1.5 text-ink-2 hover:bg-paper-2 hover:text-ink"
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function Report({ report }: { report: TriageReport }) {
  // Recompute against the viewer's clock so a saved report never looks fresher than it is.
  const now = useMemo(() => new Date(), []);
  const [onlyMandatory, setOnlyMandatory] = useState(false);

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

  const mandatoryCount = report.requirements.filter((r) => r.mandatory).length;
  const grouped = useMemo(() => {
    const map = new Map<string, TriageReport["requirements"]>();
    for (const r of report.requirements) {
      if (onlyMandatory && !r.mandatory) continue;
      map.set(r.category, [...(map.get(r.category) ?? []), r]);
    }
    return [...map.entries()];
  }, [report.requirements, onlyMandatory]);

  const v = report.verification;
  const c = report.coverage;
  const bid = report.decision === "BID";
  const accent = bid ? "var(--mint)" : "var(--coral)";

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Decision ------------------------------------------------------- */}
      <div id="decision" className="grid scroll-mt-28 gap-4 xl:grid-cols-12">
        <div className="relative overflow-hidden rounded-[6px] bg-night p-5 text-paper sm:p-7 xl:col-span-8">
          <div className="relative z-10 grid gap-6 md:grid-cols-[auto_1fr] md:gap-8">
            <div className="flex flex-col justify-between gap-5">
              <div>
                <p className="label text-paper/55">fit score</p>
                <p
                  className="mt-2 leading-none tracking-tight"
                  style={{
                    fontFamily: "var(--f-pixel)",
                    fontSize: "clamp(5rem,10vw,8.5rem)",
                    color: accent,
                  }}
                >
                  {report.fit_score}
                  <span
                    className="ml-1 text-[0.32em] font-bold text-paper/40"
                    style={{ fontFamily: "var(--f-sans)" }}
                  >
                    /10
                  </span>
                </p>
              </div>
              <Meter value={report.fit_score} tone={accent} />
            </div>

            <div className="min-w-0 sm:pr-[calc(var(--s)*17)]">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span
                  className="stamp label inline-block border-2 px-3 py-1.5 text-[clamp(1.4rem,2.6vw,2.1rem)] tracking-[0.14em]"
                  style={{ color: accent, borderColor: accent }}
                >
                  {bid ? "BID" : "NO BID"}
                </span>
                {report.fast_no_bid ? (
                  <Badge dark tone="red">
                    Fast no-bid: not our kind of work
                  </Badge>
                ) : null}
                {proposalExpired ? (
                  <Badge dark tone="red">
                    Proposal deadline passed
                  </Badge>
                ) : null}
                {report.cached ? (
                  <Badge dark tone="blue">
                    Saved result, no new AI call
                  </Badge>
                ) : null}
              </div>
              <p className="mt-4 text-[clamp(1rem,1.5vw,1.2rem)] leading-[1.6] text-paper/90">
                {report.recommendation_summary}
              </p>
              <p className="mt-4 font-mono text-xs leading-relaxed text-paper/50">
                {report.file_name} &middot; {plural(report.page_count, "page")} &middot; read by{" "}
                {report.model}
              </p>
            </div>
          </div>

          <div
            className="pointer-events-none absolute bottom-0 right-5 hidden items-end gap-2 sm:flex"
            aria-hidden
          >
            {bid ? (
              <>
                <div className="hop mb-1">
                  <Sprite art={STAR} px="3px" />
                </div>
                <div className="hop">
                  <Sprite art={ROBOT} />
                </div>
              </>
            ) : (
              <>
                <div className="blink mb-8">
                  <Sprite art={ZZZ} px="3px" className="opacity-60" />
                </div>
                <div className="bob">
                  <Sprite art={GHOST} />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Evidence checks (bonus feature) -------------------------------- */}
        <Card className="flex flex-col gap-4 xl:col-span-4">
          <div>
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
            <p className="mt-2 font-mono text-xs leading-relaxed text-ink-3">
              Code confirms each quote exists in the PDF. It cannot prove the reading is right, so open the
              page.
            </p>
          </div>

          <div className="border-t border-line pt-4">
            <p className="label text-ink-3">evidence // recall</p>
            <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-[clamp(1.8rem,3vw,2.5rem)] font-bold leading-none tracking-tight">
                {c.statements - c.unreviewed}
                <span className="text-ink-3">/{c.statements}</span>
              </span>
              <span className="text-sm font-medium">obligation-like sentences accounted for</span>
            </p>
            <p className="mt-2 font-mono text-xs leading-relaxed text-ink-3">
              Sentences with must, shall, may not, terminate and similar cues. An obligation worded without
              those cues is not covered by this check.
            </p>
            {c.unreviewed > 0 ? (
              <p className="mt-2 border-l-2 border-amber pl-3 font-mono text-xs leading-relaxed text-amber">
                {c.unreviewed} could not be reviewed, so the requirements list may be incomplete.
              </p>
            ) : null}
            <details className="mt-2">
              <summary className="label cursor-pointer text-ink-2">How the recall check worked here</summary>
              <p className="mt-2 font-mono text-xs leading-relaxed text-ink-3">
                {c.matched} were already in the first pass
                {c.added > 0 ? `, ${c.added} more were added by a second look` : ""}
                {c.set_aside > 0 ? `, ${c.set_aside} were set aside as definitions or boilerplate` : ""}.
                Numbered requirement ids and deadlines in days count as cues too.
              </p>
            </details>
          </div>
        </Card>
      </div>

      {/* Expiry banner (bonus feature) ---------------------------------- */}
      {proposalExpired && lastProposal ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-[6px] border border-red/30 bg-red-wash p-4 text-sm text-red"
        >
          <span className="label mt-0.5 shrink-0">Closed</span>
          <div>
            <p className="font-semibold">This RFP has already closed.</p>
            <p className="mt-1 leading-relaxed">
              The proposal deadline was {formatDate(lastProposal.date)} (
              {plural(Math.abs(lastProposal.live.days ?? 0), "day")} ago). The fit assessment below is still
              valid for judging similar work, but there is nothing left to bid on unless the agency reissues
              or extends it.
            </p>
          </div>
        </div>
      ) : anyExpired ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-[6px] border border-amber/30 bg-amber-wash p-4 text-sm text-amber"
        >
          <span className="label mt-0.5 shrink-0">Heads up</span>
          <span>Some dates in this document have already passed. They are marked in the key dates list.</span>
        </div>
      ) : null}

      {report.thin_document ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-[6px] border border-amber/30 bg-amber-wash p-4 text-sm text-amber"
        >
          <span className="label mt-0.5 shrink-0">Thin document</span>
          <div>
            <p className="font-semibold">Very little is stated in this document.</p>
            <p className="mt-1 leading-relaxed">
              Only {report.requirements.length} requirement{report.requirements.length === 1 ? "" : "s"} could
              be found, so eligibility, terms and risks are unknown rather than absent. The score is capped at
              6 and the call is provisional. Get the full solicitation before deciding.
            </p>
          </div>
        </div>
      ) : null}

      {/lite/i.test(report.model) ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-[6px] border border-amber/30 bg-amber-wash p-4 text-sm text-amber"
        >
          <span className="label mt-0.5 shrink-0">Provisional</span>
          <div>
            <p className="font-semibold">A lighter fallback model wrote part of this report.</p>
            <p className="mt-1 leading-relaxed">
              The main models were busy or out of quota for the day, so {report.model} did some of the
              reading. It can list fewer requirements and weigh unknowns differently, which can move the
              score. Treat the call as provisional and run the document again when the main models are back.
            </p>
          </div>
        </div>
      ) : null}

      {/* Summary and dates ---------------------------------------------- */}
      <div className="grid gap-4 xl:grid-cols-12 xl:gap-5">
        <Section id="summary" title="Summary" hint="what the agency wants" className="xl:col-span-5">
          <Card>
            <p className="text-[15px] leading-[1.7] sm:text-base">{report.summary}</p>
            <dl className="mt-5 grid gap-x-6 gap-y-4 border-t border-line pt-5 sm:grid-cols-2">
              {report.facts.map((f) => (
                <div key={f.label} className="min-w-0">
                  <dt className="flex flex-wrap items-center gap-2">
                    <span className="label text-ink-3">{f.label}</span>
                    {f.evidence ? <EvidenceLink evidence={f.evidence} label={f.label} /> : null}
                  </dt>
                  <dd
                    className={`mt-1 break-words text-sm leading-relaxed ${f.value === "Not stated" ? "text-ink-3" : ""}`}
                  >
                    {f.value}
                  </dd>
                  <Caution evidence={f.evidence} />
                </div>
              ))}
            </dl>
          </Card>
        </Section>

        <Section
          id="dates"
          title="Key dates"
          hint={`checked against today, ${formatDate(toIsoLocal(now))}`}
          className="xl:col-span-7"
        >
          {deadlines.length === 0 ? (
            <Card>
              <p className="text-sm text-ink-3">Not stated. No dates were found in the document.</p>
            </Card>
          ) : (
            <div className="overflow-hidden rounded-[6px] border border-line bg-card">
              <div className="label hidden grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-4 border-b border-line bg-paper-2 px-5 py-2 text-ink-3 sm:grid">
                <span>What</span>
                <span>Date</span>
                <span>Status</span>
                <span>Source</span>
              </div>
              <ul>
                {deadlines.map((d) => {
                  const gone = d.live.status === "superseded";
                  return (
                    <li
                      key={d.id}
                      className={`grid gap-x-4 gap-y-1.5 border-b border-line px-4 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:px-5 ${
                        d.live.status === "expired" ? "bg-red-wash/50" : ""
                      }`}
                    >
                      <p className={`text-sm font-medium ${gone ? "text-ink-3" : ""}`}>{d.what}</p>
                      <div className="text-sm">
                        {d.date !== "Not stated" ? (
                          <>
                            <span className={`font-mono ${gone ? "text-ink-3 line-through" : ""}`}>
                              {formatDate(d.date)}
                            </span>
                            {d.time_text ? (
                              <span className="block font-mono text-xs text-ink-3">{d.time_text}</span>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-ink-2">{d.date_text || "Not stated"}</span>
                        )}
                        {d.note ? <span className="mt-1 block text-xs text-amber">{d.note}</span> : null}
                      </div>
                      <div>
                        <StatusBadge status={d.live.status} days={d.live.days} />
                      </div>
                      <div>
                        <EvidenceLink evidence={d.evidence} label={d.what} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </Section>
      </div>

      {/* Requirements --------------------------------------------------- */}
      <Section
        id="requirements"
        title="Requirements"
        hint={`${report.requirements.length} found, ${mandatoryCount} mandatory`}
        aside={
          <div
            className="flex rounded-[6px] border border-line bg-card p-0.5"
            role="group"
            aria-label="Filter requirements"
          >
            {[
              [false, `All ${report.requirements.length}`],
              [true, `Mandatory ${mandatoryCount}`],
            ].map(([value, label]) => (
              <button
                key={String(value)}
                type="button"
                aria-pressed={onlyMandatory === value}
                onClick={() => setOnlyMandatory(value as boolean)}
                className={`label rounded-[4px] px-3 py-1.5 transition-colors ${
                  onlyMandatory === value ? "bg-ink text-paper" : "text-ink-2 hover:bg-paper-2"
                }`}
              >
                {label as string}
              </button>
            ))}
          </div>
        }
      >
        {grouped.length === 0 ? (
          <Card>
            <p className="text-sm text-ink-3">Not stated. No requirements were found.</p>
          </Card>
        ) : (
          <div className="columns-1 gap-4 md:columns-2 2xl:columns-3 min-[2200px]:columns-4">
            {grouped.map(([category, items]) => (
              <Card key={category} className="mb-4 break-inside-avoid p-0 sm:p-0">
                <div className="flex items-center justify-between gap-3 border-b border-line bg-paper-2 px-4 py-2 sm:px-5">
                  <h3 className="label text-ink">{CATEGORY_LABELS[category] ?? category}</h3>
                  <span className="font-mono text-xs text-ink-3">{items.length}</span>
                </div>
                <ul>
                  {items.map((r) => (
                    <li key={r.id} className="border-b border-line px-4 py-3 text-sm last:border-b-0 sm:px-5">
                      <p className="leading-relaxed">{r.text}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <Badge tone={r.mandatory ? "red" : "slate"}>
                          {r.mandatory ? "Mandatory" : "Optional"}
                        </Badge>
                        {r.source === "sweep" ? <Badge tone="blue">Added by second look</Badge> : null}
                        <EvidenceLink evidence={r.evidence} label={r.text} />
                      </div>
                      <Caution evidence={r.evidence} />
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        )}
      </Section>

      {/* Qualify and score ---------------------------------------------- */}
      <div className="grid gap-4 xl:grid-cols-2 xl:gap-5">
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
      </div>

      {/* The call ------------------------------------------------------- */}
      <Section
        id="call"
        title={bid ? "Why we should bid" : "Why we should not bid"}
        hint="three strongest reasons"
      >
        <div className="grid gap-4 xl:grid-cols-12 xl:gap-5">
          <div className="min-w-0 space-y-4 xl:col-span-6">
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
              <div className="rounded-[6px] border border-red/30 bg-red-wash p-4 sm:p-5">
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
          </div>

          <div className="grid min-w-0 gap-4 xl:col-span-6 xl:grid-rows-2">
            <Card>
              <h3 className="label">What would change the call</h3>
              {report.would_change_mind.length === 0 ? (
                <p className="mt-3 text-sm text-ink-3">Nothing identified.</p>
              ) : (
                <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-2">
                  {report.would_change_mind.map((t, i) => (
                    <li key={i} className="flex gap-2.5">
                      <span className="mt-[7px] h-[6px] w-[6px] shrink-0 bg-accent" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card>
              <h3 className="label">Questions to ask the agency</h3>
              {report.open_questions.length === 0 ? (
                <p className="mt-3 text-sm text-ink-3">None.</p>
              ) : (
                <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-2">
                  {report.open_questions.map((t, i) => (
                    <li key={i} className="flex gap-2.5">
                      <span className="mt-[7px] h-[6px] w-[6px] shrink-0 bg-accent" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      </Section>

      {/* Ambiguities ---------------------------------------------------- */}
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

      <JsonExport report={report} />
    </div>
  );
}

/** Shown when a figure in an item is missing from the quote that is meant to back it. */
function Caution({ evidence }: { evidence: Evidence | null }) {
  if (!evidence?.caution) return null;
  return <span className="mt-1 block font-mono text-xs text-amber">{evidence.caution}</span>;
}

function toIsoLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Links from a factor or reason back to the items it relied on. */
function Refs({ refs, report }: { refs: EvidenceRef[]; report: TriageReport }) {
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

  const save = (content: string, type: string, suffix: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.file_name.replace(/.pdf$/i, "")}-${suffix}`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const download = () => save(json, "application/json", "triage.json");
  const downloadMatrix = () =>
    save(complianceMatrix(report), "text/csv;charset=utf-8", "compliance-matrix.csv");

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
            onClick={download}
            className="rounded-[6px] bg-accent px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-accent-hi"
          >
            Download JSON
          </button>
          <button
            type="button"
            onClick={downloadMatrix}
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
