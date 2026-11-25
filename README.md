# Bidlings: RFP triage agent

Upload a government RFP (PDF) and get back a bid / no-bid recommendation in about a minute. Every fact in the
report links to the page it came from, the quotes behind those facts are checked against the PDF by code, and the
call can be stress-tested in the browser before anyone commits a week to a proposal.

Built for the idiaz.io internship challenge.

- **Live app:** https://rfp-triage-agent.vercel.app
- **Code:** https://github.com/hussainmunir1908/rfp-triage-agent
- **Stack:** Next.js (App Router, TypeScript), Tailwind CSS, Google Gemini, deployed on Vercel

## What it does

1. **Reads the whole document.** The PDF is parsed in the browser, page by page, and tagged `=== PAGE n ===`.
2. **Extracts facts.** Agency, scope, contract type and value, place of performance, how to submit.
3. **Finds every date.** Proposal deadline, Q&A cut-off, site visits, award and start dates, as real calendar dates.
4. **Lists the must-haves.** Eligibility (set-asides, certifications, clearances, past performance, staffing,
   insurance, location), what the solution must do, security and hosting rules, service levels and acceptance
   thresholds, how to submit, and contract terms that put cost or risk on the contractor.
5. **Checks eligibility** against the idiaz.io profile, one line per mandatory qualification: met, confirm, at risk or
   blocked.
6. **Scores the fit** from 0 to 10, with a one-line reason for each factor.
7. **Makes the call.** Bid or no-bid, the three strongest reasons, deal-breakers, what would change the call, and
   questions to ask the agency.

Ground rules the agent follows: only the document is used, missing information is written as "Not stated",
ambiguous passages are flagged instead of quietly resolved, and work that clearly is not ours (such as
construction) gets a fast no-bid.

The same report is available as JSON from the UI (download or copy) and from the API, and as a CSV compliance
matrix (one row per requirement, with page, quote, status and empty Owner and Notes columns for the bid team).

## Bonus features

### 1. Evidence-linked report

Language models can sound right while being wrong, which is the worst failure for a tool that decides where a
team spends a week of proposal writing. So the agent does not ask to be trusted; it shows its work.

- The model must return, for every fact, date and requirement, the **page number and a verbatim quote**.
- Plain code then looks for that quote in the extracted text of the PDF (`src/lib/verify.ts`). It tries an
  exact match on the cited page, then the neighbouring pages, then a page-spanning match, then a close
  match that tolerates extraction noise. Anything it cannot find is shown as **unverified** instead of being
  dropped quietly.
- Dates get a second check (`src/lib/dates.ts`): the date text is re-parsed from the document itself and
  compared with the model's own conversion. If they disagree, the document wins and the report says it
  corrected the date. A date the document itself replaced (struck through, "revised by Addendum No. 1") is shown
  as **replaced**, not as a live deadline, and does not count when deciding whether the RFP has closed.
- A quote existing does not prove it supports the claim, so figures are checked too (`src/lib/figures.ts`): if an
  item says "$2M" and the quote does not contain it, the item is flagged.
- Totals and percentages the document states about itself are re-added by code. The model only copies the
  numbers; if "about 72%" sits next to a table that adds up to 79%, the report flags the contradiction.
- Recall is checked as well as accuracy (`src/lib/coverage.ts`). Code finds every sentence that sounds like an
  obligation (must, shall, required, [M], numbered requirement ids, "the Contractor will ...") and lists the ones no
  extracted item quotes. Besides must / shall / required, it also looks for "may not", "grounds for", "terminate",
  "non-responsive" and deadlines in days. Those go to the judging call, which can only classify them; it cannot invent a quote.
  The report states how many obligation statements were accounted for.
- In the UI, every item has a small page badge. Clicking it opens the **original PDF page** with the quoted
  passage outlined, so a reviewer can confirm any claim in a couple of seconds.
- The header shows how many cited quotes were found, for example "24 of 24 cited quotes found in the document". This
  means the quote exists, not that the reading is right; the page badge is how to confirm that.

### 2. Expired-deadline flags

Public RFPs are often found after they have closed. Each date is compared with today's date in the viewer's
browser and marked **Expired N days ago**, **Due today** or **In N days**. If every proposal deadline has
passed, the report shows a clear "This RFP has already closed" banner, so nobody spends time on something
that cannot be bid on. The fit assessment is still shown, because it remains useful for similar future work.

### 3. Stress test

A score is only as good as its assumptions, and a bid team always asks "what if we do hold that certification?"
or "what if the agency waives that?". Because the decision rule is code (`src/lib/score.ts`), the report can be
re-scored in the browser with one assumption changed, without another model call (`src/lib/whatif.ts`).

- Set any mandatory qualification to met, confirm, at risk or blocked, waive a deal-breaker, or nudge a factor's
  impact. The score, the BID / NO BID stamp and a plain-words account of the arithmetic update at once, and a
  banner says whether the change flipped the call.
- A **flip finder** tries every combination of up to four changes, smallest first, and lists the shortest sets
  that reverse the current call: "Shortest way to a bid" for a no-bid, "What would sink this bid" for a bid. Each
  has a "Try it" button. Work that is out of domain is locked: no assumption turns construction into a bid, and
  the panel says so instead of pretending.
- This turns the model's prose answer to "what would change the call" into something computed and testable.

## Interface

The look is its own: cool paper, deep navy ink, one arcade-yellow accent, Schibsted Grotesk for text, JetBrains
Mono for detail and Jersey 10 for the pixel labels. The characters (Scribe the robot, Hoot the owl and Boo the ghost)
and the night-street scenery are drawn as text grids in `src/components/pixel/art.ts` and rendered as SVG, so they
stay sharp at any size. While a PDF is processed, the three bidlings work at three stations (read, check, judge), a
tile per page lights up as the document is read, and a magnifier sweeps the tiles while quotes are checked. The report
fills the screen with a small margin and adapts from phones to ultrawide displays.

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

Design decisions:

- **Parse in the browser.** Vercel limits request bodies to about 4.5 MB, and a 100-page RFP can exceed that.
  Sending only the extracted text (a few hundred KB) avoids the limit and keeps the PDF on the user's machine.
  The same text-based path means the viewer can render the real pages for evidence.
- **One long-context call, not chunking.** Gemini reads the entire document at once, so a requirement in an
  appendix can be weighed against the scope on page 3. Chunking tends to lose exactly those links.
- **The judge never sees the PDF.** It reasons over the already verified extraction, which keeps it from
  inventing facts and makes its citations point at items the reader can open.
- **Unknown is not the same as met.** The company profile does not state years in business, past projects,
  certifications or insurance. The judge must mark each mandatory qualification as met, confirm, at risk or
  blocked, and cannot call something met unless the profile says so. Items marked confirm are listed in the report
  as things to check before bidding.
- **The decision rule lives in code.** The model proposes factors with an impact from -3 to +3. Code adds them
  to a base score of 5 and applies the rules: any unconfirmed mandatory qualification caps the score at 8 (7 when
  three or more are open), a deal-breaker or a blocked qualification caps it at 3, construction or goods caps it
  at 2, a document with fewer than five stated requirements (a one-page notice, say) caps it at 6 and is flagged as
  thin, and a bid needs a score of 6 or more. The score is therefore reproducible and easy to explain.
- **Structured output.** The model is constrained to a JSON schema (defined once with zod and used for both the
  request and validation), so the UI and the API always receive the same shape.

## Models and free-tier limits

The free Gemini tier allows only a small number of requests per day for each model (about 20 at the time of
writing), and individual models are sometimes overloaded. The agent therefore uses **two model calls per RFP**
(one to extract, one to review and judge) and keeps a pool of models in
`src/lib/gemini.ts`. When a model reports an exhausted daily quota it is skipped,
and the next one is used. Overloaded models are retried in short sweeps. Repeating the same document is served
from a small in-memory cache and costs no request. If every model is exhausted the UI says so plainly.

Set `GEMINI_MODELS` to a comma-separated list to change the pool, and `GEMINI_THINKING_LEVEL`
(`MINIMAL`, `LOW`, `MEDIUM`, `HIGH`) to trade speed for depth. The default is `LOW`: in testing it was about three
times faster than `MEDIUM` with similar extraction quality.

## Run it locally

Requires Node 20 or newer and a free Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey).

```bash
npm install
cp .env.example .env.local     # then put your key in .env.local
npm run dev
```

Open http://localhost:3000 and drop in a PDF.

| Variable                | Required | Purpose                                         |
| ----------------------- | -------- | ----------------------------------------------- |
| `GEMINI_API_KEY`        | yes      | Gemini API key. Never committed.                |
| `GEMINI_MODELS`         | no       | Ordered, comma-separated model pool.            |
| `GEMINI_THINKING_LEVEL` | no       | `MINIMAL`, `LOW` (default), `MEDIUM` or `HIGH`. |

## API

`POST /api/analyze`

- `application/json` with `{ "fileName": "rfp.pdf", "pages": ["text of page 1", "..."] }`
- or `multipart/form-data` with a `file` field containing a PDF of up to 4 MB

Add `?stream=1` to receive progress as newline-delimited JSON events (`stage`, `result`, `error`). Without it,
the response is the final report as JSON.

```jsonc
{
  "decision": "BID" | "NO_BID",
  "fit_score": 0,                       // 0 to 10
  "deadlines": [{ "what": "", "date": "2025-04-30", "status": "expired", "superseded": false, "evidence": { "page": 2, "quote": "", "verified": true } }],
  "requirements": [{ "category": "", "text": "", "mandatory": true, "evidence": {} }],
  "qualification_checks": [{ "requirement": "", "status": "met" | "unknown" | "at_risk" | "blocked", "note": "" }],
  "reasons": [{ "text": "", "refs": [] }],   // the three strongest
  "factors": [], "deal_breakers": [], "would_change_mind": [], "open_questions": [],
  "ambiguities": [], "summary": "", "facts": [], "verification": {}, "coverage": {}
}
```

## Deploy

The app is a standard Next.js project. On Vercel, import the repository and add `GEMINI_API_KEY` under
Project Settings, Environment Variables. The analysis route sets `maxDuration = 300`, which the Hobby plan allows
with Fluid Compute.

## Project layout

```
src/
  app/
    api/analyze/route.ts   API route (JSON, multipart, streaming)
    page.tsx               entry page
  components/
    Analyzer.tsx           upload, progress and state
    Landing.tsx            first screen: drop zone, scene, how it works
    Working.tsx            the loading view: three stations, page tiles, live log
    Report.tsx             the report sections
    StressTest.tsx         what-if controls, live call and flip finder
    EvidenceViewer.tsx     PDF page with highlighted quote
    Chrome.tsx             header, ticker and footer
    pixel/                 pixel art as text grids, sprite renderer and the landscape
  lib/
    analyze.ts             the pipeline: extract, verify, judge, decide
    gemini.ts              model pool, structured output, quota handling
    verify.ts              quote and page checking
    figures.ts             figure support check and self-contradicting totals
    coverage.ts            finds obligation sentences nobody quoted
    dates.ts               date parsing, correction, superseded and expiry status
    score.ts               the decision rule
    whatif.ts              re-scores a report under changed assumptions, finds the shortest flips
    matrix.ts              CSV compliance matrix
    prompts.ts             prompts and the company profile
    types.ts               schemas and report types
    pdf-text.ts            joins pdf.js text items into page text
    pdf-client.ts          browser PDF reading and page rendering
    pdf-server.ts          PDF text extraction for the multipart API
    cache.ts               in-memory result cache
```

## Limits

- Text-based PDFs only. Scanned documents need OCR, which is out of scope.
- The coverage check hands at most 120 uncovered statements to the judging call. When there are more, those with
  strong obligation words go first and the rest are spread across all pages, and the report says how many were not
  reviewed. It only finds obligations that contain cue words, so a requirement worded without them can be missed.
- When the main models are overloaded the request can fall back to a lighter model. It lists noticeably fewer
  requirements, and the report says when that happened.
- The company profile is fixed in `src/lib/prompts.ts`. Set-asides are treated as unknown unless the document
  says otherwise.
- A language model still reads the document. The evidence checks make mistakes visible; they do not make the
  extraction perfect, so treat the report as a fast first pass for a human to confirm.
