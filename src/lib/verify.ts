import type { Evidence } from "./types";

/**
 * Evidence checking. The model is asked to quote the document verbatim and
 * name the page. Everything here is plain code: it never trusts the model's
 * claim, it looks for the quote in the extracted text of the PDF.
 */

export function normalize(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(text: string): string[] {
  const n = normalize(text);
  return n ? n.split(" ") : [];
}

export interface PageIndex {
  /** Normalized text per page, index 0 = page 1. */
  normalized: string[];
  tokens: string[][];
}

export function buildPageIndex(pages: string[]): PageIndex {
  return {
    normalized: pages.map(normalize),
    tokens: pages.map(tokens),
  };
}

const CLOSE_THRESHOLD = 0.9;

/** Best fraction of quote tokens found, in order, inside a window of the page. */
function fuzzyScore(quoteTokens: string[], pageTokens: string[]): number {
  if (quoteTokens.length < 4 || pageTokens.length === 0) return 0;
  const win = quoteTokens.length + Math.ceil(quoteTokens.length * 0.25);
  const quoteBag = new Map<string, number>();
  for (const t of quoteTokens) quoteBag.set(t, (quoteBag.get(t) ?? 0) + 1);

  let best = 0;
  const step = Math.max(1, Math.floor(quoteTokens.length / 6));
  for (let start = 0; start < pageTokens.length; start += step) {
    const bag = new Map(quoteBag);
    let hit = 0;
    const end = Math.min(pageTokens.length, start + win);
    for (let i = start; i < end; i++) {
      const left = bag.get(pageTokens[i]);
      if (left) {
        bag.set(pageTokens[i], left - 1);
        hit++;
      }
    }
    best = Math.max(best, hit / quoteTokens.length);
    if (best === 1) break;
  }
  return best;
}

/** Page numbers to try, nearest to the claimed page first. */
function searchOrder(claimed: number, pageCount: number): number[] {
  const order: number[] = [];
  const first = claimed >= 1 && claimed <= pageCount ? claimed : 1;
  for (let d = 0; d < pageCount; d++) {
    for (const p of d === 0 ? [first] : [first - d, first + d]) {
      if (p >= 1 && p <= pageCount && !order.includes(p)) order.push(p);
    }
  }
  return order;
}

export function checkQuote(index: PageIndex, claimedPage: number, quote: string): Evidence {
  const cleanQuote = quote.replace(/\s+/g, " ").trim();
  const q = normalize(cleanQuote);
  const none: Evidence = { page: claimedPage, quote: cleanQuote, verified: false, match: "none" };
  if (q.length < 6) return none;

  const pageCount = index.normalized.length;
  const order = searchOrder(claimedPage, pageCount);

  // 1) exact (after normalisation): claimed page first, then everywhere else.
  for (const page of order) {
    if (index.normalized[page - 1].includes(q)) {
      return {
        page,
        quote: cleanQuote,
        verified: true,
        match: "exact",
        ...(page !== claimedPage ? { corrected_from_page: claimedPage } : {}),
      };
    }
  }

  // 2) quote may span a page break: look at joined neighbouring pages.
  for (let p = 1; p < pageCount; p++) {
    const joined = `${index.normalized[p - 1]} ${index.normalized[p]}`;
    if (joined.includes(q)) {
      return {
        page: p,
        quote: cleanQuote,
        verified: true,
        match: "exact",
        ...(p !== claimedPage ? { corrected_from_page: claimedPage } : {}),
      };
    }
  }

  // 3) close match (extraction noise, dropped hyphens, one swapped word).
  const qt = q.split(" ");
  let bestPage = 0;
  let bestScore = 0;
  for (const page of order) {
    const score = fuzzyScore(qt, index.tokens[page - 1]);
    if (score > bestScore) {
      bestScore = score;
      bestPage = page;
    }
    if (score === 1) break;
  }
  if (bestScore >= CLOSE_THRESHOLD) {
    return {
      page: bestPage,
      quote: cleanQuote,
      verified: true,
      match: "close",
      ...(bestPage !== claimedPage ? { corrected_from_page: claimedPage } : {}),
    };
  }
  return none;
}
