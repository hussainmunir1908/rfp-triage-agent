import { CAT } from "./pixel/art";
import { Sprite } from "./pixel/Sprite";

/** The idiaz.io wordmark: spaced pixel capitals with an orange dot. */
function Wordmark() {
  return (
    <span
      className="label text-[13px] font-bold tracking-[0.28em] text-ink"
      style={{ fontFamily: "var(--font-silk)" }}
    >
      IDIAZ<span className="text-orange">.</span>IO
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
          <span className="label hidden truncate text-ink-3 sm:block">RFP triage agent</span>
        </div>
        {onNew ? (
          <button
            type="button"
            onClick={onNew}
            className="rounded-[6px] border border-orange bg-transparent px-3.5 py-1.5 text-sm font-medium text-orange-ink transition-colors hover:bg-orange hover:text-ink"
          >
            {busy ? "Cancel" : "Analyze another RFP"}
          </button>
        ) : (
          <span className="label hidden text-ink-3 md:block">internship challenge // 2026</span>
        )}
      </div>
    </header>
  );
}

const TICKER = [
  "Every quote is looked up in the PDF by code",
  "Missing information is written as not stated",
  "Dates are re-read from the document, not trusted",
  "Totals the RFP states are added up again",
  "Click any page badge to open the source page",
  "Two model calls per RFP, built for the free tier",
  "Ambiguity is flagged, never quietly resolved",
];

/** The orange strip under the header, same device as the idiaz.io site. */
export function Ticker() {
  const row = (
    <div className="flex shrink-0 items-center" aria-hidden>
      {TICKER.map((t) => (
        <span
          key={t}
          className="label flex items-center whitespace-nowrap px-7 text-[11px] font-bold text-ink"
        >
          <span className="mr-3 inline-block h-[6px] w-[6px] bg-ink" />
          {t}
        </span>
      ))}
    </div>
  );
  return (
    <div className="overflow-hidden border-b border-ink/10 bg-orange py-[7px]" role="presentation">
      <div className="marquee">
        {row}
        {row}
      </div>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="frame flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-6">
        <div className="flex items-center gap-3">
          <Sprite art={CAT} px="2px" />
          <p className="label text-ink-3">
            RFP triage agent // built for the idiaz.io internship challenge 2026
          </p>
        </div>
        <p className="label text-ink-3">One human, three pixel pets</p>
      </div>
    </footer>
  );
}
