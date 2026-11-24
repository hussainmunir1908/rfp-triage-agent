/**
 * Turns the text items pdf.js reports for a page into one string. Some fonts draw ligatures such as
 * "fi" or "ff" as separate items, so joining items with a space everywhere produces "Paci fi c" and
 * "kicko ff". A space is only added where the items really have a gap between them.
 */

export interface TextItemLike {
  str: string;
  hasEOL?: boolean;
  transform?: number[];
  width?: number;
  height?: number;
}

function isTextItem(item: unknown): item is TextItemLike {
  return typeof item === "object" && item !== null && "str" in item;
}

/** A gap wider than this share of the font height counts as a word space. */
const WORD_GAP = 0.15;

export function joinTextItems(items: readonly unknown[]): string {
  let text = "";
  let prev: { end: number; y: number } | null = null;

  for (const item of items) {
    if (!isTextItem(item)) continue;
    const t = item.transform;

    if (t && item.str && prev) {
      const size = item.height || Math.hypot(t[2], t[3]) || 10;
      const sameLine = Math.abs(t[5] - prev.y) < size * 0.5;
      const gap = t[4] - prev.end;
      const needsSpace = sameLine ? gap > size * WORD_GAP : true;
      if (needsSpace && !/\s$/.test(text) && !/^\s/.test(item.str)) text += " ";
    }
    if (t && item.str) prev = { end: t[4] + (item.width ?? 0), y: t[5] };

    text += item.str;
    if (item.hasEOL) {
      text += "\n";
      prev = null;
    }
  }

  return text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
