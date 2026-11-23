import * as chrono from "chrono-node";
import type { DeadlineStatus } from "./types";
import { normalize } from "./verify";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toIso(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Every calendar date chrono can read from a piece of text, as ISO strings. */
export function datesIn(text: string): string[] {
  const out: string[] = [];
  for (const r of chrono.en.parse(text, new Date(2000, 0, 1), { forwardDate: false })) {
    const y = r.start.get("year");
    const m = r.start.get("month");
    const d = r.start.get("day");
    // Only explicit calendar dates that spell out the year. This skips relative
    // phrases ("within 10 days from award", "next Friday") and yearless dates.
    if (
      y &&
      m &&
      d &&
      /\b(19|20)\d{2}\b/.test(r.text) &&
      r.start.isCertain("month") &&
      r.start.isCertain("day")
    ) {
      out.push(toIso(y, m, d));
    }
  }
  return out;
}

export interface DateCheck {
  iso: string; // final ISO date or ""
  note?: string;
}

/**
 * Decide the final calendar date for a deadline. The date text and quote come
 * straight from the PDF, so they outrank the model's own ISO conversion.
 */
export function resolveDate(dateText: string, modelIso: string, quote: string): DateCheck {
  const fromText = datesIn(dateText);
  const fromQuote = datesIn(quote);
  const claimed = ISO.test(modelIso) ? modelIso : "";

  if (fromText.length > 0) {
    const iso = fromText[0];
    if (claimed && claimed !== iso) {
      return { iso, note: `Model read ${claimed}; corrected to the date as written` };
    }
    return { iso };
  }
  if (claimed && fromQuote.includes(claimed)) return { iso: claimed };
  if (claimed && fromQuote.length > 0) {
    return {
      iso: fromQuote[0],
      note: `Model read ${claimed}; corrected to the date found in the quote`,
    };
  }
  if (claimed) {
    // Could not confirm the date in the quote at all: keep it but say so.
    return { iso: claimed, note: "Date could not be confirmed in the quoted text" };
  }
  return { iso: "" };
}

export function dateTextInQuote(dateText: string, quote: string): boolean {
  const d = normalize(dateText);
  return d.length > 0 && normalize(quote).includes(d);
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function statusFor(iso: string, now: Date): { status: DeadlineStatus; days: number | null } {
  if (!ISO.test(iso)) return { status: "undated", days: null };
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(y, m - 1, d).getTime();
  const days = Math.round((target - startOfDay(now)) / 86_400_000);
  return { status: days < 0 ? "expired" : days === 0 ? "today" : "upcoming", days };
}

export function formatDate(iso: string): string {
  if (!ISO.test(iso)) return iso;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
