/**
 * Risk clause radar. Plain code, no model: it reads the page text sentence by sentence and picks out the
 * clauses that cost a small studio money or freedom (liability, indemnity, credits and penalties, payment
 * terms, bonds, insurance, onsite work, breach costs, IP ownership, termination, always-on service levels).
 *
 * Every finding is a verbatim sentence from a page, so it is checked and shown like any other evidence. The
 * rules look for wording, not meaning: a clause phrased differently is not found, and the report says so.
 */

export type RiskSeverity = "high" | "medium" | "info";

export interface RiskFinding {
  rule: string;
  title: string;
  severity: RiskSeverity;
  /** Why this clause matters, in plain words. */
  why: string;
  page: number;
  quote: string;
}

interface Hit {
  title: string;
  severity: RiskSeverity;
  why: string;
}

interface Rule {
  id: string;
  /** The words that make the sentence a hit. The quote is cut around them when the sentence is long. */
  anchor: RegExp;
  /** Returns a finding when the sentence is this kind of clause. */
  test: (s: string) => Hit | null;
}

/** Signature blocks and fill-in forms contain risk words without being terms of the contract. */
const FORM = /☐|_{4,}|\bsignature\b|\bnotary\b|\bnotariz|delinquent|\(print(?:ed)? name\)|\bsworn\b/i;

/** Lists of FAR clause titles ("52.249-2 Termination for Convenience ...") are citations, not terms. */
const CLAUSE_LIST = /\b(?:52|252|3052)\.\d{3}-\d+/g;

const WORDS: Record<string, number> = {
  ten: 10,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
  forty: 40,
  "forty-five": 45,
  sixty: 60,
  ninety: 90,
};

/** Percentages in a sentence, leaving out availability targets such as 99.5%, which are not amounts of money. */
function percents(s: string, below = 90): number[] {
  return [...s.matchAll(/(\d{1,3}(?:\.\d+)?)\s?%/g)].map((m) => Number(m[1])).filter((p) => p < below);
}

function days(s: string): number | null {
  const net = /\bnet\s*(\d{2,3})\b/i.exec(s);
  if (net) return Number(net[1]);
  const m =
    /within\s+([a-z]+(?:[- ][a-z]+)?)?\s*(?:\((\d{1,3})\)\s*)?(?:calendar |business )?days?\s+(?:of|after|from)\s+(?:the\s+)?(?:receipt|invoice|approval|acceptance|date of the invoice)/i.exec(
      s,
    );
  if (!m) return null;
  if (m[2]) return Number(m[2]);
  const word = (m[1] ?? "").toLowerCase().replace(" ", "-");
  return /^\d+$/.test(word) ? Number(word) : (WORDS[word] ?? null);
}

const OBLIGATION = /\b(?:must|shall|required|will|agrees? to|responsible for)\b/i;
const STRICT_OBLIGATION = /\b(?:must|shall|required)\b/i;

const BREACH_ANCHOR = /\b(?:data |security )?(?:breach|incident)\b/i;

function breachCosts(s: string): Hit | null {
  if (FORM.test(s) || !BREACH_ANCHOR.test(s)) return null;
  const cost = /reimburs\w*|\bbear\b|all costs|expenses?|notification costs?|credit monitoring/i.test(s);
  if (!cost || !/data|security|personal|protected|information|notif/i.test(s)) return null;
  return {
    title: "Security breach costs fall on the firm",
    severity: "high",
    why: "Notification, call centres and credit monitoring after a breach are paid by the firm, and rarely capped.",
  };
}

const RULES: Rule[] = [
  {
    id: "liability",
    anchor: /liabilit/i,
    test: (s) => {
      if (!/liabilit/i.test(s) || /insurance|coverage|policy/i.test(s)) return null;
      if (/\b(?:unlimited|uncapped|without (?:any )?limit|no (?:cap|limit))\b/i.test(s)) {
        return {
          title: "Unlimited liability",
          severity: "high",
          why: "Nothing caps what the firm could owe if something goes wrong.",
        };
      }
      if (
        /limit\w*/i.test(s) &&
        /\b(?:except|excluding|other than|does not apply|shall not apply)\b/i.test(s)
      ) {
        return {
          title: "Liability cap with exceptions",
          severity: "medium",
          why: "A cap exists, but some claims sit outside it, so the real exposure is larger than the cap.",
        };
      }
      if (/limited to|shall not exceed|not (?:to )?exceed/i.test(s)) {
        return {
          title: "Liability is capped",
          severity: "info",
          why: "A cap on what the firm can owe. Check the multiple against the contract value.",
        };
      }
      return null;
    },
  },
  {
    id: "indemnity",
    anchor: /indemnif|hold harmless/i,
    test: (s) => {
      if (!/indemnif|hold harmless/i.test(s)) return null;
      if (/\b(?:any and all|regardless of|including (?:the )?(?:negligence|fault))\b/i.test(s)) {
        return {
          title: "Broad indemnity",
          severity: "high",
          why: "The firm covers the agency's losses even where the agency may share the fault.",
        };
      }
      return {
        title: "Indemnity",
        severity: "medium",
        why: "The firm must cover the agency's losses from third-party claims. Often uncapped.",
      };
    },
  },
  {
    id: "damages",
    anchor: /liquidated damages|service credits?|\bpenalt(?:y|ies)\b|deduct\w*/i,
    test: (s) => {
      if (FORM.test(s) || breachCosts(s)) return null;
      if (!/liquidated damages|service credits?|\bpenalt(?:y|ies)\b|deduct\w* (?:from|for|of)/i.test(s)) {
        return null;
      }
      const top = Math.max(0, ...percents(s));
      return {
        title: /service credit/i.test(s)
          ? "Service credits"
          : /liquidated/i.test(s)
            ? "Liquidated damages"
            : "Penalties or deductions",
        severity: top >= 10 ? "high" : "medium",
        why:
          top >= 10
            ? `Money comes off the invoice when targets are missed, up to ${top}%. Check it against the margin.`
            : "Money comes off the invoice when targets or deadlines are missed.",
      };
    },
  },
  {
    id: "termination",
    anchor: /terminat/i,
    test: (s) => {
      if (FORM.test(s) || !/terminat/i.test(s)) return null;
      if (/for convenience|without cause|for any reason/i.test(s)) {
        return {
          title: "Agency can end it without cause",
          severity: "medium",
          why: "The contract can stop at the agency's choice, so the full contract value is not guaranteed.",
        };
      }
      const repeated = /twice|two|2|consecutive|repeated/i;
      const failure = /fail\w*|breach|default/i;
      if (repeated.test(s) && failure.test(s)) {
        return {
          title: "Termination after repeated failures",
          severity: "medium",
          why: "A short run of failed tests or missed targets lets the agency end the contract.",
        };
      }
      return null;
    },
  },
  {
    id: "ip",
    anchor: /work[- ]for[- ]hire|owned by|property of|belongs? to|vests? in|assign\w* to/i,
    test: (s) => {
      if (FORM.test(s)) return null;
      const work = /work[- ]for[- ]hire/i.test(s);
      const owner =
        /(?:owned by|property of|belongs? to|vests? in|assign\w* to)\s+(?:the\s+)?(?:city|county|state|agency|government|authority|district)/i;
      const code = /intellectual property|work product|deliverables?|source code|software|inventions?/i.test(
        s,
      );
      const data = /\bdata\b|documentation/i.test(s);
      if (work || (code && owner.test(s))) {
        return {
          title: "Agency may own what you build",
          severity: "medium",
          why: "A studio that reuses its own code and tools needs to check what stays its property.",
        };
      }
      if (data && owner.test(s)) {
        return {
          title: "Agency owns the data",
          severity: "info",
          why: "Normal for public work, but check that the platform itself is not included.",
        };
      }
      return null;
    },
  },
  {
    id: "payment",
    anchor: /\bnet\s*\d|within\s+[^.]{0,30}days|retain\w*|withh\w+/i,
    test: (s) => {
      if (FORM.test(s)) return null;
      const n = days(s);
      if (n !== null && /pa(?:y|id|yment)|invoice/i.test(s)) {
        return {
          title: `Paid in ${n} days`,
          severity: n >= 60 ? "high" : n >= 45 ? "medium" : "info",
          why:
            n >= 60
              ? "A long wait for cash after invoicing. Plan for working capital."
              : "How long the firm waits to be paid after invoicing.",
        };
      }
      if (/retain(?:age|ed)|withh\w+/i.test(s) && percents(s).length > 0 && /pay/i.test(s)) {
        return {
          title: "Part of each payment is held back",
          severity: "medium",
          why: "Retainage delays part of the money until the end of the project.",
        };
      }
      return null;
    },
  },
  {
    id: "insurance",
    anchor: /insurance|coverage|minimum limits/i,
    test: (s) => {
      if (FORM.test(s) || !/insurance|coverage|minimum limits/i.test(s)) return null;
      if (
        !/\$\s?\d[\d,.]*\s?(?:million|[MK]\b)?/.test(s) ||
        !/liabilit|insurance|workers|cyber|umbrella/i.test(s)
      ) {
        return null;
      }
      return {
        title: "Insurance minimums",
        severity: "medium",
        why: "The profile does not state coverage, so a studio may need new policies or higher limits.",
      };
    },
  },
  {
    id: "bonds",
    anchor: /\b(?:performance|bid|payment|fidelity|surety)\s+(?:bond|guarant(?:y|ee))/i,
    test: (s) => {
      if (
        FORM.test(s) ||
        !/\b(?:performance|bid|payment|fidelity|surety)\s+(?:bond|guarant(?:y|ee))/i.test(s)
      ) {
        return null;
      }
      return {
        title: "Bond or guaranty",
        severity: Math.max(0, ...percents(s, 101)) >= 50 ? "high" : "medium",
        why: "Bonds need a surety and cost money, which a small studio may not have in place.",
      };
    },
  },
  {
    id: "onsite",
    anchor: /on-?site|in[- ]person|physically present|on location/i,
    test: (s) => {
      if (FORM.test(s) || !/on-?site|in[- ]person|physically present|on location/i.test(s)) return null;
      if (!STRICT_OBLIGATION.test(s)) return null;
      if (/introduce|voice-?mail|customer service|ideally|remotely/i.test(s)) return null;
      if (!/work|perform|attend|located|reside|training|meetings?|kickoff|workshops?|supervisor/i.test(s))
        return null;
      const heavy =
        /full[- ]time|daily|each day|at all times|within \d+ miles|local (?:office|supervisor|presence)/i.test(
          s,
        );
      return {
        title: "Onsite presence required",
        severity: heavy ? "high" : "medium",
        why: heavy
          ? "Staff must be physically there on a regular basis, which is hard for a small remote team."
          : "Some work must be done in person, so travel or local staff may be needed.",
      };
    },
  },
  {
    id: "breach",
    anchor: BREACH_ANCHOR,
    test: breachCosts,
  },
  {
    id: "alwayson",
    anchor: /\b99\.\d+\s?%|24\s?\/\s?7|around[- ]the[- ]clock|24 hours a day/i,
    test: (s) => {
      if (FORM.test(s)) return null;
      if (!/\b99\.\d+\s?%|24\s?\/\s?7|around[- ]the[- ]clock|24 hours a day/i.test(s)) return null;
      if (!/support|hosting|uptime|monitoring|availability|service level|SLA|response/i.test(s)) return null;
      if (!OBLIGATION.test(s) && !/request\w*|guarantee\w*|offer|provide|minimum/i.test(s)) return null;
      return {
        title: "Always-on service levels",
        severity: "medium",
        why: "Round-the-clock support or strict uptime is costly for a small team to staff.",
      };
    },
  },
];

const ORDER: Record<RiskSeverity, number> = { high: 0, medium: 1, info: 2 };
const PER_RULE = 3;
const MAX_QUOTE = 320;
const LEAD = 120;

/** Splits flattened page text into sentences. Not perfect (abbreviations), and does not need to be. */
function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?;])\s+(?=[A-Z0-9(["“•])/)
    .filter((s) => s.length >= 25 && (s.match(CLAUSE_LIST) ?? []).length < 2);
}

/**
 * Keeps a long sentence short by cutting at word boundaries around the words that triggered the rule, so
 * the quote is still a verbatim part of the page and shows the clause itself.
 */
function excerpt(s: string, anchor: RegExp): string {
  if (s.length <= MAX_QUOTE) return s;
  const at = Math.max(0, s.search(anchor));
  let start = Math.max(0, at - LEAD);
  if (start > 0) {
    const space = s.indexOf(" ", start);
    start = space < 0 ? start : space + 1;
  }
  let end = Math.min(s.length, start + MAX_QUOTE);
  if (end < s.length) {
    const space = s.lastIndexOf(" ", end);
    end = space > start ? space : end;
  }
  return s.slice(start, end).trim();
}

export function scanRisks(pages: string[]): RiskFinding[] {
  const found: RiskFinding[] = [];
  for (const rule of RULES) {
    const seen = new Set<string>();
    let count = 0;
    pageLoop: for (let i = 0; i < pages.length; i++) {
      for (const s of sentences(pages[i])) {
        const hit = rule.test(s);
        if (!hit) continue;
        const quote = excerpt(s, rule.anchor);
        const key = quote.slice(0, 80).toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        found.push({ rule: rule.id, ...hit, page: i + 1, quote });
        if (++count >= PER_RULE) break pageLoop;
      }
    }
  }
  return found.sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || a.page - b.page);
}
