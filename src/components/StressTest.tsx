"use client";

import { useMemo, useState } from "react";
import type { CheckStatus, TriageReport } from "@/lib/types";
import {
  apply,
  baseScenario,
  evaluate,
  explain,
  findFlips,
  isChanged,
  type Flip,
  type Move,
  type Scenario,
} from "@/lib/whatif";
import { GHOST, ROBOT, STAR } from "./pixel/art";
import { Sprite } from "./pixel/Sprite";
import { Card, Meter, Section } from "./ui";

const STATUS_OPTIONS: { value: CheckStatus; label: string; on: string }[] = [
  { value: "met", label: "Met", on: "bg-green text-white" },
  { value: "unknown", label: "Confirm", on: "bg-accent text-ink" },
  { value: "at_risk", label: "At risk", on: "bg-amber text-white" },
  { value: "blocked", label: "Blocked", on: "bg-red text-white" },
];

const STATUS_WORD: Record<CheckStatus, string> = {
  met: "Met",
  unknown: "Confirm",
  at_risk: "At risk",
  blocked: "Blocked",
};

function callLabel(decision: "BID" | "NO_BID") {
  return decision === "BID" ? "BID" : "NO BID";
}

function describe(report: TriageReport, move: Move, scenario: Scenario): string {
  if (move.kind === "check") {
    const c = report.qualification_checks[move.index];
    return `${shorten(c.requirement)} turns out ${STATUS_WORD[move.to].toLowerCase()}`;
  }
  if (move.kind === "dealbreaker") {
    return `Waived or solved: ${shorten(report.deal_breakers[move.index].text)}`;
  }
  const f = report.factors[move.index];
  const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
  return `${f.name}: ${signed(scenario.impacts[move.index])} becomes ${signed(move.to)}`;
}

function shorten(text: string, max = 90): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export function StressTest({ report }: { report: TriageReport }) {
  const base = useMemo(() => baseScenario(report), [report]);
  const [scenario, setScenario] = useState<Scenario>(base);

  const original = useMemo(() => evaluate(report, base), [report, base]);
  const now = useMemo(() => evaluate(report, scenario), [report, scenario]);
  const changed = isChanged(base, scenario);
  const search = useMemo(() => findFlips(report, scenario, base), [report, scenario, base]);
  const notes = useMemo(() => explain(report, scenario), [report, scenario]);

  const nothingToChange =
    report.qualification_checks.length === 0 &&
    report.deal_breakers.length === 0 &&
    report.factors.length === 0;
  if (nothingToChange) return null;

  const bid = now.decision === "BID";
  const tone = bid ? "var(--mint)" : "var(--coral)";
  const flipped = now.decision !== original.decision;

  const setCheck = (index: number, to: CheckStatus) =>
    setScenario((s) => ({ ...s, checks: s.checks.map((c, i) => (i === index ? to : c)) }));
  const toggleWaived = (index: number) =>
    setScenario((s) => ({ ...s, waived: s.waived.map((w, i) => (i === index ? !w : w)) }));
  const nudge = (index: number, by: number) =>
    setScenario((s) => ({
      ...s,
      impacts: s.impacts.map((v, i) => (i === index ? Math.max(-3, Math.min(3, v + by)) : v)),
    }));
  const tryFlip = (flip: Flip) => setScenario((s) => flip.moves.reduce(apply, s));

  return (
    <Section
      id="stress"
      title="Stress test"
      hint="change an assumption, watch the call move"
      aside={
        <button
          type="button"
          onClick={() => setScenario(base)}
          disabled={!changed}
          className="label rounded-[6px] border-2 border-ink px-3 py-1.5 text-ink transition-colors hover:bg-ink hover:text-paper disabled:cursor-not-allowed disabled:border-line-2 disabled:text-ink-3 disabled:hover:bg-transparent disabled:hover:text-ink-3"
        >
          Reset to the report
        </button>
      }
    >
      <p className="-mt-1 mb-4 max-w-[80ch] font-mono text-xs leading-relaxed text-ink-3">
        The score is plain arithmetic in code, so it can be re-run here with one assumption changed. Nothing
        below calls the AI again.
      </p>

      <div className="grid gap-4 xl:grid-cols-12 xl:items-start xl:gap-5">
        {/* Live call: compact and sticky on small screens, a full panel on wide ones. */}
        <div className="min-w-0 xl:sticky xl:top-28 xl:col-span-5 xl:order-2">
          <div className="sticky top-[6.5rem] z-10 xl:hidden">
            <div className="flex items-center justify-between gap-3 rounded-[6px] bg-night px-4 py-3 text-paper">
              <p className="label text-paper/60">live call</p>
              <div className="flex items-center gap-3">
                <span className="text-4xl leading-none" style={{ fontFamily: "var(--f-pixel)", color: tone }}>
                  {now.fitScore}
                  <span className="text-xl text-paper/40">/10</span>
                </span>
                <span
                  key={now.decision}
                  className="stamp label border-2 px-2 py-1 text-lg tracking-[0.14em]"
                  style={{ color: tone, borderColor: tone }}
                >
                  {callLabel(now.decision)}
                </span>
              </div>
            </div>
          </div>

          <div className="relative hidden overflow-hidden rounded-[6px] bg-night p-6 text-paper xl:block">
            <p className="label text-paper/55">
              live call{changed ? " // your scenario" : " // as reported"}
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-3">
              <p
                className="leading-none"
                style={{ fontFamily: "var(--f-pixel)", fontSize: "7rem", color: tone }}
              >
                {now.fitScore}
                <span className="ml-1 text-[0.3em] text-paper/40">/10</span>
              </p>
              <span
                key={now.decision}
                className="stamp label mb-2 inline-block border-2 px-3 py-1.5 text-3xl tracking-[0.14em]"
                style={{ color: tone, borderColor: tone }}
              >
                {callLabel(now.decision)}
              </span>
            </div>
            <div className="mt-4">
              <Meter value={now.fitScore} tone={tone} />
            </div>
            <p className="mt-4 min-h-[2.6em] font-mono text-xs leading-relaxed text-paper/70">
              {changed ? (
                flipped ? (
                  <>
                    <span style={{ color: tone }}>This flips the call.</span> The report said{" "}
                    {callLabel(original.decision)} at {original.fitScore}/10.
                  </>
                ) : (
                  <>
                    The call holds: still {callLabel(original.decision)}, score {original.fitScore} →{" "}
                    {now.fitScore}.
                  </>
                )
              ) : (
                "Change a status, waive a deal-breaker or nudge a factor on the left."
              )}
            </p>
            <ul className="mt-4 space-y-1.5 border-t border-night-line pt-4 font-mono text-xs leading-relaxed text-paper/60">
              {notes.map((n) => (
                <li key={n} className="flex gap-2">
                  <span className="mt-[6px] h-[5px] w-[5px] shrink-0 bg-accent" />
                  <span>{n}</span>
                </li>
              ))}
            </ul>
            <div className="pointer-events-none absolute right-5 top-5 flex items-end gap-2" aria-hidden>
              {bid ? (
                <>
                  <div className="hop mb-1">
                    <Sprite art={STAR} px="3px" />
                  </div>
                  <div className="hop">
                    <Sprite art={ROBOT} px="4px" />
                  </div>
                </>
              ) : (
                <div className="bob">
                  <Sprite art={GHOST} px="4px" />
                </div>
              )}
            </div>
          </div>

          <Card className="mt-4">
            <h3 className="label ">
              {search.locked
                ? "Why nothing flips this"
                : now.decision === "BID"
                  ? "What would sink this bid"
                  : "Shortest way to a bid"}
            </h3>
            {search.locked ? (
              <p className="mt-3 text-sm leading-relaxed text-ink-2">
                This is out-of-domain work, so the rule gives a fast no-bid whatever the other facts say. No
                change of assumptions turns it into a bid.
              </p>
            ) : search.flips.length === 0 ? (
              <p className="mt-3 text-sm leading-relaxed text-ink-2">
                No combination of up to four changes reverses this call from here.
              </p>
            ) : (
              <ol className="mt-3 space-y-3">
                {search.flips.map((flip, i) => (
                  <li key={i} className="border border-line bg-paper/60 p-3">
                    <p className="label text-ink-3">
                      {flip.moves.length === 1 ? "one change" : `${flip.moves.length} changes`} {"->"}{" "}
                      {callLabel(flip.to)} {flip.result.fitScore}/10
                    </p>
                    <ul className="mt-2 space-y-1 text-sm leading-relaxed">
                      {flip.moves.map((m, j) => (
                        <li key={j} className="flex gap-2">
                          <span className="mt-[7px] h-[5px] w-[5px] shrink-0 bg-ink" />
                          <span>{describe(report, m, scenario)}</span>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={() => tryFlip(flip)}
                      className="label mt-3 rounded-[4px] border-2 border-ink bg-accent px-2.5 py-1 text-ink transition-transform hover:-translate-y-px active:translate-y-px"
                    >
                      Try it
                    </button>
                  </li>
                ))}
              </ol>
            )}
            <p className="mt-3 font-mono text-[11px] leading-relaxed text-ink-3">
              Found by trying every combination of changes in code, smallest first.
            </p>
          </Card>
        </div>

        <div className="min-w-0 space-y-4 xl:col-span-7 xl:order-1">
          {report.qualification_checks.length > 0 ? (
            <Card className="p-0 sm:p-0">
              <h3 className="label border-b border-line bg-paper-2 px-4 py-2  sm:px-5">
                Mandatory checks // can we qualify?
              </h3>
              <ul>
                {report.qualification_checks.map((q, i) => (
                  <li
                    key={q.requirement_id}
                    className="grid gap-x-4 gap-y-2 border-b border-line px-4 py-3 text-sm last:border-b-0 sm:px-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
                  >
                    <div className="min-w-0">
                      <p className="leading-relaxed">{q.requirement}</p>
                      {scenario.checks[i] !== base.checks[i] ? (
                        <p className="mt-0.5 font-mono text-xs text-accent-ink">
                          Report said {STATUS_WORD[base.checks[i]].toLowerCase()}.
                        </p>
                      ) : (
                        <p className="mt-0.5 text-ink-3">{q.note}</p>
                      )}
                    </div>
                    <div
                      className="flex w-fit rounded-[6px] border border-line-2 bg-card p-0.5"
                      role="group"
                      aria-label={`Status of: ${q.requirement}`}
                    >
                      {STATUS_OPTIONS.map((o) => (
                        <button
                          key={o.value}
                          type="button"
                          aria-pressed={scenario.checks[i] === o.value}
                          onClick={() => setCheck(i, o.value)}
                          className={`label rounded-[4px] px-2.5 py-1.5 transition-colors ${
                            scenario.checks[i] === o.value ? o.on : "text-ink-2 hover:bg-paper-2"
                          }`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {report.deal_breakers.length > 0 ? (
            <Card className="p-0 sm:p-0">
              <h3 className="label border-b border-line bg-paper-2 px-4 py-2  sm:px-5">
                Deal-breakers // would the agency bend?
              </h3>
              <ul>
                {report.deal_breakers.map((d, i) => (
                  <li
                    key={i}
                    className="grid gap-x-4 gap-y-2 border-b border-line px-4 py-3 text-sm last:border-b-0 sm:px-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
                  >
                    <p className={`leading-relaxed ${scenario.waived[i] ? "text-ink-3 line-through" : ""}`}>
                      {d.text}
                    </p>
                    <button
                      type="button"
                      aria-pressed={scenario.waived[i]}
                      onClick={() => toggleWaived(i)}
                      className={`label w-fit rounded-[4px] border-2 px-3 py-1.5 transition-colors ${
                        scenario.waived[i]
                          ? "border-green bg-green text-white"
                          : "border-ink text-ink hover:bg-ink hover:text-paper"
                      }`}
                    >
                      {scenario.waived[i] ? "Waived or solved" : "Waive it"}
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {report.factors.length > 0 ? (
            <Card className="p-0 sm:p-0">
              <h3 className="label border-b border-line bg-paper-2 px-4 py-2  sm:px-5">
                Score factors // how sure are we?
              </h3>
              <ul>
                {report.factors.map((f, i) => (
                  <li
                    key={i}
                    className="grid gap-x-4 gap-y-2 border-b border-line px-4 py-3 text-sm last:border-b-0 sm:px-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold">{f.name}</p>
                      <p className="leading-relaxed text-ink-3">{f.reason}</p>
                    </div>
                    <div className="flex w-fit items-center" role="group" aria-label={`Impact of ${f.name}`}>
                      <button
                        type="button"
                        aria-label="Lower the impact"
                        disabled={scenario.impacts[i] <= -3}
                        onClick={() => nudge(i, -1)}
                        className="grid h-9 w-9 place-items-center border-2 border-ink text-lg leading-none transition-colors hover:bg-ink hover:text-paper disabled:cursor-not-allowed disabled:border-line-2 disabled:text-ink-3 disabled:hover:bg-transparent"
                      >
                        −
                      </button>
                      <span
                        className={`grid h-9 w-14 place-items-center border-y-2 border-ink text-xl ${
                          scenario.impacts[i] > 0
                            ? "bg-green-wash text-green"
                            : scenario.impacts[i] < 0
                              ? "bg-red-wash text-red"
                              : "bg-paper-2 text-ink-2"
                        }`}
                        style={{ fontFamily: "var(--f-pixel)" }}
                      >
                        {scenario.impacts[i] > 0 ? `+${scenario.impacts[i]}` : scenario.impacts[i]}
                      </span>
                      <button
                        type="button"
                        aria-label="Raise the impact"
                        disabled={scenario.impacts[i] >= 3}
                        onClick={() => nudge(i, 1)}
                        className="grid h-9 w-9 place-items-center border-2 border-ink text-lg leading-none transition-colors hover:bg-ink hover:text-paper disabled:cursor-not-allowed disabled:border-line-2 disabled:text-ink-3 disabled:hover:bg-transparent"
                      >
                        +
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>
    </Section>
  );
}
