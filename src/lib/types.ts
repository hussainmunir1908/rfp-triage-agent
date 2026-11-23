import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Shapes the extraction model must return (validated with zod).       */
/* ------------------------------------------------------------------ */

const NOT_STATED = "Not stated";

const factSchema = z.object({
  value: z.string().describe(`The value, or "${NOT_STATED}"`),
  page: z.number().int().describe("Page number the value comes from, 0 if not stated"),
  quote: z.string().describe("Verbatim excerpt from that page, empty if not stated"),
});

export const deadlineKinds = [
  "proposal_due",
  "questions_due",
  "site_visit",
  "pre_proposal_conference",
  "award",
  "start_date",
  "end_date",
  "other",
] as const;

export const requirementCategories = [
  "certification",
  "set_aside",
  "security_clearance",
  "past_performance",
  "staffing",
  "technical_skill",
  "insurance_bonding",
  "location",
  "other",
] as const;

export const workCategories = [
  "software_development",
  "it_services",
  "data_or_ai",
  "compliance_or_audit",
  "construction_or_facilities",
  "manufacturing_or_supplies",
  "professional_non_it",
  "other",
] as const;

const deadlineItemSchema = z.object({
  what: z.string().describe("Short label, e.g. 'Proposal due'"),
  kind: z.enum(deadlineKinds),
  date_text: z.string().describe("The date exactly as written in the document"),
  date_iso: z
    .string()
    .describe("YYYY-MM-DD if the document gives a calendar date, otherwise an empty string"),
  time_text: z.string().describe("Time and timezone as written, or empty"),
  page: z.number().int(),
  quote: z.string().describe("Verbatim excerpt containing the date"),
});

const requirementItemSchema = z.object({
  category: z.enum(requirementCategories),
  text: z.string().describe("The requirement in one clear sentence"),
  mandatory: z.boolean().describe("true if the document says must / shall / required"),
  page: z.number().int(),
  quote: z.string().describe("Verbatim excerpt stating the requirement"),
});

const ambiguityItemSchema = z.object({
  issue: z.string().describe("What is unclear, conflicting or open to two readings"),
  page: z.number().int(),
  quote: z.string(),
});

export const extractionSchema = z.object({
  summary: z
    .string()
    .describe("Plain-English summary of what the client wants, 3 to 5 sentences, using only the document"),
  facts: z.object({
    agency: factSchema,
    title: factSchema,
    solicitation_number: factSchema,
    scope_of_work: factSchema,
    contract_type: factSchema,
    contract_value: factSchema,
    place_of_performance: factSchema,
    submission_method: factSchema,
  }),
  deadlines: z.array(deadlineItemSchema),
  requirements: z.array(requirementItemSchema),
  ambiguities: z.array(ambiguityItemSchema),
  work_category: z.enum(workCategories).describe("Best description of the work being procured"),
});

export type Extraction = z.infer<typeof extractionSchema>;

/* The judging step reasons over already-verified items by id. */
export const judgementSchema = z.object({
  factors: z
    .array(
      z.object({
        name: z.string().describe("Short factor name, e.g. 'Technical match'"),
        impact: z
          .number()
          .int()
          .describe("Effect on the fit score, from -3 (very negative) to +3 (very positive)"),
        reason: z.string().describe("One line explaining why this factor moved the score"),
        evidence_ids: z.array(z.string()).describe("Ids of supporting items, may be empty"),
      }),
    )
    .describe("Every factor that moved the score"),
  deal_breakers: z.array(
    z.object({
      text: z.string(),
      evidence_ids: z.array(z.string()),
    }),
  ),
  reasons: z
    .array(
      z.object({
        text: z.string(),
        evidence_ids: z.array(z.string()),
      }),
    )
    .describe("The three strongest reasons for the recommendation"),
  would_change_mind: z.array(z.string()).describe("Concrete facts that would flip the recommendation"),
  open_questions: z.array(z.string()).describe("Questions to ask the agency"),
  recommendation_summary: z.string().describe("Two sentences on the call and why"),
});

export type Judgement = z.infer<typeof judgementSchema>;

/* ------------------------------------------------------------------ */
/* The final report returned by the API and shown in the UI.           */
/* ------------------------------------------------------------------ */

export type MatchKind = "exact" | "close" | "none";

export interface Evidence {
  page: number;
  quote: string;
  verified: boolean;
  match: MatchKind;
  /** Set when the model cited the wrong page and the quote was found elsewhere. */
  corrected_from_page?: number;
}

export type DeadlineStatus = "expired" | "today" | "upcoming" | "undated";

export interface ReportDeadline {
  id: string;
  what: string;
  kind: (typeof deadlineKinds)[number];
  date: string; // ISO date, or "Not stated"
  date_text: string;
  time_text: string;
  status: DeadlineStatus;
  days_from_analysis: number | null;
  evidence: Evidence;
  note?: string; // e.g. date corrected by the checker
}

export interface ReportRequirement {
  id: string;
  category: (typeof requirementCategories)[number];
  text: string;
  mandatory: boolean;
  evidence: Evidence;
}

export interface ReportFact {
  id: string;
  label: string;
  value: string;
  evidence: Evidence | null;
}

export interface ReportAmbiguity {
  id: string;
  issue: string;
  evidence: Evidence;
}

export interface EvidenceRef {
  id: string;
  label: string;
}

export interface ReportFactor {
  name: string;
  impact: number;
  reason: string;
  refs: EvidenceRef[];
}

export interface ReportReason {
  text: string;
  refs: EvidenceRef[];
}

export interface VerificationStats {
  total: number;
  verified: number;
  exact: number;
  close: number;
  unverified: number;
  dates_corrected: number;
}

export interface TriageReport {
  file_name: string;
  analyzed_at: string;
  model: string;
  page_count: number;
  decision: "BID" | "NO_BID";
  fit_score: number;
  fast_no_bid: boolean;
  summary: string;
  facts: ReportFact[];
  deadlines: ReportDeadline[];
  requirements: ReportRequirement[];
  reasons: ReportReason[];
  factors: ReportFactor[];
  deal_breakers: ReportReason[];
  would_change_mind: string[];
  open_questions: string[];
  ambiguities: ReportAmbiguity[];
  recommendation_summary: string;
  work_category: string;
  verification: VerificationStats;
  /** True when every proposal-deadline found in the document is already in the past. */
  expired: boolean;
  /** True when this exact document was analysed before and no new model call was made. */
  cached?: boolean;
}

export type StreamEvent =
  | { type: "stage"; stage: string; message: string }
  | { type: "result"; report: TriageReport }
  | { type: "error"; message: string };

export { NOT_STATED };
