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
  "issued",
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
  "functional",
  "security_compliance",
  "performance_sla",
  "submission",
  "contract_terms",
  "other",
] as const;

const CATEGORY_GUIDE = `Pick the closest one:
certification = licences, registrations and audit reports a firm must hold (SOC 2, ISO, state registration, UBI);
set_aside = eligibility status or size limits (small business, 8(a), subcontracting share limits);
security_clearance = ONLY government or facility clearances;
past_performance = years in business, similar projects, references;
staffing = named roles, key personnel, headcount, onsite attendance;
technical_skill = required skills, tools, platforms, standards the team must work with;
insurance_bonding = insurance and bonding;
location = where work or data must be, onsite or residency rules;
functional = what the solution must do or deliver (features, integrations, migrations, deliverables);
security_compliance = encryption, hosting, accessibility, authentication, data protection, AI-use rules;
performance_sla = uptime, response times, acceptance thresholds, service levels;
submission = how to respond: format, page limits, forms, attachments, communication rules;
contract_terms = payment, liability, indemnity, term, termination, validity period, ownership;
other = anything else.`;

const WORK_CATEGORY_GUIDE = `Choose by what the buyer receives, not by the paperwork around it.
software_development = custom software, apps, platforms, integrations, automation;
it_services = IT operations, hosting, networking, help desk, managed IT, hardware support;
data_or_ai = analytics, data engineering, machine learning, AI tools;
compliance_or_audit = compliance, audit or assessment work;
construction_or_facilities = building construction or repair, janitorial and custodial cleaning, grounds, maintenance, security guards, any work done by crews on site;
manufacturing_or_supplies = buying physical goods, equipment, vehicles or supplies;
professional_non_it = consulting, legal, training, research or communications not about software;
other = anything else.`;

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
  superseded: z
    .boolean()
    .describe(
      "true if the document itself says this date was replaced, moved or extended (struck through, " +
        "'revised by addendum', 'extended from X to Y'). The replacement date is a separate item with false.",
    ),
  page: z.number().int(),
  quote: z.string().describe("Verbatim excerpt containing the date"),
});

const requirementItemSchema = z.object({
  category: z.enum(requirementCategories).describe(CATEGORY_GUIDE),
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

/**
 * Numbers the document claims about itself ("about 72% of annual volume", "Total 14,000"). The model only
 * copies the numbers; code does the arithmetic, so a mismatch is found without trusting model maths.
 */
const figureCheckSchema = z.object({
  claim: z.string().describe("What the document claims, in a few words"),
  claim_quote: z.string().describe("Verbatim excerpt stating the claimed total or percentage"),
  claim_page: z.number().int(),
  claimed_total: z
    .number()
    .nullable()
    .describe("The stated total the parts should add up to, or null if the claim is a percentage"),
  claimed_percent: z.number().nullable().describe("The stated percentage, or null"),
  whole: z
    .number()
    .nullable()
    .describe("The number the percentage is taken of (for example the overall total), or null"),
  parts: z.array(z.number()).describe("The listed values, copied exactly from the table or list"),
  parts_page: z.number().int().describe("Page where the listed values are"),
});

export type FigureCheck = z.infer<typeof figureCheckSchema>;

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
  figure_checks: z.array(figureCheckSchema),
  work_category: z.enum(workCategories).describe(WORK_CATEGORY_GUIDE),
});

export type Extraction = z.infer<typeof extractionSchema>;

/**
 * Second pass over obligation sentences the first pass did not cover. Each statement is
 * a verbatim span chosen by code, so the model only classifies it and cannot invent a quote.
 */
export const statementReviewSchema = z.object({
  id: z.number().int().describe("The id of the statement"),
  is_requirement: z
    .boolean()
    .describe("false for definitions, headings, instructions to the agency and boilerplate"),
  category: z.enum(requirementCategories).describe(CATEGORY_GUIDE),
  text: z.string().describe("The requirement in one clear sentence, empty if not a requirement"),
  mandatory: z.boolean().describe("true if the statement says must / shall / required / [M]"),
});

export type StatementReview = z.infer<typeof statementReviewSchema>;

export const checkStatuses = ["met", "unknown", "at_risk", "blocked"] as const;
export type CheckStatus = (typeof checkStatuses)[number];

/*
 * The judging step reasons over already-verified items by id. It also classifies the statements the
 * first pass did not quote, which saves a model call. That list comes first so the model settles what
 * counts as a requirement before it judges them.
 */
export const judgementSchema = z.object({
  statement_reviews: z
    .array(statementReviewSchema)
    .describe(
      "One entry for every statement id given under 'Statements to review'; empty if none were given",
    ),
  qualification_checks: z
    .array(
      z.object({
        requirement_id: z
          .string()
          .describe(
            "Id of the mandatory eligibility requirement, like r4, or of a reviewed statement, like s12",
          ),
        status: z
          .enum(checkStatuses)
          .describe(
            "met = the company profile clearly satisfies it; unknown = the profile does not say, must be " +
              "confirmed; at_risk = hard or costly for a small studio but possible; blocked = the profile " +
              "clearly cannot meet it",
          ),
        note: z.string().describe("One line: what the profile says or lacks, and what to confirm"),
      }),
    )
    .describe("One entry for every mandatory eligibility or qualification requirement"),
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
  /** Set when a figure in the item is not backed by the quote (the quote exists, but may not prove the claim). */
  caution?: string;
}

export type DeadlineStatus = "expired" | "today" | "upcoming" | "undated" | "superseded" | "passed";

export interface ReportDeadline {
  id: string;
  what: string;
  kind: (typeof deadlineKinds)[number];
  date: string; // ISO date, or "Not stated"
  date_text: string;
  time_text: string;
  /** The document replaced this date with a later one (for example by addendum). */
  superseded: boolean;
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
  /** "sweep" when the first pass missed it and the coverage check added it. */
  source?: "sweep";
}

export interface ReportQualification {
  requirement_id: string;
  requirement: string;
  status: CheckStatus;
  note: string;
  evidence: Evidence | null;
}

export interface CoverageStats {
  /** Obligation statements (must / shall / required / [M] / numbered requirements) found in the text. */
  statements: number;
  /** Already covered by an item from the first pass. */
  matched: number;
  /** Added as requirements by the coverage check. */
  added: number;
  /** Reviewed and set aside (definitions, headings, boilerplate). */
  set_aside: number;
  /** Not reviewed, because the check failed or the document has more than the limit. */
  unreviewed: number;
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
  /** "figures" when code found numbers in the document that do not add up. */
  source?: "figures";
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
  qualification_checks: ReportQualification[];
  reasons: ReportReason[];
  factors: ReportFactor[];
  deal_breakers: ReportReason[];
  would_change_mind: string[];
  open_questions: string[];
  ambiguities: ReportAmbiguity[];
  recommendation_summary: string;
  work_category: string;
  verification: VerificationStats;
  coverage: CoverageStats;
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
