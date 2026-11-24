import type { CSSProperties } from "react";
import { BUSH, CAT, CLOUD, FLOWER, FOX, FROG, GROUND_TILE, PINE, SUN, type Art } from "./art";
import { Sprite, tileBackground } from "./Sprite";

const GROUND_ROWS = GROUND_TILE.length;
// The grass surface sits a couple of pixels below the top of the tile.
const STAND = GROUND_ROWS - 2;

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
 * The landscape from the landing page: sky, sun, clouds, trees and three critters standing on the
 * ground. It is drawn at any width, and the critters hop when `excited` is on.
 */
export function Scene({ excited = false }: { excited?: boolean }) {
  const hop = excited ? "hop" : "";
  return (
    <div
      aria-hidden
      className="relative w-full overflow-hidden"
      style={{ height: `calc(var(--s) * ${GROUND_ROWS + 25})` }}
    >
      <div className="absolute" style={{ right: "7%", top: "calc(var(--s) * 3)" }}>
        <Sprite art={SUN} />
      </div>

      <div className="drift absolute" style={{ top: "calc(var(--s) * 4)", animationDelay: "-30s" }}>
        <Sprite art={CLOUD} />
      </div>
      <div
        className="drift absolute hidden sm:block"
        style={{ top: "calc(var(--s) * 11)", animationDelay: "-85s" }}
      >
        <Sprite art={CLOUD} style={{ opacity: 0.8 }} />
      </div>
      <div
        className="drift absolute hidden lg:block"
        style={{ top: "calc(var(--s) * 2)", animationDelay: "-60s" }}
      >
        <Sprite art={CLOUD} style={{ opacity: 0.9 }} />
      </div>

      <Prop art={PINE} left="3%" />
      <Prop art={BUSH} left="12%" className="hidden sm:block" />
      <Prop art={PINE} left="20%" className="hidden md:block" />
      <Prop art={FLOWER} left="29%" className="hidden md:block" />

      <div
        className="absolute left-1/2 flex -translate-x-1/2 items-end"
        style={{ bottom: `calc(var(--s) * ${STAND})`, gap: "calc(var(--s) * 3)" }}
      >
        <div className={hop} style={{ animationDelay: "0ms" }}>
          <Sprite art={FROG} />
        </div>
        <div className={hop} style={{ animationDelay: "120ms" }}>
          <Sprite art={FOX} />
        </div>
        <div className={hop} style={{ animationDelay: "240ms" }}>
          <Sprite art={CAT} />
        </div>
      </div>

      <Prop art={FLOWER} left="68%" className="hidden md:block" />
      <Prop art={BUSH} left="75%" className="hidden sm:block" />
      <Prop art={PINE} left="82%" className="hidden md:block" />
      <Prop art={PINE} left="92%" />

      <div
        className="absolute inset-x-0 bottom-0"
        style={{
          height: `calc(var(--s) * ${GROUND_ROWS})`,
          backgroundImage: tileBackground(GROUND_TILE),
          backgroundSize: `calc(var(--s) * 16) calc(var(--s) * ${GROUND_ROWS})`,
          backgroundRepeat: "repeat-x",
          imageRendering: "pixelated",
        }}
      />
    </div>
  );
}
