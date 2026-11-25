import { GHOST, ROBOT } from "./pixel/art";
import { Sprite } from "./pixel/Sprite";

/** The wordmark: a pixel robot head and spaced pixel capitals. */
function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <Sprite art={ROBOT} px="2px" />
      <span
        className="text-[26px] leading-none tracking-[0.12em] text-ink"
        style={{ fontFamily: "var(--f-pixel)" }}
      >
        BIDLINGS
      </span>
    </span>
  );
}

export function Header({ onNew, busy }: { onNew?: () => void; busy?: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper">
      <div className="frame flex h-14 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Wordmark />
          <span className="hidden h-5 w-px bg-line-2 sm:block" />
          <span className="label hidden truncate text-ink-3 sm:block">rfp triage</span>
        </div>
        {onNew ? (
          <button
            type="button"
            onClick={onNew}
            className="rounded-[6px] border border-accent bg-transparent px-3.5 py-1.5 text-sm font-medium text-accent-ink transition-colors hover:bg-accent hover:text-ink"
          >
            {busy ? "Cancel" : "Analyze another RFP"}
          </button>
        ) : null}
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="frame flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-6">
        <div className="flex items-center gap-3">
          <Sprite art={GHOST} px="2px" />
          <p className="label text-ink-3">
            Bidlings<sup className="ml-0.5 text-[10px] align-super">TM</sup> {"// rfp triage"}
          </p>
        </div>
        <p className="label text-ink-3">{"Made by Hussain Munir"}</p>
      </div>
    </footer>
  );
}
