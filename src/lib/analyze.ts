import { generateJson } from "./gemini";
import { dateTextInQuote, resolveDate, statusFor } from "./dates";
import { EXTRACTION_SYSTEM, JUDGE_SYSTEM, extractionPrompt } from "./prompts";
import { buildPageIndex, checkQuote } from "./verify";
import {
  NOT_STATED,
  extractionSchema,
  judgementSchema,
  type Evidence,
  type EvidenceRef,
  type Extraction,
  type ReportAmbiguity,
  type ReportDeadline,
  type ReportFact,
  type ReportReason,
  type ReportRequirement,
  type TriageReport,
  type VerificationStats,
} from "./types";

export const MAX_PAGES = 300;
export const MAX_CHARS = 1_500_000;

type Progress = (stage: string, message: string) => void;

const FACT_LABELS: Record<keyof Extraction["facts"], string> = {
  agency: "Agency",
  title: "Title",
  solicitation_number: "Solicitation no.",
  scope_of_work: "Scope of work",
  contract_type: "Contract type",
  contract_value: "Contract value",
  place_of_performance: "Place of performance",
  submission_method: "How to submit",
};

export function pagesToPrompt(pages: string[]): string {
  return pages.map((text, i) => `=== PAGE ${i + 1} ===\n${text.trim()}`).join("\n\n");
}

const BASE_SCORE = 5;

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export async function analyzeRfp(args: {
  pages: string[];
  fileName: string;
  now?: Date;
  onProgress?: Progress;
}): Promise<TriageReport> {
  const { pages, fileName } = args;
  const now = args.now ?? new Date();
  const progress: Progress = args.onProgress ?? (() => {});

  const textLength = pages.reduce((n, p) => n + p.length, 0);
  if (pages.length === 0 || textLength < 200) {
    throw new Error(
      "No readable text found in this PDF. It may be a scanned document; only text-based PDFs are supported.",
    );
  }
  if (pages.length > MAX_PAGES || textLength > MAX_CHARS) {
    throw new Error(`Document is too large (limit ${MAX_PAGES} pages / ${MAX_CHARS} characters).`);
  }

  /* 1. Extract ---------------------------------------------------- */
  progress("extract", `Reading all ${pages.length} pages and extracting facts, dates and requirements...`);
  const extraction = await generateJson({
    system: EXTRACTION_SYSTEM,
    prompt: extractionPrompt(pagesToPrompt(pages), pages.length),
    schema: extractionSchema,
  });
  const ex = extraction.data;

  /* 2. Verify evidence in code ------------------------------------ */
  progress("verify", "Checking every quote and date against the document text...");
  const index = buildPageIndex(pages);
  const stats: VerificationStats = {
    total: 0,
    verified: 0,
    exact: 0,
    close: 0,
    unverified: 0,
    dates_corrected: 0,
  };
  const check = (page: number, quote: string): Evidence => {
    const ev = checkQuote(index, page, quote);
    stats.total++;
    if (ev.verified) {
      stats.verified++;
      if (ev.match === "exact") stats.exact++;
      else stats.close++;
    } else {
      stats.unverified++;
    }
    return ev;
  };

  const facts: ReportFact[] = [];
  const factIds: Record<string, string> = {};
  for (const key of Object.keys(FACT_LABELS) as (keyof Extraction["facts"])[]) {
    const f = ex.facts[key];
    const stated = f.value.trim() && f.value.trim().toLowerCase() !== NOT_STATED.toLowerCase();
    facts.push({
      id: `f_${key}`,
      label: FACT_LABELS[key],
      value: stated ? f.value.trim() : NOT_STATED,
      evidence: stated && f.quote.trim() ? check(f.page, f.quote) : null,
    });
    factIds[`f_${key}`] = FACT_LABELS[key];
  }

  const deadlines: ReportDeadline[] = ex.deadlines.map((d, i) => {
    const evidence = check(d.page, d.quote);
    const resolved = resolveDate(d.date_text, d.date_iso, d.quote);
    let note = resolved.note;
    if (resolved.note?.startsWith("Model read")) stats.dates_corrected++;
    if (!dateTextInQuote(d.date_text, d.quote) && !note) {
      note = "Date text was not found inside the quoted excerpt";
    }
    const { status, days } = statusFor(resolved.iso, now);
    return {
      id: `d${i + 1}`,
      what: d.what.trim(),
      kind: d.kind,
      date: resolved.iso || NOT_STATED,
      date_text: d.date_text.trim(),
      time_text: d.time_text.trim(),
      status,
      days_from_analysis: days,
      evidence,
      ...(note ? { note } : {}),
    };
  });

  const requirements: ReportRequirement[] = ex.requirements.map((r, i) => ({
    id: `r${i + 1}`,
    category: r.category,
    text: r.text.trim(),
    mandatory: r.mandatory,
    evidence: check(r.page, r.quote),
  }));

  const ambiguities: ReportAmbiguity[] = ex.ambiguities.map((a, i) => ({
    id: `a${i + 1}`,
    issue: a.issue.trim(),
    evidence: check(a.page, a.quote),
  }));

  /* 3. Judge ------------------------------------------------------ */
  progress("judge", "Scoring fit against the idiaz.io profile...");
  const judgeInput = {
    page_count: pages.length,
    work_category: ex.work_category,
    summary: ex.summary,
    facts: Object.fromEntries(
      Object.keys(FACT_LABELS).map((key) => {
        const f = facts.find((x) => x.label === FACT_LABELS[key as keyof Extraction["facts"]])!;
        return [`f_${key}`, f.value];
      }),
    ),
    deadlines: deadlines.map((d) => ({
      id: d.id,
      what: d.what,
      date: d.date,
      time: d.time_text,
      verified: d.evidence.verified,
    })),
    requirements: requirements.map((r) => ({
      id: r.id,
      category: r.category,
      mandatory: r.mandatory,
      text: r.text,
      verified: r.evidence.verified,
    })),
    ambiguities: ambiguities.map((a) => ({ id: a.id, issue: a.issue, verified: a.evidence.verified })),
  };

  const judged = await generateJson({
    system: JUDGE_SYSTEM,
    prompt: `Verified extraction:\n${JSON.stringify(judgeInput, null, 2)}`,
    schema: judgementSchema,
    maxOutputTokens: 8192,
  });
  const j = judged.data;

  const labelFor = (id: string): string | null => {
    if (factIds[id]) return factIds[id];
    const d = deadlines.find((x) => x.id === id);
    if (d) return d.what;
    const r = requirements.find((x) => x.id === id);
    if (r) return r.text.length > 60 ? `${r.text.slice(0, 57)}...` : r.text;
    const a = ambiguities.find((x) => x.id === id);
    if (a) return `Ambiguity: ${a.issue.length > 50 ? `${a.issue.slice(0, 47)}...` : a.issue}`;
    return null;
  };
  const refs = (ids: string[]): EvidenceRef[] =>
    [...new Set(ids)].flatMap((id) => {
      const label = labelFor(id);
      return label ? [{ id, label }] : [];
    });

  const factors = j.factors.map((f) => ({
    name: f.name,
    impact: clamp(Math.round(f.impact), -3, 3),
    reason: f.reason,
    refs: refs(f.evidence_ids),
  }));
  const dealBreakers: ReportReason[] = j.deal_breakers.map((d) => ({
    text: d.text,
    refs: refs(d.evidence_ids),
  }));

  /* Decision rules live in code so the call is consistent and explainable. */
  const raw = BASE_SCORE + factors.reduce((n, f) => n + f.impact, 0);
  let fitScore = clamp(Math.round(raw), 0, 10);
  const outOfDomain =
    ex.work_category === "construction_or_facilities" || ex.work_category === "manufacturing_or_supplies";
  if (dealBreakers.length > 0) fitScore = Math.min(fitScore, 3);
  if (outOfDomain) fitScore = Math.min(fitScore, 2);
  const decision: "BID" | "NO_BID" = dealBreakers.length > 0 || outOfDomain || fitScore < 6 ? "NO_BID" : "BID";

  const proposalDates = deadlines.filter((d) => d.kind === "proposal_due" && d.status !== "undated");
  const expired = proposalDates.length > 0 && proposalDates.every((d) => d.status === "expired");

  return {
    file_name: fileName,
    analyzed_at: now.toISOString(),
    model: judged.model === extraction.model ? extraction.model : `${extraction.model} / ${judged.model}`,
    page_count: pages.length,
    decision,
    fit_score: fitScore,
    fast_no_bid: outOfDomain,
    summary: ex.summary.trim(),
    facts,
    deadlines,
    requirements,
    reasons: j.reasons.slice(0, 3).map((r) => ({ text: r.text, refs: refs(r.evidence_ids) })),
    factors,
    deal_breakers: dealBreakers,
    would_change_mind: j.would_change_mind,
    open_questions: j.open_questions,
    ambiguities,
    recommendation_summary: j.recommendation_summary,
    work_category: ex.work_category,
    verification: stats,
    expired,
  };
}
