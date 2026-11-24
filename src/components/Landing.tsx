"use client";

import { useRef, useState } from "react";
import { CAT, FOX, FROG, PAGE } from "./pixel/art";
import { Scene } from "./pixel/Scene";
import { Sprite } from "./pixel/Sprite";

const STEPS = [
  {
    n: "01",
    title: "Read",
    art: FROG,
    text: "Every page, appendices and forms included. Agency, scope, value, dates and every must-have come out as a list.",
  },
  {
    n: "02",
    title: "Check",
    art: FOX,
    text: "Each quote is looked up in the PDF by code. Dates are re-read, stated totals are added up again, and anything that does not match is flagged.",
  },
  {
    n: "03",
    title: "Judge",
    art: CAT,
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
      <section className="frame pb-2 pt-[clamp(32px,6vw,84px)]">
        <p className="label mx-auto flex w-fit items-center gap-2 text-ink-2">
          <span className="inline-block h-[9px] w-[9px] bg-orange" />
          idiaz.io // rfp triage agent
        </p>
        <h1 className="mx-auto mt-5 max-w-[22ch] text-balance text-center text-[clamp(2.1rem,6.2vw,4.6rem)] font-bold leading-[1.04] tracking-[-0.03em]">
          Drop in an RFP. Get a bid call <span className="text-orange">you can check.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-[62ch] text-center font-mono text-[clamp(0.85rem,1.4vw,1rem)] leading-[1.75] text-ink-2">
          It reads every page, lists the dates and must-haves, scores the fit against idiaz.io and shows the
          page behind every claim.
        </p>

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
          className={`mx-auto mt-9 flex max-w-3xl flex-col items-center gap-4 rounded-[6px] border px-5 py-8 text-center transition-colors sm:flex-row sm:gap-6 sm:px-8 sm:text-left ${
            dragging ? "border-orange bg-orange-wash" : "border-dashed border-line-2 bg-card"
          }`}
        >
          <div className={dragging ? "hop" : "bob"}>
            <Sprite art={PAGE} px="5px" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold tracking-tight">
              {dragging ? "Let go to start" : "Drop an RFP PDF here"}
            </p>
            <p className="mt-1 font-mono text-[13px] leading-relaxed text-ink-2">
              Text-based PDFs up to about 100 pages. The file is read in your browser; only its text is sent.
            </p>
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="shrink-0 rounded-[6px] bg-orange px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-[#ff7e57]"
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
            className="mx-auto mt-4 flex max-w-3xl items-start gap-3 rounded-[6px] border border-red/30 bg-red-wash px-4 py-3 text-sm text-red"
          >
            <span className="label mt-0.5 shrink-0 text-red">Error</span>
            <span>{error}</span>
          </p>
        ) : null}
      </section>

      <div className="mt-[clamp(20px,4vw,48px)]">
        <Scene excited={dragging} />
      </div>

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
                <p className="label text-orange-ink">{`${s.n} // ${s.title}`}</p>
                <Sprite art={s.art} px="3px" />
              </div>
              <p className="mt-4 font-mono text-[13px] leading-[1.75] text-ink-2">{s.text}</p>
            </article>
          ))}
        </div>

        <div className="mt-4 grid gap-4 rounded-[6px] bg-night p-[clamp(20px,3vw,40px)] text-paper lg:grid-cols-2 lg:items-center">
          <h3 className="max-w-[26ch] text-[clamp(1.4rem,2.6vw,2.2rem)] font-semibold leading-tight tracking-tight">
            Most AI tools ask you to trust them.{" "}
            <span className="text-orange">This one shows you the page.</span>
          </h3>
          <p className="font-mono text-[13px] leading-[1.8] text-paper/70">
            A model can sound right and be wrong, which is the worst failure for a tool that decides where a
            team spends a week. So every fact carries a page and a quote, code checks the quote exists, and
            one click opens the PDF page with the passage outlined.
          </p>
        </div>
      </section>
    </>
  );
}
