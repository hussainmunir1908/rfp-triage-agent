"use client";

import { useRef, useState } from "react";
import { formatDate } from "@/lib/dates";
import type { TriageReport } from "@/lib/types";
import { GHOST, ROBOT, STAR, ZZZ } from "./pixel/art";
import { Sprite } from "./pixel/Sprite";
import { Evidence } from "./report/Evidence";
import { Fit } from "./report/Fit";
import { Overview } from "./report/Overview";
import { Requirements } from "./report/Requirements";
import { Risks } from "./report/Risks";
import { StatusBadge, plural, useDeadlines } from "./report/shared";
import { Timeline } from "./report/Timeline";
import { Badge, Meter } from "./ui";

type TabId = "overview" | "dates" | "requirements" | "risks" | "fit" | "evidence";

function Tile({
  label,
  value,
  sub,
  tone = "default",
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  sub: React.ReactNode;
  tone?: "default" | "bad" | "warn" | "good";
  onClick: () => void;
}) {
  const color =
    tone === "bad"
      ? "text-red"
      : tone === "warn"
        ? "text-amber"
        : tone === "good"
          ? "text-green"
          : "text-ink";
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-w-0 flex-col rounded-[6px] border border-line bg-card p-4 text-left transition-colors hover:border-ink"
    >
      <span className="label flex items-center justify-between gap-2 text-ink-3">
        {label}
        <span className="text-ink-3 transition-transform group-hover:translate-x-0.5">{"->"}</span>
      </span>
      <span
        className={`mt-2 text-[clamp(1.25rem,1.9vw,1.75rem)] font-bold leading-tight tracking-tight ${color}`}
      >
        {value}
      </span>
      <span className="mt-1.5 text-xs leading-relaxed text-ink-2">{sub}</span>
    </button>
  );
}

function Notice({
  tone,
  label,
  children,
}: {
  tone: "red" | "amber";
  label: string;
  children: React.ReactNode;
}) {
  const cls =
    tone === "red" ? "border-red/30 bg-red-wash text-red" : "border-amber/30 bg-amber-wash text-amber";
  return (
    <div role="status" className={`flex items-start gap-3 rounded-[6px] border px-4 py-2.5 text-sm ${cls}`}>
      <span className="label mt-0.5 shrink-0">{label}</span>
      <p className="leading-relaxed">{children}</p>
    </div>
  );
}

export function Report({ report }: { report: TriageReport }) {
  const { deadlines, lastProposal, proposalExpired, anyExpired } = useDeadlines(report);
  const [tab, setTab] = useState<TabId>("overview");
  const topRef = useRef<HTMLDivElement>(null);

  const go = (id: TabId) => {
    setTab(id);
    // Bring the tab bar to the top so the new panel starts in view.
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ block: "start" }));
  };

  const bid = report.decision === "BID";
  const accent = bid ? "var(--mint)" : "var(--coral)";
  const risks = report.risks ?? [];
  const highRisks = risks.filter((r) => r.severity === "high").length;
  const mandatory = report.requirements.filter((r) => r.mandatory).length;
  const toConfirm = report.qualification_checks.filter((q) => q.status !== "met").length;
  const v = report.verification;
  const next = deadlines.find((d) => d.live.status === "upcoming" || d.live.status === "today");
  const due = lastProposal ?? next;
  const lite = /lite/i.test(report.model);

  const tabs: { id: TabId; label: string; count?: number; alert?: boolean }[] = [
    { id: "overview", label: "Overview" },
    { id: "dates", label: "Dates", count: deadlines.length },
    { id: "requirements", label: "Requirements", count: report.requirements.length },
    { id: "risks", label: "Risks", count: risks.length, alert: highRisks > 0 },
    { id: "fit", label: "Fit score" },
    { id: "evidence", label: "Evidence", count: report.ambiguities.length || undefined },
  ];

  return (
    <div className="space-y-4">
      {/* The call ------------------------------------------------------- */}
      <div id="decision" className="relative overflow-hidden rounded-[6px] bg-night p-5 text-paper sm:p-6">
        <div className="relative z-10 grid gap-5 md:grid-cols-[auto_1fr] md:gap-8">
          <div className="flex flex-col justify-between gap-4">
            <div>
              <p className="label text-paper/55">fit score</p>
              <p
                className="mt-1 leading-none tracking-tight"
                style={{ fontFamily: "var(--f-pixel)", fontSize: "clamp(4.5rem,8vw,7rem)", color: accent }}
              >
                {report.fit_score}
                <span className="ml-1 text-[0.32em] text-paper/40">/10</span>
              </p>
            </div>
            <Meter value={report.fit_score} tone={accent} />
          </div>

          <div className="min-w-0 sm:pr-[calc(var(--s)*14)]">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span
                className="stamp label inline-block border-2 px-3 py-1.5 text-[clamp(1.4rem,2.4vw,2rem)] tracking-[0.14em]"
                style={{ color: accent, borderColor: accent }}
              >
                {bid ? "BID" : "NO BID"}
              </span>
              {report.fast_no_bid ? (
                <Badge dark tone="red">
                  Fast no-bid: not our kind of work
                </Badge>
              ) : null}
              {report.cached ? (
                <Badge dark tone="blue">
                  Saved result, no new AI call
                </Badge>
              ) : null}
            </div>
            <p className="mt-3 text-[clamp(1rem,1.4vw,1.15rem)] leading-[1.6] text-paper/90">
              {report.recommendation_summary}
            </p>
            <p className="mt-3 font-mono text-xs leading-relaxed text-paper/50">
              {report.file_name} &middot; {plural(report.page_count, "page")} &middot; read by {report.model}
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

      {/* Anything that changes how far to trust the call ---------------- */}
      {proposalExpired && lastProposal ? (
        <Notice tone="red" label="Closed">
          This RFP has already closed: the proposal deadline was {formatDate(lastProposal.date)} (
          {plural(Math.abs(lastProposal.live.days ?? 0), "day")} ago). The fit assessment still helps with
          similar work, but there is nothing to bid on unless the agency reissues or extends it.
        </Notice>
      ) : anyExpired ? (
        <Notice tone="amber" label="Heads up">
          Some dates in this document have already passed. They are marked on the Dates tab.
        </Notice>
      ) : null}
      {report.thin_document ? (
        <Notice tone="amber" label="Thin document">
          Only {plural(report.requirements.length, "requirement")} could be found, so eligibility, terms and
          risks are unknown rather than absent. The score is capped at 6 and the call is provisional. Get the
          full solicitation before deciding.
        </Notice>
      ) : null}
      {lite ? (
        <Notice tone="amber" label="Provisional">
          A lighter fallback model ({report.model}) wrote part of this report because the main models were
          busy or out of quota. It can list fewer requirements and weigh unknowns differently, which can move
          the score. Run the document again when the main models are back.
        </Notice>
      ) : null}

      {/* At a glance ---------------------------------------------------- */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          label="proposal due"
          value={due ? formatDate(due.date) : "Not stated"}
          sub={due ? <StatusBadge status={due.live.status} days={due.live.days} /> : "No deadline found"}
          tone={proposalExpired ? "bad" : "default"}
          onClick={() => go("dates")}
        />
        <Tile
          label="must-haves"
          value={`${mandatory} mandatory`}
          sub={
            toConfirm > 0
              ? `${toConfirm} eligibility item${toConfirm === 1 ? "" : "s"} to confirm`
              : "Nothing to confirm"
          }
          tone={toConfirm > 0 ? "warn" : "default"}
          onClick={() => go("requirements")}
        />
        <Tile
          label="risk clauses"
          value={
            risks.length === 0 ? "None found" : highRisks > 0 ? `${highRisks} high` : `${risks.length} found`
          }
          sub={risks.length === 0 ? "Of the kinds scanned" : `${risks.length} in total, with pages`}
          tone={highRisks > 0 ? "bad" : "default"}
          onClick={() => go("risks")}
        />
        <Tile
          label="evidence"
          value={`${v.verified}/${v.total}`}
          sub={
            v.unverified > 0
              ? `${v.unverified} quote${v.unverified === 1 ? "" : "s"} not found`
              : "quotes found in the PDF"
          }
          tone={v.unverified > 0 ? "warn" : "good"}
          onClick={() => go("evidence")}
        />
      </div>

      {/* Tabs ----------------------------------------------------------- */}
      <div ref={topRef} className="scroll-mt-14" />
      <div className="sticky top-14 z-20 -mx-[var(--gutter)] border-b border-line bg-paper px-[var(--gutter)]">
        <div role="tablist" aria-label="Report sections" className="flex gap-1 overflow-x-auto py-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              type="button"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              onClick={() => go(t.id)}
              className={`label flex shrink-0 items-center gap-2 whitespace-nowrap rounded-[4px] px-3 py-2 text-[15px] transition-colors ${
                tab === t.id ? "bg-ink text-paper" : "text-ink-2 hover:bg-paper-2 hover:text-ink"
              }`}
            >
              {t.label}
              {t.count !== undefined ? (
                <span
                  className={`rounded-[3px] px-1.5 py-px text-[13px] ${
                    t.alert
                      ? "bg-red text-white"
                      : tab === t.id
                        ? "bg-paper/20 text-paper"
                        : "bg-paper-2 text-ink-2"
                  }`}
                >
                  {t.count}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="pt-1">
        {tab === "overview" ? <Overview report={report} onFlags={() => go("evidence")} /> : null}
        {tab === "dates" ? <Timeline report={report} /> : null}
        {tab === "requirements" ? <Requirements report={report} /> : null}
        {tab === "risks" ? <Risks report={report} /> : null}
        {tab === "fit" ? <Fit report={report} /> : null}
        {tab === "evidence" ? <Evidence report={report} /> : null}
      </div>
    </div>
  );
}
