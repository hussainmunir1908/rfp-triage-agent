"use client";

import { useMemo, useState } from "react";
import type { TriageReport } from "@/lib/types";
import { Badge, Card, EvidenceLink, Section } from "../ui";
import { CATEGORY_LABELS, Caution } from "./shared";

/** Above this many items the groups start closed, so the list is not a wall of text. */
const OPEN_LIMIT = 14;
const PREVIEW_OPEN = 2;

export function Requirements({ report }: { report: TriageReport }) {
  const [onlyMandatory, setOnlyMandatory] = useState(true);
  const [open, setOpen] = useState<Set<string>>(new Set());
  // Until the reader opens or closes something, the first groups are shown so the tab is not empty.
  const [touched, setTouched] = useState(false);

  const mandatoryCount = report.requirements.filter((r) => r.mandatory).length;
  const grouped = useMemo(() => {
    const map = new Map<string, TriageReport["requirements"]>();
    for (const r of report.requirements) {
      if (onlyMandatory && !r.mandatory) continue;
      map.set(r.category, [...(map.get(r.category) ?? []), r]);
    }
    return [...map.entries()];
  }, [report.requirements, onlyMandatory]);

  const shown = grouped.reduce((n, [, items]) => n + items.length, 0);
  const allOpen = shown <= OPEN_LIMIT;
  const isOpen = (cat: string) =>
    allOpen || open.has(cat) || (!touched && grouped.findIndex(([c]) => c === cat) < PREVIEW_OPEN);
  const toggle = (cat: string, value: boolean) => {
    setTouched(true);
    setOpen((prev) => {
      const next = new Set(prev);
      if (value) next.add(cat);
      else next.delete(cat);
      return next;
    });
  };

  return (
    <Section
      id="requirements"
      title="Requirements"
      hint={`${report.requirements.length} found, ${mandatoryCount} mandatory`}
      aside={
        <div className="flex flex-wrap items-center gap-2">
          {!allOpen ? (
            <button
              type="button"
              onClick={() => {
                setTouched(true);
                setOpen(open.size > 0 ? new Set() : new Set(grouped.map(([c]) => c)));
              }}
              className="label rounded-[6px] border border-line-2 px-3 py-1.5 text-ink-2 hover:bg-paper-2"
            >
              {open.size > 0 ? "Collapse all" : "Expand all"}
            </button>
          ) : null}
          <div
            className="flex rounded-[6px] border border-line bg-card p-0.5"
            role="group"
            aria-label="Filter requirements"
          >
            {(
              [
                [true, `Mandatory ${mandatoryCount}`],
                [false, `All ${report.requirements.length}`],
              ] as const
            ).map(([value, label]) => (
              <button
                key={String(value)}
                type="button"
                aria-pressed={onlyMandatory === value}
                onClick={() => setOnlyMandatory(value)}
                className={`label rounded-[4px] px-3 py-1.5 transition-colors ${
                  onlyMandatory === value ? "bg-ink text-paper" : "text-ink-2 hover:bg-paper-2"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      }
    >
      {grouped.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-3">Not stated. No requirements were found.</p>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2 lg:items-start">
          {grouped.map(([category, items]) => (
            <details
              key={category}
              open={isOpen(category)}
              onToggle={(e) => {
                if (!allOpen) toggle(category, e.currentTarget.open);
              }}
              className="min-w-0 rounded-[6px] border border-line bg-card"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-paper-2 px-4 py-2.5 sm:px-5">
                <h3 className="label text-ink">{CATEGORY_LABELS[category] ?? category}</h3>
                <span className="font-mono text-xs text-ink-3">{items.length}</span>
              </summary>
              <ul>
                {items.map((r) => (
                  <li key={r.id} className="border-t border-line px-4 py-3 text-sm sm:px-5">
                    <p className="leading-relaxed">{r.text}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {!onlyMandatory ? (
                        <Badge tone={r.mandatory ? "red" : "slate"}>
                          {r.mandatory ? "Mandatory" : "Optional"}
                        </Badge>
                      ) : null}
                      <EvidenceLink evidence={r.evidence} label={r.text} />
                    </div>
                    <Caution evidence={r.evidence} />
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      )}
    </Section>
  );
}
