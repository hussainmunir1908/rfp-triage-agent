"use client";

import { useRef, useState } from "react";
import { GHOST, OWL, ROBOT, PAGE } from "./pixel/art";
import { Scene } from "./pixel/Scene";
import { Sprite } from "./pixel/Sprite";

const STEPS = [
  {
    n: "01",
    title: "Read",
    who: "Scribe",
    art: ROBOT,
    text: "Every page, appendices and forms included. Agency, scope, value, dates and every must-have come out as a list.",
  },
  {
    n: "02",
    title: "Check",
    who: "Hoot",
    art: OWL,
    text: "Each quote is looked up in the PDF by code. Dates are re-read, stated totals are added up again, and anything that does not match is flagged.",
  },
  {
    n: "03",
    title: "Judge",
    who: "Boo",
    art: GHOST,
    text: "A fit score from 0 to 10 against the idiaz.io profile, a bid or no-bid call, and three reasons that open the page they came from.",
  },
];

export function Landing({ onFile, error }: { onFile: (file: File) => void; error: string | null }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const take = (files: FileList | null) => {
    const file = files?.[0];
    if (file) onFile(file);
  };

  return (
    <>
      <section className="frame grid gap-[clamp(24px,4vw,64px)] pb-[clamp(28px,5vw,72px)] pt-[clamp(28px,5vw,72px)] lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-center">
        <div>
          <p className="label flex w-fit items-center gap-2 text-ink-2">
            <span className="inline-block h-[9px] w-[9px] bg-accent outline outline-1 outline-ink" />
            bidlings // rfp triage
          </p>
          <h1 className="mt-5 max-w-[16ch] text-balance text-[clamp(2.3rem,5.6vw,5rem)] font-bold leading-[1.02] tracking-[-0.035em]">
            Drop in an RFP. Get a bid call{" "}
            <mark className="box-decoration-clone bg-accent px-[0.12em] text-ink">you can check.</mark>
          </h1>
          <p className="mt-6 max-w-[56ch] font-mono text-[clamp(0.85rem,1.3vw,1rem)] leading-[1.75] text-ink-2">
            Three little pixel clerks read every page, list the dates and must-haves, score the fit against
            idiaz.io and show the page behind every claim.
          </p>
        </div>

        <div className="min-w-0">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              take(e.dataTransfer.files);
            }}
            className={`flex flex-col items-center gap-5 rounded-[6px] border-2 px-5 py-9 text-center transition-colors sm:px-8 ${
              dragging ? "border-ink bg-accent-wash" : "border-dashed border-ink/40 bg-card"
            }`}
          >
            <div className={dragging ? "hop" : "bob"}>
              <Sprite art={PAGE} px="6px" />
            </div>
            <div>
              <p className="text-xl font-semibold tracking-tight">
                {dragging ? "Let go to start" : "Drop an RFP PDF here"}
              </p>
              <p className="mx-auto mt-1.5 max-w-[34ch] font-mono text-[13px] leading-relaxed text-ink-2">
                Text-based PDFs up to about 100 pages. The file is read in your browser; only its text is
                sent.
              </p>
            </div>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-[6px] border-2 border-ink bg-accent px-6 py-2.5 text-sm font-bold text-ink shadow-[3px_3px_0_0_var(--ink)] transition-transform hover:-translate-x-px hover:-translate-y-px active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            >
              Choose a file
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                take(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {error ? (
            <p
              role="alert"
              className="mt-4 flex items-start gap-3 rounded-[6px] border border-red/30 bg-red-wash px-4 py-3 text-sm text-red"
            >
              <span className="label mt-0.5 shrink-0 text-red">Error</span>
              <span>{error}</span>
            </p>
          ) : null}
        </div>
      </section>

      <Scene excited={dragging} />

      <section className="frame py-[clamp(36px,6vw,80px)]">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h2 className="text-[clamp(1.4rem,2.6vw,2.1rem)] font-semibold tracking-tight">
            Three steps. All of them shown.
          </h2>
          <p className="font-mono text-xs text-ink-3">{"// what happens to your PDF"}</p>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {STEPS.map((s) => (
            <article key={s.n} className="flex flex-col rounded-[6px] border border-line bg-card p-5">
              <div className="flex items-start justify-between gap-4">
                <p className="label text-accent-ink">{`${s.n} // ${s.title} // ${s.who}`}</p>
                <Sprite art={s.art} px="3px" />
              </div>
              <p className="mt-4 font-mono text-[13px] leading-[1.75] text-ink-2">{s.text}</p>
            </article>
          ))}
        </div>

        <div className="mt-4">
          <div className="rounded-[6px] bg-night p-[clamp(20px,3vw,40px)] text-paper">
            <p className="label text-accent">show the page</p>
            <h3 className="mt-3 max-w-[24ch] text-[clamp(1.4rem,2.4vw,2.1rem)] font-semibold leading-tight tracking-tight">
              Most AI tools ask you to trust them. This one opens the page.
            </h3>
            <p className="mt-4 font-mono text-[13px] leading-[1.8] text-paper/70">
              A model can sound right and be wrong, which is the worst failure for a tool that decides where a
              team spends a week. So every fact carries a page and a quote, code checks the quote exists, and
              one click opens the PDF page with the passage outlined.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
