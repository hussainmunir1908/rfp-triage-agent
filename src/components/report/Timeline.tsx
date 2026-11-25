"use client";

import { formatDate } from "@/lib/dates";
import type { TriageReport } from "@/lib/types";
import { CROSS, FLAG, ROBOT, TICK } from "../pixel/art";
import { Sprite } from "../pixel/Sprite";
import { Badge, Card, EvidenceLink, Section } from "../ui";
import { StatusBadge, plural, toIsoLocal, useDeadlines, type LiveDeadline } from "./shared";

type Node = { kind: "item"; d: LiveDeadline } | { kind: "today" };

const DASHES = (color: string) => `repeating-linear-gradient(90deg, ${color} 0 8px, transparent 8px 12px)`;

/** The marker on the track for one date: a tick if it happened, a cross if it was missed, a flag if ahead. */
function Marker({ d }: { d: LiveDeadline }) {
  const status = d.live.status;
  if (status === "passed") return <Sprite art={TICK} px="3px" />;
  if (status === "expired") return <Sprite art={CROSS} px="3px" />;
  const big = d.kind === "proposal_due";
  return (
    <div className={status === "today" ? "blink" : ""}>
      <Sprite art={FLAG} px={big ? "5px" : "3px"} />
    </div>
  );
}

function tone(d: LiveDeadline): string {
  if (d.live.status === "expired") return "var(--red)";
  if (d.live.status === "passed") return "var(--green)";
  return "var(--ink)";
}

function TodayMarker() {
  return (
    <div className="bob">
      <Sprite art={ROBOT} px="3px" />
    </div>
  );
}

function Horizontal({ nodes }: { nodes: Node[] }) {
  return (
    <div className="hidden overflow-x-auto md:block">
      <ol className="flex" style={{ minWidth: `${nodes.length * 128}px` }}>
        {nodes.map((n, i) => {
          const first = i === 0;
          const last = i === nodes.length - 1;
          const past = n.kind === "item" && (n.d.live.status === "passed" || n.d.live.status === "expired");
          const color = past ? "var(--green)" : "var(--line-2)";
          return (
            <li
              key={n.kind === "item" ? n.d.id : "today"}
              className="flex min-w-0 flex-1 flex-col items-center px-1"
            >
              <div className="flex h-[3.6rem] w-full items-end justify-center pb-2 text-center">
                {n.kind === "item" ? (
                  <p className="line-clamp-3 text-[13px] font-medium leading-tight">{n.d.what}</p>
                ) : (
                  <p className="label text-ink">today</p>
                )}
              </div>
              <div className="relative flex h-[40px] w-full items-center justify-center">
                <span
                  className="absolute top-1/2 h-[4px] -translate-y-1/2"
                  style={{
                    left: first ? "50%" : 0,
                    right: last ? "50%" : 0,
                    backgroundImage: DASHES(color),
                  }}
                />
                <div className="relative z-10 bg-card px-1">
                  {n.kind === "item" ? <Marker d={n.d} /> : <TodayMarker />}
                </div>
              </div>
              <div className="w-full pt-2 text-center">
                {n.kind === "item" ? (
                  <>
                    <p
                      className={`font-mono text-[13px] font-medium ${n.d.live.status === "expired" ? "line-through" : ""}`}
                      style={{ color: tone(n.d) }}
                    >
                      {formatDate(n.d.date)}
                    </p>
                    {n.d.time_text ? (
                      <p className="font-mono text-[11px] text-ink-3">{n.d.time_text}</p>
                    ) : null}
                    <div className="mt-1 flex justify-center">
                      <StatusBadge status={n.d.live.status} days={n.d.live.days} />
                    </div>
                  </>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Vertical({ nodes }: { nodes: Node[] }) {
  return (
    <ol className="md:hidden">
      {nodes.map((n, i) => {
        const last = i === nodes.length - 1;
        return (
          <li key={n.kind === "item" ? n.d.id : "today"} className="relative flex gap-3 pb-4 last:pb-0">
            {!last ? (
              <span
                className="absolute left-[15px] top-8 bottom-0 w-[4px]"
                style={{
                  backgroundImage: `repeating-linear-gradient(180deg, var(--line-2) 0 8px, transparent 8px 12px)`,
                }}
              />
            ) : null}
            <div className="relative z-10 flex h-8 w-8 shrink-0 items-start justify-center bg-card pt-1">
              {n.kind === "item" ? <Marker d={n.d} /> : <TodayMarker />}
            </div>
            <div className="min-w-0 pt-0.5">
              {n.kind === "item" ? (
                <>
                  <p className="text-sm font-medium leading-snug">{n.d.what}</p>
                  <p
                    className={`mt-0.5 font-mono text-[13px] ${n.d.live.status === "expired" ? "line-through" : ""}`}
                    style={{ color: tone(n.d) }}
                  >
                    {formatDate(n.d.date)}
                    {n.d.time_text ? ` · ${n.d.time_text}` : ""}
                  </p>
                  <div className="mt-1">
                    <StatusBadge status={n.d.live.status} days={n.d.live.days} />
                  </div>
                </>
              ) : (
                <p className="label pt-1 text-ink">today</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function Timeline({ report }: { report: TriageReport }) {
  const { now, deadlines } = useDeadlines(report);

  const dated = deadlines.filter(
    (d) => d.live.days !== null && d.live.status !== "superseded" && d.live.status !== "undated",
  );
  const undated = deadlines.filter((d) => d.live.status === "undated");
  const replaced = deadlines.filter((d) => d.live.status === "superseded");

  // Today sits before the first date that is today or later.
  const split = dated.filter((d) => (d.live.days ?? 0) < 0).length;
  const nodes: Node[] =
    dated.length === 0
      ? []
      : [
          ...dated.slice(0, split).map((d): Node => ({ kind: "item", d })),
          { kind: "today" },
          ...dated.slice(split).map((d): Node => ({ kind: "item", d })),
        ];

  const first = dated[0];
  const lastDate = dated.at(-1);
  const span =
    first && lastDate && first.live.days !== null && lastDate.live.days !== null
      ? lastDate.live.days - first.live.days
      : null;

  return (
    <Section id="dates" title="Key dates" hint={`checked against today, ${formatDate(toIsoLocal(now))}`}>
      {deadlines.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-3">Not stated. No dates were found in the document.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {nodes.length > 0 ? (
            <Card>
              <Horizontal nodes={nodes} />
              <Vertical nodes={nodes} />
              {span !== null && span > 0 ? (
                <p className="mt-4 border-t border-line pt-3 font-mono text-xs text-ink-3">
                  {plural(span, "day")} from {formatDate(first.date)} to {formatDate(lastDate!.date)}. Flag =
                  ahead, tick = happened, cross = missed.
                </p>
              ) : null}
            </Card>
          ) : null}

          {undated.length + replaced.length > 0 ? (
            <Card>
              <h3 className="label text-ink-3">not on the track</h3>
              <ul className="mt-2 space-y-2 text-sm">
                {replaced.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-ink-3 line-through">
                      {d.what}, {formatDate(d.date)}
                    </span>
                    <Badge>Replaced by a later date</Badge>
                    <EvidenceLink evidence={d.evidence} label={d.what} />
                  </li>
                ))}
                {undated.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>
                      {d.what}: <span className="text-ink-2">{d.date_text || "no calendar date"}</span>
                    </span>
                    <EvidenceLink evidence={d.evidence} label={d.what} />
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <details className="group rounded-[6px] border border-line bg-card">
            <summary className="label cursor-pointer px-4 py-3 text-ink-2 sm:px-5">
              All {deadlines.length} dates with their sources
            </summary>
            <ul className="border-t border-line">
              {deadlines.map((d) => (
                <li
                  key={d.id}
                  className="grid gap-x-4 gap-y-1.5 border-b border-line px-4 py-3 text-sm last:border-b-0 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:px-5"
                >
                  <p className={d.live.status === "superseded" ? "text-ink-3" : "font-medium"}>{d.what}</p>
                  <div>
                    {d.date !== "Not stated" ? (
                      <span
                        className={`font-mono ${d.live.status === "superseded" ? "text-ink-3 line-through" : ""}`}
                      >
                        {formatDate(d.date)}
                        {d.time_text ? ` · ${d.time_text}` : ""}
                      </span>
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
              ))}
            </ul>
          </details>
        </div>
      )}
    </Section>
  );
}
