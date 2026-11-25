/**
 * Pixel art as text. Each character is one pixel and maps to a colour in PALETTE; "." is empty.
 * Everything drawn in the interface comes from these grids, so the whole page shares one pixel size.
 */

export const PALETTE: Record<string, string> = {
  k: "#0f1f2e", // ink
  w: "#ffffff",
  // accent
  y: "#ffd23f",
  Y: "#d99c00",
  // mint and coral
  m: "#55e0b2",
  M: "#2fae86",
  c: "#ff7b6b",
  C: "#d4503f",
  p: "#ff9bb0",
  // robot
  h: "#9db3c4",
  H: "#5f7a8f",
  // owl
  a: "#c98f5a",
  A: "#8f5f36",
  f: "#f6dfb8",
  // ghost
  s: "#b9c2e0",
  // lens glass and wood
  d: "#c9e3f5",
  b: "#6fa8d6",
  t: "#7a5340",
  T: "#573a2d",
  // paper props
  q: "#eff2ec",
  x: "#c3cbbd",
  z: "#8b97a0",
  // night city
  l: "#fff2c4", // moon
  L: "#e2cd86",
  n: "#1a3350", // wall
  N: "#102640", // wall in shade
  g: "#2b4a6b", // unlit window
  "1": "#162538", // asphalt
  "2": "#1e3249",
};

export type Art = readonly string[];

/* The bidlings, 12 wide ------------------------------------------------ */

/** Scribe reads the document. */
export const ROBOT: Art = [
  "......y.....",
  "......H.....",
  ".hhhhhhhhhh.",
  "hhhhhhhhhhhh",
  "hkkkkkkkkkkh",
  "hkmmkkkkmmkh",
  "hkmmkkkkmmkh",
  "hkkkkkkkkkkh",
  "hhhhhhhhhhhh",
  "hhHkHkHkHkHh",
  ".hhhhhhhhhh.",
  "..HH....HH..",
];

/** Hoot checks every quote against the page. */
export const OWL: Art = [
  "a..........a",
  "aa........aa",
  "aAaaaaaaaaAa",
  "aaaaaaaaaaaa",
  "afffaaaafffa",
  "affkfaaffkfa",
  "afffaaaafffa",
  "aaaaayyaaaaa",
  "aAaaaYYaaaAa",
  ".aaffffffaa.",
  "..yy....yy..",
];

/** Boo makes the call. A no-bid is a ghosting. */
export const GHOST: Art = [
  "....wwww....",
  "..wwwwwwww..",
  ".wwwwwwwwww.",
  "swwwwwwwwwws",
  "swkkwwwwkkws",
  "swkkwwwwkkws",
  "swwwwwwwwwws",
  "swppwwwwppws",
  "swwwwkkwwwws",
  "swwwwwwwwwws",
  "swwwwwwwwwws",
  "ww.ww..ww.ww",
];

/* Small props -------------------------------------------------------- */

export const PAGE: Art = [
  "kkkkkk..",
  "kqqqqkk.",
  "kqxxqkkk",
  "kqqqqqqk",
  "kqxxxxqk",
  "kqqqqqqk",
  "kqxxxqqk",
  "kqqqqqqk",
  "kkkkkkkk",
];

export const BOOK_OPEN: Art = [
  ".kkkkk.kkkkk.",
  "kqqqqqkqqqqqk",
  "kqxxxqkqxxxqk",
  "kqqqqqkqqqqqk",
  "kqxxxqkqxxxqk",
  "kqqqqqkqqqqqk",
  ".kkkkkkkkkkk.",
];

export const BOOK_SHUT: Art = [
  ".kkkkkkkkkk.",
  "kqqqqqqqqqqk",
  "kkkkkkkkkkkk",
  "kyyyyyyyyyyk",
  "kkkkkkkkkkkk",
];

export const LENS: Art = [
  "..kkkk..",
  ".kwwddk.",
  "kwwdddbk",
  "kwdddbbk",
  "kdddbbbk",
  ".kdbbbk.",
  "..kkkkk.",
  ".....kYk",
  "......kYk",
  ".......kk",
];

export const GAVEL: Art = [
  "kkkkkkk.",
  "kttttTk.",
  "kttttTk.",
  "kkkkkkk.",
  "..kTk...",
  "..kTk...",
  "..kTk...",
  "..kkk...",
];

export const BLOCK: Art = ["kkkkkkkk", "kttttttk", "kttttTTk", "kTTTTTTk", "kkkkkkkk"];

export const TICK: Art = ["......mm", ".....mmm", "mm..mmm.", "mmmmmmm.", ".mmmmm..", "..mmm..."];

export const STAR: Art = ["..y..", "..y..", "yyyyy", "..y..", "..y.."];

/** A milestone flag for the timeline. */
export const FLAG: Art = ["kyyyy.", "kyyyyy", "kyyyy.", "k.....", "k.....", "k.....", "k.....", "k....."];

/** A missed date. */
export const CROSS: Art = ["c.....c", ".c...c.", "..c.c..", "...c...", "..c.c..", ".c...c.", "c.....c"];

export const ZZZ: Art = ["zzzz.....", "...z.zzz.", "..z....z.", ".z....z..", "zzzz.zzz."];

/* Night city --------------------------------------------------------- */

/** A filled disc with a few craters. */
function disc(r: number): Art {
  const size = r * 2 + 1;
  const craters = new Set([`${r + 1},${r - 1}`, `${r + 2},${r}`, `${r - 2},${r + 2}`]);
  return Array.from({ length: size }, (_, y) =>
    Array.from({ length: size }, (_, x) => {
      const inside = (x - r) ** 2 + (y - r) ** 2 <= r * r + 1;
      if (!inside) return ".";
      return craters.has(`${x},${y}`) ? "L" : "l";
    }).join(""),
  );
}

export const MOON: Art = disc(5);

/** The records hall: a dome, a flag and a row of columns. */
export const HALL: Art = [
  "........zcc......",
  "........zcc......",
  "........z........",
  ".......hhh.......",
  "......hhhhh......",
  ".....hhhhhhh.....",
  "....xxxxxxxxx....",
  "..xxxxxxxxxxxxx..",
  "..xnxnxnxnxnxnx..",
  "..xnxnxnxnxnxnx..",
  "..xnxnxnxnxnxnx..",
  "..xnxnxnxnxnxnx..",
  "..xxxxxxxxxxxxx..",
  ".xxxxxxxxxxxxxxx.",
  "xxxxxxxxxxxxxxxxx",
];

/** A street lamp. */
export const LAMP: Art = [".yyy.", ".yyy.", "..z..", "..z..", "..z..", "..z..", "..z..", "..z..", ".zzz."];

/** Rows of a flat-roofed block, with some windows lit. Deterministic, so server and client agree. */
function block(width: number, height: number, seed: number): string[] {
  return Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => {
      if (y === 0) return x === 0 || x === width - 1 ? "." : "N";
      const window = x % 2 === 1 && y % 2 === 0 && x < width - 1 && y > 1 && y < height - 1;
      if (window) return (x * 7 + y * 13 + seed) % 5 === 0 ? "y" : "g";
      return x === width - 1 ? "N" : "n";
    }).join(""),
  );
}

/** One repeating strip of skyline, 48 wide. */
function skyline(): Art {
  const W = 48;
  const H = 24;
  const rows = Array.from({ length: H }, () => Array<string>(W).fill("."));
  const buildings: [number, number, number][] = [
    [0, 7, 14],
    [7, 9, 20],
    [16, 6, 11],
    [22, 8, 17],
    [30, 7, 23],
    [37, 6, 13],
    [43, 5, 18],
  ];
  buildings.forEach(([x0, w, h], i) => {
    block(w, h, i * 3 + 1).forEach((line, dy) => {
      [...line].forEach((ch, dx) => {
        if (ch !== ".") rows[H - h + dy][x0 + dx] = ch;
      });
    });
  });
  return rows.map((r) => r.join(""));
}

export const SKYLINE: Art = skyline();

/** One repeating tile of street: a curb, asphalt and a dashed lane line. 16 wide. */
export const STREET_TILE: Art = [
  "hhhhhhhhhhhhhhhh",
  "HHHHHHHHHHHHHHHH",
  "1111111111111111",
  "1211111111111211",
  "1111111111111111",
  "yyyy1111yyyy1111",
  "1111111111111111",
  "kkkkkkkkkkkkkkkk",
];
