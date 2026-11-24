"use client";

import { useEffect, useState } from "react";
import {
  BLOCK,
  BOOK_OPEN,
  BOOK_SHUT,
  CAT,
  FOX,
  FROG,
  GAVEL,
  GROUND_TILE,
  LENS,
  TICK,
  ZZZ,
  type Art,
} from "./pixel/art";
import { Sprite, tileBackground } from "./pixel/Sprite";

const ON_DARK = { k: "#a9a8a0" };

export type StageKey = "read" | "extract" | "verify" | "judge" | "done";
export const STAGE_ORDER: StageKey[] = ["read", "extract", "verify", "judge", "done"];

const MAX_TILES = 150;
const GRASS = GROUND_TILE.slice(0, 5);

type StationState = "pending" | "active" | "done";

function stationStates(stage: StageKey): StationState[] {
  const at = { read: 0, extract: 0, verify: 1, judge: 2, done: 3 }[stage];
  return [0, 1, 2].map((i) => (i < at ? "done" : i === at ? "active" : "pending"));
}

function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function Station({
  art,
  label,
  note,
  state,
  prop,
}: {
  art: Art;
  label: string;
  note: string;
  state: StationState;
  prop: "book" | "lens" | "gavel";
}) {
  const active = state === "active";
  return (
    <div className="flex min-w-0 flex-col items-center">
      <div
        className="relative flex w-full items-end justify-center"
        style={{ height: "calc(var(--s) * 17)" }}
      >
        {state === "pending" ? (
          <div className="absolute" style={{ top: "calc(var(--s) * 1)", left: "calc(50% + var(--s) * 4)" }}>
            <Sprite art={ZZZ} px="calc(var(--s) * 0.5)" className="blink opacity-70" />
          </div>
        ) : null}
        {state === "done" ? (
          <div className="absolute" style={{ top: "calc(var(--s) * 1)", left: "calc(50% + var(--s) * 5)" }}>
            <Sprite art={TICK} px="calc(var(--s) * 0.75)" />
          </div>
        ) : null}

        <div className="relative" style={{ marginBottom: 0 }}>
          <div className={active ? "bob" : state === "done" ? "" : "opacity-45"}>
            <Sprite art={art} px="round(calc(var(--s) * 1.5), 1px)" />
          </div>

          {prop === "book" ? (
            <div
              className="absolute"
              style={{ left: "calc(100% - var(--s) * 3)", bottom: "calc(var(--s) * 1)" }}
              hidden={state === "pending"}
            >
              <div className={active ? "flip-a" : ""}>
                <Sprite art={BOOK_OPEN} px="calc(var(--s) * 0.75)" recolor={ON_DARK} />
              </div>
              {active ? (
                <div className="flip-b absolute left-0 top-0">
                  <Sprite
                    recolor={ON_DARK}
                    art={BOOK_SHUT}
                    px="calc(var(--s) * 0.75)"
                    style={{ marginLeft: "calc(var(--s) * 0.5)", marginTop: "calc(var(--s) * 1)" }}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {prop === "lens" ? (
            <div
              className={`absolute ${active ? "bob" : ""}`}
              style={{ left: "calc(100% - var(--s) * 3)", bottom: "calc(var(--s) * 0)" }}
              hidden={state === "pending"}
            >
              <Sprite art={LENS} px="calc(var(--s) * 0.75)" recolor={ON_DARK} />
            </div>
          ) : null}

          {prop === "gavel" ? (
            <div
              className="absolute"
              style={{ left: "calc(100% - var(--s) * 2)", bottom: "calc(var(--s) * 0)" }}
              hidden={state === "pending"}
            >
              <div className={active ? "tap" : ""}>
                <Sprite art={GAVEL} px="calc(var(--s) * 0.75)" recolor={ON_DARK} />
              </div>
              <div style={{ marginTop: "calc(var(--s) * -0.5)", marginLeft: "calc(var(--s) * -0.5)" }}>
                <Sprite art={BLOCK} px="calc(var(--s) * 0.75)" recolor={ON_DARK} />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div
        className="w-full"
        style={{
          height: `calc(var(--s) * ${GRASS.length})`,
          backgroundImage: tileBackground(GRASS),
          backgroundSize: `calc(var(--s) * 16) calc(var(--s) * ${GRASS.length})`,
          backgroundRepeat: "repeat-x",
          imageRendering: "pixelated",
        }}
      />

      <p
        className={`label mt-3 text-[11px] font-bold ${
          active ? "text-orange" : state === "done" ? "text-[#3fb585]" : "text-paper/40"
        }`}
      >
        {label}
      </p>
      <p className="mt-1 hidden max-w-[24ch] text-center font-mono text-[11px] leading-relaxed text-paper/55 sm:block">
        {note}
      </p>
    </div>
  );
}

/** One small tile per page of the document. */
function PageStrip({ stage, total, readPages }: { stage: StageKey; total: number; readPages: number }) {
  const tiles = total > 0 ? Math.min(total, MAX_TILES) : 24;
  const perTile = total > 0 ? total / tiles : 1;
  const size = tiles <= 30 ? "h-[22px] w-[16px]" : tiles <= 80 ? "h-[16px] w-[12px]" : "h-[13px] w-[9px]";
  const verifying = stage === "verify";
  const gap = Math.max(8, Math.floor(2000 / tiles));
  const sweepMs = gap * tiles;

  return (
    <div className="relative pt-9">
      {verifying ? (
        <div
          key="lens"
          className="sweep absolute top-0 left-0"
          style={{ ["--dur" as string]: `${sweepMs}ms` }}
        >
          <Sprite art={LENS} px="3px" recolor={ON_DARK} />
        </div>
      ) : null}
      <div
        className="flex flex-wrap gap-[3px]"
        style={{ ["--gap" as string]: `${gap}ms` }}
        role="img"
        aria-label={total > 0 ? `${total} pages` : "Pages"}
      >
        {Array.from({ length: tiles }, (_, i) => {
          let cls = "bg-night-line";
          if (stage === "read") {
            cls = (i + 1) * perTile <= readPages ? "bg-[#cfcdc3]" : "bg-night-line";
          } else if (stage === "extract") {
            cls = "tile-scan";
          } else if (stage === "verify") {
            cls = "tile-tick";
          } else {
            cls = "bg-[#3fb585]";
          }
          return <span key={`${stage}-${i}`} className={`${size} ${cls}`} style={{ ["--i" as string]: i }} />;
        })}
      </div>
    </div>
  );
}

const DEFAULT_LOG: Record<StageKey, string> = {
  read: "opening the PDF",
  extract: "reading every page and pulling out facts, dates and requirements",
  verify: "looking every quote up in the PDF text",
  judge: "scoring the fit against the idiaz.io profile",
  done: "done",
};

const STAGE_RANGE: Record<StageKey, [number, number]> = {
  read: [0, 14],
  extract: [14, 58],
  verify: [58, 66],
  judge: [66, 96],
  done: [100, 100],
};

export function Working({
  stage,
  fileName,
  total,
  readPages,
  messages,
  startedAt,
  stageSince,
}: {
  stage: StageKey;
  fileName: string;
  total: number;
  readPages: number;
  messages: Partial<Record<StageKey, string>>;
  startedAt: number;
  /** When the stage on screen began. */
  stageSince: number;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const states = stationStates(stage);
  const [lo, hi] = STAGE_RANGE[stage];
  const inStage = (now - stageSince) / 1000;
  let pct = lo;
  if (stage === "read" && total > 0) pct = lo + (hi - lo) * (readPages / total);
  else if (stage !== "done" && stage !== "read") pct = lo + (hi - lo) * (1 - Math.exp(-inStage / 22));
  const blocks = 28;
  const lit = Math.round((pct / 100) * blocks);

  const log =
    stage === "read"
      ? total > 0
        ? `reading page ${readPages} of ${total} in your browser`
        : "opening the PDF in your browser"
      : stage === "done"
        ? "done, opening the report"
        : (messages[stage] ?? DEFAULT_LOG[stage]);

  return (
    <section className="frame py-[clamp(16px,3vw,40px)]" aria-live="polite" aria-busy={stage !== "done"}>
      <div className="rounded-[6px] border border-night-line bg-night p-[clamp(14px,2.4vw,32px)] text-paper">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <p className="label flex min-w-0 items-center gap-2 text-paper/80">
            <span
              className={`inline-block h-[8px] w-[8px] shrink-0 bg-orange ${stage === "done" ? "" : "blink"}`}
            />
            <span className="shrink-0">analyzing //</span>
            <span className="truncate text-paper">{fileName}</span>
          </p>
          <p className="label tabular-nums text-paper/60">{clock(now - startedAt)}</p>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-[clamp(6px,2vw,28px)]">
          <Station
            art={FROG}
            label="Read"
            note="pulls out facts, dates and must-haves"
            state={states[0]}
            prop="book"
          />
          <Station
            art={FOX}
            label="Check"
            note="looks every quote up in the PDF text"
            state={states[1]}
            prop="lens"
          />
          <Station
            art={CAT}
            label="Judge"
            note="scores the fit and makes the call"
            state={states[2]}
            prop="gavel"
          />
        </div>

        <div className="mt-6 border-t border-night-line pt-4">
          <div className="flex items-center justify-between gap-3">
            <p className="label text-paper/60">pages{total > 0 ? ` // ${total}` : ""}</p>
            <p className="label text-paper/60">
              {stage === "verify" ? "checking quotes" : stage === "extract" ? "reading" : ""}
            </p>
          </div>
          <PageStrip stage={stage} total={total} readPages={readPages} />
        </div>

        <div
          className="mt-5 flex items-center gap-[3px]"
          role="progressbar"
          aria-label="Progress"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          {Array.from({ length: blocks }, (_, i) => (
            <span key={i} className={`h-[10px] flex-1 ${i < lit ? "bg-orange" : "bg-night-line"}`} />
          ))}
        </div>

        <p className="mt-4 min-h-[1.5em] font-mono text-[13px] leading-relaxed text-paper/85">
          <span className="text-orange">&gt;</span> {log}
          {stage !== "done" ? (
            <span className="blink ml-1 inline-block h-[1em] w-[0.5em] translate-y-[2px] bg-paper/80" />
          ) : null}
        </p>
      </div>

      <p className="mt-3 text-center font-mono text-xs text-ink-3">
        A run usually takes one to two minutes on the free AI tier. If a model is busy, the agent tries the
        next one.
      </p>
    </section>
  );
}
