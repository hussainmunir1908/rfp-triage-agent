/**
 * Pixel art as text. Each character is one pixel and maps to a colour in PALETTE; "." is empty.
 * Everything drawn in the interface comes from these grids, so the whole page shares one pixel size.
 */

export const PALETTE: Record<string, string> = {
  k: "#191922", // ink
  w: "#ffffff",
  // fox
  o: "#ff6a3d",
  O: "#d94a1e",
  c: "#ffe3c2",
  // frog
  g: "#46a06c",
  G: "#2f7a52",
  l: "#9ad8b3",
  // cat
  b: "#7488c4",
  B: "#4d5c96",
  d: "#c9d3f2",
  // shared warm tones
  y: "#ffc933",
  Y: "#f0a01c",
  p: "#f4a3b8",
  r: "#e5483c",
  // landscape
  s: "#e4e3db", // cloud shade
  t: "#7a5340", // trunk
  T: "#573a2d",
  n: "#3b8a66", // pine
  N: "#2c6b50",
  m: "#69b890",
  e: "#4a3b47", // soil
  E: "#6b5365",
  F: "#c9748f",
  u: "#2d2431",
  // paper props
  q: "#f6f5f1",
  x: "#cfcdc3",
  z: "#9b9a92",
};

export type Art = readonly string[];

/* Characters, 12 wide ------------------------------------------------ */

export const FROG: Art = [
  ".gwwg..gwwg.",
  ".gwkg..gkwg.",
  ".gggggggggg.",
  "gggggggggggg",
  "gpgggggggpgg",
  "gggkkkkkkggg",
  "gglllllllgg.",
  ".gllllllllg.",
  ".gggggggggg.",
  ".GG......GG.",
];

export const FOX: Art = [
  "oo........oo",
  "ooo......ooo",
  "oOoo....ooOo",
  "oooooooooooo",
  "oowkoooowkoo",
  "oowwoooowwoo",
  "oooooooooooo",
  "occoookoocco",
  ".occccccccc.",
  "..cccccccc..",
  "..oo....oo..",
];

export const CAT: Art = [
  "b..........b",
  "bb........bb",
  "bBbb....bbBb",
  "bbbbbbbbbbbb",
  "bbwkbbbbwkbb",
  "bbwwbbbbwwbb",
  "bbbbbppbbbbb",
  "dbbbbkkbbbbd",
  ".bbbbbbbbbb.",
  "..bbddddbb..",
  "..BB....BB..",
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
  "kooooooooook",
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

export const TICK: Art = ["......gg", ".....ggg", "gg..ggg.", "ggggggg.", ".ggggg..", "..ggg..."];

export const STAR: Art = ["..y..", "..y..", "yyyyy", "..y..", "..y.."];

export const BANG: Art = ["rr", "rr", "rr", "rr", "..", "rr"];

export const ZZZ: Art = ["zzzz.....", "...z.zzz.", "..z....z.", ".z....z..", "zzzz.zzz."];

/* Landscape --------------------------------------------------------- */

export const PINE: Art = [
  ".....n.....",
  "....nnn....",
  "....nNn....",
  "...nnnnn...",
  "..nnnnNNn..",
  "...nnnnnn..",
  "..nnnnnnNn.",
  ".nnnnnnnnNN",
  "..nnnnnnNn.",
  ".nnnmmnnnNN",
  "nnnnnnnnnnN",
  ".....tt....",
  ".....tT....",
  ".....tT....",
];

export const BUSH: Art = [
  "..nnnn..",
  ".nnmmnnN",
  "nnmnnnnN",
  "nnnnnnNN",
  "nnnnnNNN",
  ".NNNNNN.",
  "...tT...",
  "...tT...",
];

export const FLOWER: Art = ["..p..", ".pyp.", "..p..", "..g..", "..g..", ".gg.."];

export const SUN: Art = [
  "...y..y..y...",
  ".............",
  "..YYYYYYYY...",
  ".yYyyyyyyYy..",
  "y.YyyYYyyY.y.",
  ".YyyYyyYyyY..",
  "y.YyyYYyyY.y.",
  ".yYyyyyyyYy..",
  "..YYYYYYYY...",
  ".............",
  "...y..y..y...",
];

export const CLOUD: Art = [
  ".......wwww.......",
  "....wwwwwwwwww....",
  "..wwwwwwwwwwwwww..",
  "wwwwwwwwwwwwwwwwww",
  "wwwwwwwwwwwwwwwwww",
  ".ssssssssssssssss.",
];

/** One repeating tile: grass blades on top, then soil with a few flecks. 16 wide. */
export const GROUND_TILE: Art = [
  "..m...m..m...m..",
  "gggggggggggggggg",
  "gnggggnggggnggng",
  "eeeeeeeeeeeeeeee",
  "eeFeeeeEeeeeeFee",
  "eeeeeEeeeeeeeeee",
  "eEeeeeeeFeeEeeee",
  "eeeeFeeeeeeeeEee",
  "uuuuuuuuuuuuuuuu",
];
