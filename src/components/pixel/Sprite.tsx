import type { CSSProperties } from "react";
import { PALETTE, type Art } from "./art";

interface PathSet {
  width: number;
  height: number;
  paths: [string, string][];
}

const cache = new WeakMap<Art, PathSet>();

/** Rows of pixels to one SVG path per colour, merging runs so the markup stays small. */
function pathsFor(art: Art): PathSet {
  const hit = cache.get(art);
  if (hit) return hit;
  const width = Math.max(...art.map((r) => r.length));
  const byColour = new Map<string, string>();
  art.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === ".") {
        x++;
        continue;
      }
      let end = x;
      while (end < row.length && row[end] === ch) end++;
      byColour.set(ch, `${byColour.get(ch) ?? ""}M${x} ${y}h${end - x}v1h-${end - x}z`);
      x = end;
    }
  });
  const out = { width, height: art.length, paths: [...byColour] };
  cache.set(art, out);
  return out;
}

/**
 * Draws pixel art. The size of one pixel comes from the CSS variable --s (set per breakpoint), so
 * every sprite on the page is built on the same grid and stays crisp.
 */
export function Sprite({
  art,
  className = "",
  style,
  px = "var(--s)",
  recolor,
}: {
  art: Art;
  className?: string;
  style?: CSSProperties;
  /** Any CSS length for one pixel, for example "3px" or "calc(var(--s) * 2)". */
  px?: string;
  /** Swap palette entries, for example { k: "#cfcdc3" } to lighten outlines on a dark panel. */
  recolor?: Record<string, string>;
}) {
  const { width, height, paths } = pathsFor(art);
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      shapeRendering="crispEdges"
      aria-hidden
      focusable="false"
      className={`block shrink-0 ${className}`}
      style={{ width: `calc(${px} * ${width})`, height: `calc(${px} * ${height})`, ...style }}
    >
      {paths.map(([ch, d]) => (
        <path key={ch} d={d} fill={recolor?.[ch] ?? PALETTE[ch] ?? "#ff00ff"} />
      ))}
    </svg>
  );
}

/** A tile as a CSS background, for strips that repeat across any width. */
export function tileBackground(art: Art): string {
  const { width, height, paths } = pathsFor(art);
  const body = paths.map(([ch, d]) => `<path fill="${PALETTE[ch]}" d="${d}"/>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges">${body}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
