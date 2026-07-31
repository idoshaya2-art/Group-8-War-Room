# Group-8-War-Room — working notes

## The deploy target is this repository, and only this one

All work goes to **`idoshaya2-art/Group-8-War-Room`**, branch **`main`**.
Live at <https://idoshaya2-art.github.io/Group-8-War-Room/>, published by
`.github/workflows/deploy-pages.yml` on every push to `main`.

The local checkout directory may be named something else (`Visut_Vehicle`) for
historical reasons — **the directory name is not the target.** Check the remote:

```
git remote -v          # push must go to group-8-war-room
git status -sb          # the working branch tracks warroom/main
```

A second repository, `idoshaya2-art/Visut_Vehicle`, holds an old copy and is **not**
part of this project. Its push URL is deliberately set to `no-push://` in this
checkout so a mistaken push fails loudly instead of succeeding quietly. Do not
push there, and do not re-point it.

## This repository is PUBLIC

It serves GitHub Pages, so everything committed is world-readable.

- **Never commit course materials** — the INTOPIA User Guide, the Data Log, or the
  course booklet. They are the course's copyrighted documents, and the booklet also
  contains the peer-evaluation form. `.gitignore` refuses `docs/sources/` and `*.pdf`.
  Cite rules by section instead (`§4.3`, `§4.11`, `Data Log 09`, the booklet's cost
  column) so a claim stays checkable against the team's own copy.
- **Never commit API keys.** The app takes the user's key at runtime and keeps it in
  `localStorage` under `intopia_ai_key_*`; it is deliberately never written into
  application state, so it cannot reach a team-sync snapshot or a backup file.
- The team's written plan `docs/plan-Q4-Q9-v5.docx` is already public by the team's
  own choice. Later revisions are **not** to be committed without asking.

## Before pushing

`bash tests/run.sh` — every suite, in a real browser via Playwright. The exit code is
the gate; a green line without exit 0 has happened before (a suite that reports and
then throws), so trust the code, not the text.

Measured baseline: **580 passes, 0 failures, exit 0** — the sum of the per-suite `PASS n FAIL n`
lines. Measure it the same way every time, or the comparison is meaningless:

```
bash tests/run.sh 2>&1 | grep -E "PASS [0-9]+" | awk '{p+=$2; f+=$4} END{print p, f}'
```

(Counting the `✓` lines instead gives **606**, because three suites print ticks without a PASS
summary. Either number is fine; mixing them is not.) If the count drops, a suite stopped running
rather than started passing — find out which.

## The shell is six tabs

v12.0 replaced thirteen pages with six: dashboard · financials (ingest lives here, because it
produces them) · rules · quarterly decisions · submission sheet · help. The old page ids still
resolve through `PAGE_ALIAS`, so an in-app jump written before the rebuild does not break.

The engine underneath was NOT rewritten — `DATALOG`, `RULES`, the cash/floor/contract/demand
calculations, the parser and the AI layer are the same code the suite already covered. Each tab
composes `body*` functions through `slot()`, which exists because those bodies were written as
whole-page renderers and assign `c.innerHTML`; without it, one body wipes the previous one.

The rules tab is generated **from `RULES` and `DATALOG` themselves**, not hand-written. A rule the
engine applies therefore cannot be missing from the tab, and a rule shown there cannot be one the
engine ignores.

`tests/audit/` pins the findings in `docs/findings-v10.2.md`: one suite per wave, each
asserting the behaviour its fix was verified against, so a later change cannot quietly
reopen a closed finding.

## The list is the team's plan, not a list the engine invented

`renderPlanActions()` renders `PLAN_V6`'s actions for the target quarter as the tab's decision
list. `buildActionPlan()` still runs and still renders — as a **second opinion inside the
background disclosure**, because being handed someone else's fifteen items while holding your own
is the complication this tab exists to remove.

Two checkers sit beside the plan, never in front of it:

- the engine, through `PLAN_V6_CHECKS` (arithmetic against `DATALOG` and live state);
- the model, through `reviewPlanWithAI()` — the same fact pack the rest of the AI layer uses
  (`buildAIContext`: rules, Data Log, MR74/MR17&28, competitor prices, liquidity by currency, the
  demand model), plus each action's engine verdict, so the model is told what the arithmetic found
  instead of re-deriving it blind. It may approve, qualify, propose a point fix, or block — it may
  **not** rewrite the plan, and the prompt says so.

`planGaps()` is the safety valve: engine findings marked mandatory whose decision-form code appears
in no plan action are promoted back above the fold. Recommended-only and already-blocked items are
not — this section is for obligations, not suggestions. Losing a contract deadline because it was
not in the written plan is the one failure this arrangement must not allow, and `planv6.cjs`
asserts each of those four cases.

Plan actions carry no send-to-simulator button: a plan line is prose plus a form code, and
manufacturing a lever payload from it would be inventing numbers. The simulator/export path still
runs through the engine's list in the background section.

## The decisions tab is four things, in this order

It answers exactly what it was asked to answer, and nothing sits above the list that is not one
of them:

1. **`.focus` — the money.** Cash available · expected income · mandatory floor · what the chosen
   actions cost · what is left. One level-1 surface, ~170px, followed by the allocation bar.
2. **The list** — the plan's actions — under a single compact header carrying the AI button.
3. The simulator/export footer.
4. **One `<details>`, closed** — everything that explains rather than decides: how the list is
   built, how the budget is derived (Data Log 09 collection, the two-tier capacity, the no-sale
   scenario), the written plan v6, what-breaks-first, the critical path, the rolling plan, the
   roadmap and the advisor.

The tab used to stack thirteen sections above the first decision. Nothing was deleted in the cut —
it moved into (4). Two rules keep it that way, and both are asserted:

- `tests/audit/wave5.cjs` measures **the first decision card's top against the viewport** on both
  form factors. It used to measure that card's send button; plan actions have none, and on a
  390×844 phone the app chrome alone is 497px, so a button-above-the-fold assertion would only be
  satisfiable by making the page worse.
- `tests/decisions.cjs` splits every budget claim in two: the headline must be in `innerText`
  (visible), the working must still be in `textContent` (present, inside the closed disclosure).
  That is what stops a future cut from deleting the derivation instead of collapsing it.

The old `renderNextAction` strip was deleted, not disabled — with the list one screen from the
top it duplicated the first card. The dead-code suite is what forces that choice.

wave5 also measures the tab's **own** height above the first card (≤320px), not just the outcome.
The app chrome eats most of a phone screen, so a change nowhere near this tab — a longer
`APP_VERSION` wrapping a line in the sidebar was enough — can fail the outcome assertion and send
the next reader to the wrong file. The pair localises the blame.

## A report is loaded into a quarter you chose, not the one you happen to be viewing

`S.activeQuarter` is what the selector at the top shows. The ingest panel was titled with it and
`applyParsed` wrote into it, so with Q1–Q3 already in, the panel said "load Q3" while the report
being waited for was Q4's — and dropping that file silently overwrote Q3.

`ingestTarget()` is the write target: `S.ui.ingestQ` when set, otherwise `nextReportQuarter()` (the
first quarter with no report). It is rendered as a visible `<select>` in the panel, because the
parser cannot read the quarter off the sheet and guessing silently is what caused the bug.

Two orderings matter and are commented at their call sites:

- `handleFile` moves `S.activeQuarter` to the target **before** `parseWorkbook`, because
  `parseWorkbook` writes market research into the active quarter as it parses. Switching after
  would put the financials in one quarter and the MR in another.
- Parsing does **not** set `entered`. `confirmQuarter()` does, and it is what runs
  `updateLearning()`/`updateMasterPlan()`. Reading a file is not approving it.

`tests/audit/ingest.cjs` pins all of this. It cannot exercise a real file drop — SheetJS loads from
a CDN and the sandbox has no network — so the `handleFile` ordering is the one part held by comment
rather than assertion; the suite says so out loud instead of implying coverage it does not have.

The manual verification form is **collapsed, not deleted**. It is the confirmation step of an
import and the only in-app way to fix a figure the parser misread (three capacity figures came from
an OCR reconstruction), so every path that tells you to use it — a parse error, SheetJS missing —
opens it.

## A label may not describe an operation the number did not undergo

`S.config.goals.floors[q]` defaults to 0, so the north-star's "מזומן מול רצפה" was printing
`cash - 0` — raw cash under a label promising a comparison. `effectiveFloor(q)` is the fix and the
single definition: the team's own goal when set, otherwise the engine's `floorComponents(q).total`
with the label marked `(נגזרת)`, and only if neither exists does it stop claiming a comparison at
all. `renderNorthStar` and `ROLE_PANEL.cfo` both go through it; `projectCashflow` deliberately does
not, because a breach there is also triggered by a negative region and changing its floor would
move every projection the suite already pins.

## The written plan lives in the decisions tab, as structure

`PLAN_V6` encodes the team's plan Q4→Q9 (version 6) as data — the fifteen Q4 actions in order,
the Q5 thirteen, the floor line items, the grade schedule, the per-quarter financials and the risk
triggers — and `PLAN_V6_CHECKS` puts an engine verdict beside each line. Three rules hold there:

- **Nothing is invented.** Every number on screen is the plan's own; the engine's number appears
  next to it, never instead of it.
- **`na` is not approval.** A line the engine cannot measure reports "not checked" and is counted
  separately from "matches". A check that throws degrades to `na` too — `tests/audit/planv6.cjs`
  asserts this by making one throw on purpose.
- **The Data Log is the referee.** A check that tests a `[DL-xx]` claim reads the constant out of
  `DATALOG` (or runs `freightCostLC` / `capacityForProduct`) instead of restating the prose.

One verdict is a genuine disagreement and must stay loud: the plan's per-unit Europe channel cost
of **18 SF** is below Data Log 04's selling cost of **40 EUR** (Y-only) or **33 EUR** (X+Y) — about
**31 SF a unit**, ~690,000 SF a quarter at 22,000 units. It does not overturn the plan's Brazil
conclusion — it widens the Brazil↔Europe gap — but Europe's 45.4 SF contribution is overstated.

It renders inside the decisions tab's background disclosure — below the money and below the list,
closed until asked for. `PLAN_DOC` (v5) is still the *document* the submission tab hands back; v6 is deliberately **not**
committed as a file. `planDeltas()` compares against v6's anchors.

## What is settled, and what the app still does not claim to know

- Plant capacity is settled: the team confirmed all six figures against their printed
  Data Log on 2026-07-30, so `CAPACITY_UNVERIFIED` is empty and `CAPACITY_VERIFIED`
  records how. Keep the mechanism — three of those figures came from an OCR
  reconstruction and could not be read from a text extraction of the page, and the
  next figure that arrives that way belongs in it.
  Europe holds 2 chip plants and 2 PC plants (Q3 report, `PLANTS BUILT AND BUILDING`),
  so chip capacity is 70,000 a quarter against a 30,000 commitment. **Capacity was
  never the constraint on the X3 contract — the grade is.** The same report gives
  `MAX. OWNED GRADE` and `MAX. PRODUCIBLE GRADE` for chips as **2**, and the contract
  needs X3.
- Optimal capacity is not in the Data Log at all; that table is *maximal*. `MR24`
  measures it, and there is a field for its answer. Until it is entered the engine says
  "not measured" rather than treating maximal as optimal.
