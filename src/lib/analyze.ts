import { createHash } from "node:crypto";
import { findUncovered, pickForReview } from "./coverage";
import { dateTextInQuote, deadlineStatus, markSuperseded, resolveDate } from "./dates";
import { checkFigureClaims, unsupportedFigures } from "./figures";
import { generateJson } from "./gemini";
import { EXTRACTION_SYSTEM, JUDGE_SYSTEM, extractionPrompt, judgePrompt } from "./prompts";
import { THIN_MIN_REQUIREMENTS, clamp, decide } from "./score";
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
  type ReportQualification,
  type ReportReason,
  type ReportRequirement,
  type TriageReport,
  type VerificationStats,
} from "./types";

export function documentKey(pages: string[]): string {
  const hash = createHash("sha256");
  for (const p of pages) hash.update(p).update("\u0000");
  return hash.digest("hex");
}

/**
 * The extraction is the expensive part. If the judging step fails, for example because the model is
 * briefly overloaded, a retry reuses it instead of spending the quota again.
 */
interface CachedExtraction {
  data: Extraction;
  model: string;
}
const extractionCache = new Map<string, CachedExtraction>();

/** The document itself cannot be analysed, as opposed to a failure on our side. */
export class InputError extends Error {}

export const MAX_PAGES = 300;
export const MAX_CHARS = 1_500_000;
/** Most uncovered statements handed to the judging call for review. */
export const MAX_SWEEP = 120;
/** The judging call also writes the statement reviews, so it gets more time than the default. */
const JUDGE_TIMEOUT_MS = 120_000;

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

export async function analyzeRfp(args: {
  pages: string[];
  fileName: string;
  now?: Date;
  onProgress?: Progress;
}): Promise<TriageReport> {
  const { pages, fileName } = args;
  const now = args.now ?? new Date();
  const progress: Progress = args.onProgress ?? (() => {});

  const t0 = Date.now();
  const textLength = pages.reduce((n, p) => n + p.length, 0);
  if (pages.length === 0 || textLength < 200) {
    throw new InputError(
      "No readable text found in this PDF. It may be a scanned document; only text-based PDFs are supported.",
    );
  }
  if (pages.length > MAX_PAGES || textLength > MAX_CHARS) {
    throw new InputError(`Document is too large (limit ${MAX_PAGES} pages / ${MAX_CHARS} characters).`);
  }

  const pagesText = pagesToPrompt(pages);

  /* 1. Extract ---------------------------------------------------- */
  const docKey = documentKey(pages);
  let extraction = extractionCache.get(docKey);
  if (!extraction) {
    progress("extract", `Reading all ${pages.length} pages and extracting facts, dates and requirements...`);
    extraction = await generateJson({
      system: EXTRACTION_SYSTEM,
      prompt: extractionPrompt(pagesText, pages.length),
      schema: extractionSchema,
    });
    extractionCache.set(docKey, extraction);
    if (extractionCache.size > 10) extractionCache.delete(extractionCache.keys().next().value as string);
  }
  const ex = extraction.data;
  const extractMs = Date.now() - t0;

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
  const withCaution = (ev: Evidence, text: string | undefined): Evidence => {
    // The quote may exist and still not contain the figures the item states.
    const missing = text ? unsupportedFigures(text, ev.quote) : [];
    return missing.length > 0 ? { ...ev, caution: `Not in the quoted text: ${missing.join(", ")}` } : ev;
  };
  const check = (page: number, quote: string, text?: string): Evidence => {
    const ev = checkQuote(index, page, quote);
    stats.total++;
    if (ev.verified) {
      stats.verified++;
      if (ev.match === "exact") stats.exact++;
      else stats.close++;
    } else {
      stats.unverified++;
    }
    return withCaution(ev, text);
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
      evidence: stated && f.quote.trim() ? check(f.page, f.quote, f.value) : null,
    });
    factIds[`f_${key}`] = FACT_LABELS[key];
  }

  const flagged = markSuperseded(ex.deadlines.map((d) => ({ ...d, superseded: d.superseded ?? false })));
  const deadlines: ReportDeadline[] = flagged.map((d, i) => {
    const evidence = check(d.page, d.quote);
    const resolved = resolveDate(d.date_text, d.date_iso, d.quote);
    let note = resolved.note;
    if (resolved.note?.startsWith("Model read")) stats.dates_corrected++;
    if (!dateTextInQuote(d.date_text, d.quote) && !note) {
      note = "Date text was not found inside the quoted excerpt";
    }
    const date = resolved.iso || NOT_STATED;
    const { status, days } = deadlineStatus({ date, kind: d.kind, superseded: d.superseded }, now);
    return {
      id: `d${i + 1}`,
      what: d.what.trim(),
      kind: d.kind,
      date,
      date_text: d.date_text.trim(),
      time_text: d.time_text.trim(),
      superseded: d.superseded,
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
    evidence: check(r.page, r.quote, r.text),
  }));

  const ambiguities: ReportAmbiguity[] = ex.ambiguities.map((a, i) => ({
    id: `a${i + 1}`,
    issue: a.issue.trim(),
    evidence: check(a.page, a.quote),
  }));

  /* 2b. Numbers that do not add up, found by code -------------------- */
  for (const issue of checkFigureClaims(ex.figure_checks ?? [], pages)) {
    ambiguities.push({
      id: `a${ambiguities.length + 1}`,
      issue: issue.issue,
      evidence: check(issue.page, issue.quote),
      source: "figures",
    });
  }

  /* 2c. Coverage: obligation sentences the first pass did not quote ---- */
  const cited = [
    ...facts.map((f) => f.evidence),
    ...deadlines.map((d) => d.evidence),
    ...requirements.map((r) => r.evidence),
    ...ambiguities.map((a) => a.evidence),
  ].filter((e): e is Evidence => e !== null && e.verified);
  const { statements, uncovered } = findUncovered(pages, cited);
  const batch = pickForReview(uncovered, MAX_SWEEP);

  /* 3. Judge, which also reviews the uncovered statements ------------- */
  progress(
    "judge",
    batch.length > 0
      ? `Scoring fit and reviewing ${batch.length} statements the first pass may have missed...`
      : "Scoring fit against the idiaz.io profile...",
  );
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
      superseded: d.superseded,
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
    prompt: judgePrompt(JSON.stringify(judgeInput, null, 2), batch),
    schema: judgementSchema,
    maxOutputTokens: 32768,
    timeoutMs: JUDGE_TIMEOUT_MS,
  });
  const j = judged.data;

  /* 3b. Statements the judge accepted become requirements -------------- */
  const wanted = new Map(batch.map((s) => [s.id, s]));
  const reviewedIds = new Set<number>();
  const statementAlias = new Map<string, string>(); // "s12" -> "r57"
  const known = new Set(requirements.map((r) => r.text.toLowerCase()));
  let added = 0;
  for (const item of j.statement_reviews) {
    const statement = wanted.get(item.id);
    if (!statement || reviewedIds.has(item.id)) continue;
    reviewedIds.add(item.id);
    const text = item.text.trim();
    if (!item.is_requirement || !text || known.has(text.toLowerCase())) continue;
    known.add(text.toLowerCase());
    const id = `r${requirements.length + 1}`;
    statementAlias.set(`s${item.id}`, id);
    // The quote is the statement itself, chosen by code, so it is found by construction.
    requirements.push({
      id,
      category: item.category,
      text,
      mandatory: item.mandatory,
      evidence: withCaution(checkQuote(index, statement.page, statement.text), text),
      source: "sweep",
    });
    added++;
  }
  const coverage = {
    statements: statements.length,
    matched: statements.length - uncovered.length,
    added,
    set_aside: Math.max(0, reviewedIds.size - added),
    unreviewed: uncovered.length - reviewedIds.size,
  };
  console.info(
    `[analyze] ${fileName}: extract ${extractMs}ms, total ${Date.now() - t0}ms, model ${judged.model}, ` +
      `coverage ${coverage.matched}/${coverage.statements} (+${coverage.added})`,
  );

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
  const resolveId = (id: string): string => statementAlias.get(id) ?? id;
  const refs = (ids: string[]): EvidenceRef[] =>
    [...new Set(ids.map(resolveId))].flatMap((id) => {
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

  const seen = new Set<string>();
  const qualificationChecks: ReportQualification[] = j.qualification_checks.flatMap((c) => {
    const req = requirements.find((r) => r.id === resolveId(c.requirement_id));
    if (!req || seen.has(req.id)) return [];
    seen.add(req.id);
    return [
      {
        requirement_id: req.id,
        requirement: req.text,
        status: c.status,
        note: c.note,
        evidence: req.evidence,
      },
    ];
  });

  const thin = requirements.length < THIN_MIN_REQUIREMENTS;
  const { fitScore, decision, fastNoBid } = decide({
    impacts: factors.map((f) => f.impact),
    dealBreakers: dealBreakers.length,
    workCategory: ex.work_category,
    checks: qualificationChecks.map((c) => c.status),
    thin,
  });

  const proposalDates = deadlines.filter(
    (d) => d.kind === "proposal_due" && d.status !== "undated" && d.status !== "superseded",
  );
  const expired = proposalDates.length > 0 && proposalDates.every((d) => d.status === "expired");

  return {
    file_name: fileName,
    analyzed_at: now.toISOString(),
    model: judged.model === extraction.model ? extraction.model : `${extraction.model} / ${judged.model}`,
    page_count: pages.length,
    decision,
    fit_score: fitScore,
    fast_no_bid: fastNoBid,
    thin_document: thin,
    summary: ex.summary.trim(),
    facts,
    deadlines,
    requirements,
    qualification_checks: qualificationChecks,
    reasons: j.reasons.slice(0, 3).map((r) => ({ text: r.text, refs: refs(r.evidence_ids) })),
    factors,
    deal_breakers: dealBreakers,
    would_change_mind: j.would_change_mind,
    open_questions: j.open_questions,
    ambiguities,
    recommendation_summary: j.recommendation_summary,
    work_category: ex.work_category,
    verification: stats,
    coverage,
    expired,
  };
}
