import type { CheckStatus, TriageReport } from "./types";

const STATUS_TEXT: Record<CheckStatus, string> = {
  met: "Met",
  unknown: "Confirm",
  at_risk: "At risk",
  blocked: "Blocked",
};

function cell(value: string | number | boolean): string {
  const text = String(value).replace(/\r?\n/g, " ");
  return /[",]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * A compliance matrix a bid team can open in a spreadsheet: one row per requirement with its page and
 * quote, our status where the profile was checked, and empty Owner and Notes columns to fill in.
 */
export function complianceMatrix(report: TriageReport): string {
  const status = new Map(report.qualification_checks.map((q) => [q.requirement_id, STATUS_TEXT[q.status]]));
  const header = [
    "ID",
    "Category",
    "Requirement",
    "Mandatory",
    "Page",
    "Quote found",
    "Our status",
    "Owner",
    "Notes",
  ];
  const rows = report.requirements.map((r) => [
    r.id,
    r.category,
    r.text,
    r.mandatory ? "Yes" : "No",
    r.evidence.page,
    r.evidence.verified ? "Yes" : "No",
    status.get(r.id) ?? "To review",
    "",
    "",
  ]);
  const csv = [header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n");
  // The byte order mark makes Excel read the file as UTF-8.
  return `\uFEFF${csv}\r\n`;
}
