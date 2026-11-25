# Bidlings: RFP triage agent

Upload a government RFP (PDF) and get a bid / no-bid recommendation in about a minute. Every fact in the report
links to the page it came from, and the quotes behind those facts are checked against the PDF by code.

Built by **Hussain Munir** for the idiaz.io internship challenge.

- **Live app:** https://rfp-triage-agent.vercel.app
- **Code:** https://github.com/hussainmunir1908/rfp-triage-agent
- **Stack:** Next.js (App Router, TypeScript), Tailwind CSS, Google Gemini, Vercel

## What it does

1. **Reads the whole document**, page by page, in the browser.
2. **Extracts facts and dates**: agency, scope, contract type and value, and every date as a real calendar date.
3. **Lists the must-haves**: eligibility, what the solution must do, security and hosting rules, service levels,
   submission rules and contract terms that put cost or risk on the contractor.
4. **Checks eligibility** against the idiaz.io profile: met, confirm, at risk or blocked.
5. **Scores the fit** from 0 to 10, with a one-line reason per factor.
6. **Makes the call**: bid or no-bid, the three strongest reasons, deal-breakers, what would change the call and
   questions to ask the agency.

Ground rules: only the document is used, missing information is written as "Not stated", ambiguity is flagged
instead of resolved, and clearly out-of-domain work (such as construction) gets a fast no-bid.

The report is also available as JSON (download, copy or API) and as a CSV compliance matrix with one row per
requirement.

## Bonus features

1. **Evidence-linked report.** The model must return a page number and a verbatim quote for every fact, date and
   requirement. Code then finds each quote in the PDF text (`src/lib/verify.ts`) and marks anything it cannot find as
   unverified. Dates are re-parsed from the document, stated totals are re-added, figures are checked against their
   quotes, and obligation sentences that nobody quoted are handed back for review (`src/lib/coverage.ts`). Every
   item has a page badge that opens the real PDF page with the passage outlined.
2. **Expired-deadline flags.** Each date is compared with today and marked **Expired**, **Due today** or **In N
   days**. If every proposal deadline has passed, the report opens with an "already closed" banner.
3. **Risk clause radar.** `src/lib/risks.ts` scans the text with plain rules for the clauses that hurt a small
   studio most: uncapped liability, indemnity, service credits and penalties, long payment terms, bonds, onsite
   work and more. No model is involved, so it cannot invent a clause. Each finding has a severity, the quote and a
   page badge.
4. **Pixel timeline.** Every dated item sits on one pixel-art track with a marker for today: a flag for dates
   ahead, a tick for what has happened and a cross for deadlines already missed.

## Interface

Schibsted Grotesk for text, JetBrains Mono for detail and Jersey 10 for pixel labels, on cool paper with navy ink
and one yellow accent. The three characters (Scribe the robot, Hoot the owl, Boo the ghost) and the night-street
scenery are text grids in `src/components/pixel/art.ts`, rendered as SVG. The report opens on the call and four
summary tiles, with tabs for Overview, Dates, Requirements, Risks, Fit score and Evidence. It adapts from phones to
ultrawide screens.

## How it works

```
Browser                                   Server (Next.js route, Vercel)
-------                                   ------------------------------
PDF file
  |  pdf.js reads the text per page
  v
pages[] -------------- POST /api/analyze ----> 1. Extract    Gemini, JSON schema, quotes + pages
                                                2. Verify     code checks quotes, pages, dates, figures
progress events <------ streamed NDJSON ------     + Coverage  code finds obligations nobody quoted
report + PDF viewer                             3. Judge      Gemini classifies those, checks eligibility, scores factors
                                                4. Decide     code turns factor impacts into score + call
```

- **Parse in the browser.** Vercel limits request bodies to about 4.5 MB. Sending only the extracted text avoids
  that, keeps the PDF on the user's machine and lets the viewer render the real pages.
- **One long-context call, not chunking**, so a requirement in an appendix can be weighed against the scope.
- **The judge never sees the PDF.** It reasons over the verified extraction, so it cannot invent facts.
- **Unknown is not met.** The profile does not state years in business, past projects, certifications or insurance,
  so those show as "confirm".
- **The decision rule lives in code** (`src/lib/score.ts`). The model proposes factors worth -3 to +3, added to a
  base of 5. An unconfirmed qualification caps the score at 8 (7 when three or more are open), a deal-breaker or
  blocked qualification caps it at 3, out-of-domain work at 2, and a document with fewer than five stated
  requirements at 6. A bid needs 6 or more.
- **Structured output.** One zod schema defines both the model request and the validation.

## Models and free-tier limits

The free Gemini tier allows about 20 requests per day per model, so the agent makes **two model calls per RFP**
and keeps a pool of models in `src/lib/gemini.ts`. A model with an exhausted quota is skipped, overloaded models
are retried, and repeating a document is served from an in-memory cache. If a lighter fallback model wrote part of
the report, the UI says so.

Set `GEMINI_MODELS` (comma-separated) to change the pool and `GEMINI_THINKING_LEVEL` (`MINIMAL`, `LOW`, `MEDIUM`,
`HIGH`) to trade speed for depth. The default is `LOW`.

## Run it locally

Requires Node 20 or newer and a free Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey).

```bash
npm install
echo "GEMINI_API_KEY=your-key" > .env.local
npm run dev
```

Open http://localhost:3000 and drop in a PDF. `npm test` runs the unit tests.

| Variable                | Required | Purpose                                         |
| ----------------------- | -------- | ----------------------------------------------- |
| `GEMINI_API_KEY`        | yes      | Gemini API key. Never committed.                |
| `GEMINI_MODELS`         | no       | Ordered, comma-separated model pool.            |
| `GEMINI_THINKING_LEVEL` | no       | `MINIMAL`, `LOW` (default), `MEDIUM` or `HIGH`. |

## API

`POST /api/analyze` takes `application/json` with `{ "fileName": "rfp.pdf", "pages": ["page 1 text", "..."] }`, or
`multipart/form-data` with a `file` field (PDF, up to 4 MB). Add `?stream=1` for progress as newline-delimited JSON
events; without it the response is the final report.

```jsonc
{
  "decision": "BID" | "NO_BID",
  "fit_score": 0,                       // 0 to 10
  "deadlines": [{ "what": "", "date": "2025-04-30", "status": "expired", "evidence": { "page": 2, "quote": "", "verified": true } }],
  "requirements": [{ "category": "", "text": "", "mandatory": true, "evidence": {} }],
  "qualification_checks": [{ "requirement": "", "status": "met" | "unknown" | "at_risk" | "blocked", "note": "" }],
  "reasons": [{ "text": "", "refs": [] }],   // the three strongest
  "risks": [], "factors": [], "deal_breakers": [], "would_change_mind": [], "open_questions": [],
  "ambiguities": [], "summary": "", "facts": [], "verification": {}, "coverage": {}
}
```

## Deploy

Import the repository on Vercel and add `GEMINI_API_KEY` under Project Settings, Environment Variables. The
analysis route sets `maxDuration = 300`, which the Hobby plan allows with Fluid Compute.

## Project layout

```
src/
  app/api/analyze/route.ts   API route (JSON, multipart, streaming)
  components/                upload and progress (Analyzer, Landing, Working), Report and report/ tabs,
                             EvidenceViewer, pixel/ art and sprites
  lib/
    analyze.ts               the pipeline: extract, verify, judge, decide
    gemini.ts                model pool, structured output, quota handling
    prompts.ts               prompts and the company profile
    verify.ts, figures.ts,   quote and page checks, figure support, obligation coverage,
    coverage.ts, dates.ts    date parsing and expiry
    risks.ts, matrix.ts      risk clause radar, CSV compliance matrix
    score.ts                 the decision rule
    types.ts                 schemas and report types
    pdf-*.ts, cache.ts       PDF text extraction, in-memory cache
```

## Limits

- Text-based PDFs only. Scanned documents would need OCR.
- The coverage check hands at most 120 uncovered statements to the judge and only finds obligations that use cue
  words (must, shall, required and similar), so a requirement worded without them can be missed.
- The fallback model lists noticeably fewer requirements, and the report says when it was used.
- The company profile is fixed in `src/lib/prompts.ts`. Set-asides are treated as unknown unless the document says
  otherwise.
- A language model still reads the document. The evidence checks make mistakes visible; they do not make the
  extraction perfect, so treat the report as a fast first pass for a human to confirm.
