import type { CSSProperties } from "react";
import { GHOST, HALL, LAMP, MOON, OWL, ROBOT, SKYLINE, STREET_TILE, type Art } from "./art";
import { Sprite, tileBackground } from "./Sprite";

const STREET_ROWS = STREET_TILE.length;
// Feet rest on top of the curb, two rows into the tile.
const STAND = STREET_ROWS - 2;

/** [left in %, top in pixels of the grid] */
const STARS: [number, number][] = [
  [4, 5],
  [11, 14],
  [19, 3],
  [27, 10],
  [36, 4],
  [44, 13],
  [52, 6],
  [61, 3],
  [69, 12],
  [78, 5],
  [86, 14],
  [93, 7],
  [98, 2],
];

function Prop({
  art,
  left,
  className = "",
  style,
}: {
  art: Art;
  left: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={`absolute ${className}`} style={{ left, bottom: `calc(var(--s) * ${STAND})`, ...style }}>
      <Sprite art={art} />
    </div>
  );
}

/**
 * The night street from the landing page: stars, a moon, a skyline of lit windows, the records hall and
 * three bidlings standing on the curb. It is drawn at any width; the bidlings hop when `excited` is on.
 */
export function Scene({ excited = false }: { excited?: boolean }) {
  const hop = excited ? "hop" : "";
  return (
    <div
      aria-hidden
      className="relative w-full overflow-hidden bg-night"
      style={{ height: `calc(var(--s) * ${STREET_ROWS + 32})` }}
    >
      {STARS.map(([left, top], i) => (
        <span
          key={left}
          className={`blink absolute bg-paper/80 ${i % 3 === 0 ? "hidden sm:block" : ""}`}
          style={{
            left: `${left}%`,
            top: `calc(var(--s) * ${top})`,
            width: "calc(var(--s) * 0.5)",
            height: "calc(var(--s) * 0.5)",
            animationDuration: `${2.2 + (i % 4) * 0.7}s`,
            animationDelay: `${-(i * 0.45)}s`,
          }}
        />
      ))}

      <div className="absolute" style={{ right: "9%", top: "calc(var(--s) * 4)" }}>
        <Sprite art={MOON} />
      </div>

      <div
        className="absolute inset-x-0"
        style={{
          bottom: `calc(var(--s) * ${STAND})`,
          height: `calc(var(--s) * ${SKYLINE.length})`,
          backgroundImage: tileBackground(SKYLINE),
          backgroundSize: `calc(var(--s) * 48) calc(var(--s) * ${SKYLINE.length})`,
          backgroundRepeat: "repeat-x",
          imageRendering: "pixelated",
        }}
      />

      <Prop art={HALL} left="5%" className="hidden md:block" />
      <Prop art={LAMP} left="3%" />
      <Prop art={LAMP} left="31%" className="hidden md:block" />
      <Prop art={LAMP} left="68%" className="hidden md:block" />
      <Prop art={LAMP} left="95%" />

      <div
        className="absolute left-1/2 flex -translate-x-1/2 items-end"
        style={{ bottom: `calc(var(--s) * ${STAND})`, gap: "calc(var(--s) * 3)" }}
      >
        <div className={hop} style={{ animationDelay: "0ms" }}>
          <Sprite art={ROBOT} />
        </div>
        <div className={hop} style={{ animationDelay: "120ms" }}>
          <Sprite art={OWL} />
        </div>
        <div className={hop} style={{ animationDelay: "240ms" }}>
          <Sprite art={GHOST} />
        </div>
      </div>

      <div
        className="absolute inset-x-0 bottom-0"
        style={{
          height: `calc(var(--s) * ${STREET_ROWS})`,
          backgroundImage: tileBackground(STREET_TILE),
          backgroundSize: `calc(var(--s) * 16) calc(var(--s) * ${STREET_ROWS})`,
          backgroundRepeat: "repeat-x",
          imageRendering: "pixelated",
        }}
      />
    </div>
  );
}
