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

Measured baseline: **670 passes, 0 failures, exit 0** — the sum of the per-suite `PASS n FAIL n`
lines. Measure it the same way every time, or the comparison is meaningless:

```
bash tests/run.sh 2>&1 | grep -E "PASS [0-9]+" | awk '{p+=$2; f+=$4} END{print p, f}'
```

(Counting the `✓` lines instead gives **696**, because three suites print ticks without a PASS
summary. Either number is fine; mixing them is not.) If the count drops, a suite stopped running
rather than started passing — find out which.

The "green line without exit 0" warning above is not hypothetical. Four suites once reported
`FAIL 0` and still exited 1, because they threw *after* printing their summary — `editScenario`
wrote into a `#editorArea` that no longer renders anywhere. Every per-suite line said zero
failures and the run said `SOME SUITES FAILED`. When the two disagree, find the thrower:

```
for t in <every suite in run.sh>; do node "$t.cjs" >/dev/null 2>&1; echo "$? $t"; done | grep -v "^0 "
```

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
list. `buildActionPlan()` is the **fallback**, not a second opinion: it renders only for a quarter
the written plan does not cover (Q1–Q3, or past Q9), because better a sourced generated list than
an empty tab — but being handed someone else's fifteen items while holding your own is the
complication this tab exists to remove, so where the plan exists, the plan is the list. It briefly
rendered alongside, inside the background disclosure; that disclosure is gone.

This is also where a model-authored action can reach the DOM, so `tests/audit/rt_xss.cjs` injects
into a quarter the plan does **not** cover. Reviewing Q4 and rendering Q1→Q2 put the payload on a
page it was never going to appear on, and the escaping assertion passed for the wrong reason.

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

Plan actions carry **"הוסף לגיליון הזנה"**, not "send to simulator". `planFormCodes()` pulls the
INTOPIA form codes out of the action's `form` string (`W3`→`A3-3`, unknown codes dropped,
"אוטומטי"/"—" are not forms) and `planAddToSheet()` adds them to the quarter's scenario, creating
one if the team has none, then lands on the sheet. Twelve of the fifteen Q4 actions carry a form;
the other three say so instead of pretending. No lever *values* are derived from the plan's prose —
it states economic intent, not field values, and guessing them is the invention this tool refuses
everywhere else.

## The decisions tab is three things, in this order

It answers exactly what it was asked to answer, and nothing sits above the list that is not one
of them:

1. **`.focus` — the money, as a ledger.** Six lines that add up: cash now · what still arrives
   this quarter · minus the floor · = spendable · minus what the list costs · = what is left.
   It replaced a one-line row of four figures which **did not produce its own headline** — the
   row showed total expected income while the total only ever used the part collected this
   quarter, so the numbers on screen could not be reconciled with the number above them. Both
   `wave5.cjs` and `decisions.cjs` now assert the arithmetic, not the labels: read the six `<b>`
   values and check `[0]+[1]+[2]===[3]` and `[3]+[4]===[5]`. A ledger that does not sum is worse
   than the row it replaced.
2. **The list** — the plan's actions — under a single compact header carrying the AI button.
3. A footer with **one** way out, to the submission sheet.

The tab used to stack thirteen sections above the first decision. The cut moved them into one
closed `<details>`; the team then asked for that disclosure gone outright ("רקע … ניתן להסיר
לגמרי"), and it is. Two rules keep the tab that way, and both are asserted:

- `tests/audit/wave5.cjs` measures **the first decision card's top against the viewport** on both
  form factors. It used to measure that card's send button; plan actions have none, and on a
  390×844 phone the app chrome alone is 497px, so a button-above-the-fold assertion would only be
  satisfiable by making the page worse.
- `tests/decisions.cjs` splits every budget claim in two: the headline must be in `innerText`
  (visible), the working must still be in `textContent` (present, inside the closed disclosure).
  That is what stops a future cut from deleting the derivation instead of collapsing it.

The old `renderNextAction` strip was deleted, not disabled — with the list one screen from the
top it duplicated the first card. The dead-code suite is what forces that choice.

### Removing a panel is not permission to remove its arithmetic

`criticalPath`, `rollingPlan`, `plantPipeline`, `maturationAdvice`, `forecastAccuracy`,
`quartersToEnd` and `startQuarterFor` lost their renderers with that disclosure. An automated
dead-code pass then deleted the **functions** along with the panels, and wave3 crashed on
`ReferenceError: rollingPlan is not defined`. They are verified engine work; only the drawing was
unwanted. They now feed `buildAIContext`, which is a better home anyway — the model was
re-deriving lead times from prose and getting them wrong, and can now only argue about what to do,
not about when. `wave3.cjs` and `wave5.cjs` assert each section by name **in the fact pack**, so
the next cut that takes a function with its panel fails immediately.

`forecastAccuracy` is the cautionary one: its caller read `{n, mape, bias:number}` and the function
returns `{list, bias:[…]}`, so `fa.n>0` was `undefined>0` and the section could never print at all.
It now returns two arrays always — "nothing measured yet" is an empty list, not a third shape.

### There is no simulator page

`sim` is a `PAGE_ALIAS` onto `decide`, and the decisions tab does not host the scenario editor —
so `#scenarioArea` and `#editorArea` render **nowhere**. The scenario itself is still real:
`planAddToSheet` writes into it and the submission sheet reads it. Only the editing surface is
gone. Consequences, each of which cost a suite:

- `editScenario` bails on a missing `#editorArea` instead of throwing on a null node. It is
  reachable from `newScenario`/`cloneScenario`, which the plan can still call.
- The footer's "המשך לסימולטור" button pointed at `go('sim')` — it reloaded the tab you were
  already on. Deleted; `player-path.cjs` and `plant-split-pipeline.cjs` now assert that no button
  in `.content` links there.
- `seedScenarioFromMusts` still builds a scenario from the engine's mandatory actions, and both
  suites still check that those actions arrive without being retyped — the claim was always about
  continuity, never about the sliders.

wave5 also measures the tab's **own** height above the first card (≤320px), not just the outcome.
The app chrome eats most of a phone screen, so a change nowhere near this tab — a longer
`APP_VERSION` wrapping a line in the sidebar was enough — can fail the outcome assertion and send
the next reader to the wrong file. The pair localises the blame.

## The dashboard answers the standing questions

`plantOverview()` / `renderPlantOverview()`: how many plants, where, making what, and the units a
quarter that buys — plant count × Data Log 03, never an estimate. An undeclared X/Y split reports
no capacity and flags itself instead of guessing. Beside it, cash per region in its own currency
with the SF equivalent and the region's tax rate, because a rich balance in one region does not
cover a shortfall in another.

Capacity here is **maximal and per quarter** — the game has no months, and the *optimal* figure is
not in the Data Log at all (MR24 measures it).

**Every money figure names its currency.** MR74 cells are labelled "אלפי CHF", regional cash carries
its own code, everything consolidated says SF. The mixed-scale bugs in this file all began with an
unlabelled number.

## The ask bubble owns the chat

`#askBubble` / `#askPanel` sit outside `.content`, so a free-text question is one click away from
every tab — the question usually occurs to you while looking at a number somewhere else, and
having to navigate to an AI page is how it gets lost. `bodyAI` **lost its chat card** when this
landed: two elements with `id="chatLog"` on one page would have broken both. It keeps the
strategist and the council and links to the bubble.

`renderAskSub()` states what the answer is grounded in, and says plainly when no API key is set
rather than letting a send fail.

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

## Ticking an action is what moves the money

`planPicks(q)` records which plan actions the team has chosen; `planPickedCash(q)` turns them into
the quarter's cash. Every figure is the plan's **own**, transcribed from the action's stated
economics — the conversion to francs (EUR ×1.5, BRL ×0.5) is the only arithmetic applied and each
line records it. Two rules keep it honest:

- An action whose cost is already reserved in the floor carries `cash.floor` and adds **nothing**
  when ticked. Otherwise the same franc is counted as unavoidable *and* as chosen.
- Revenue is split by Data Log 09's collection schedule for the region the plan names, so the
  budget only ever spends the part that actually arrives this quarter.

The ledger is **not clamped**. A `max(0,…)` on spendable made it stop adding up the moment cash
fell below the floor — line 4 printed 0 while lines 1–3 summed to a negative. Below the floor is
real information and shows as the negative it is.

The submission tab leads with exactly the ticked set and their form codes, and keeps the pre-submit
checklist on the surface; everything else there is behind a disclosure.

### Ticking a sale asks for the price, because the plan deliberately does not fix it

Every other figure in an action is the plan's own. The **selling price** is the one that depends on
what the market did last quarter rather than on the plan, so `togglePlanPick` routes a sale through
`openSalePrompt` instead of ticking it, and the action is **not** ticked until `confirmSalePick`
runs — the price is part of the decision, not an afterthought to it.

`planSaleInfo(a)` supplies the dialog. It reads the plan's own price and volume out of the action's
`cash.note`, and recommends in a fixed order of descending authority, **naming the source every
time**: the learned demand anchor (with how many quarters taught it) → the competitors' median from
MR17&28 (with n and range) → the Data Log opening price, explicitly marked *not calibrated*. With
none of the three it says there is no basis for a price rather than printing one — an unsourced
number here would be exactly the invention this tool refuses everywhere else. It also offers the
quarter's market absorption (`marketCapUnits`) and Brazil's Y0–Y3 legal price ceiling.

A confirmed price **replaces** the plan's stated revenue: `planPickedCash` recomputes gross as
`price × units × fxRate`, converted once, and then splits it by Data Log 09 like any other income.
`tests/audit/sale-goals.cjs` pins the fallback order, the "not yet ticked while the dialog is open"
rule, and the arithmetic on both sides of the conversion.

### The targets re-derive themselves, because there is no longer a form to fix them by hand

The manual goals editor came off the tab at the team's request, which makes staleness silent: a
cash floor computed against a three-quarter-old balance sheet is not a floor. So `confirmQuarter()`
re-runs `planV6Goals()` and `recommendFloors()` on **every** ingest. The merge order is the whole
point and is asserted: `{...G.floors, ...derived, ...g.floors}` — the engine's derived floor fills
every quarter, and for a quarter the written plan itemises, the plan's own figure wins, because
that one is the team's commitment rather than an estimate.

## The floor is everything you cannot choose not to pay

`floorComponents()` reserves only the unavoidable, and `total === mandatory` — advertising and
planned production were removed, because a floor is what you must pay *whatever you decide* and
both of those **are** the decision (they are costed by the ticks). R&D reserves the legal minimum
only, for the same reason.

Beyond that it holds: the **whole loan payment**, an **expected penalty** on a commitment that can
no longer be met, **supplier-credit interest**, **carrying cost** on stock, **interest on any area
in overdraft**, and **one HQ line** — the larger of Data Log 10's 20,000 legal minimum and the
team's 100,000 cushion (`DEFAULT_HQ_BUFFER_SF`, overridable via `S.config.goals.hqBufferSF`).
Reserving both was counting the same franc twice; holding the cushion already satisfies the law.

`loanAmortisation()` derives the payment instead of asking for it. A constant-payment loan leaves
a fingerprint in three consecutive balances: `(1+r) = (b2-b1)/(b1-b0)`, then `P = b0(1+r) - b1`.
On the team's own 883,490 → 764,650 → 643,433 that gives 2.0%/quarter and 136,511 — the figure the
written plan derived by hand. It returns null on a rising balance, a series with no implied
interest, or an erratic one, and the floor then falls back to interest only **and says that is all
it is**. All four rejections are asserted.

The penalty is charged **only after the production deadline has passed**. Before it, the cost of
meeting the obligation is the production line already in the floor, and adding a penalty too would
bill the same commitment twice.

## R&D has two numbers, and both must name themselves

`R & D NEW CHIP` / `R & D NEW PC` are **Income Statement** rows, so `operational.rd` and MR74's
competitor cells are alike the spend of **one quarter**. The number the team carries in their head
is the **cumulative** (~1.65M across Q1–Q3). Printing either one under a bare label "our R&D" is
how "our R&D is 0" read as a claim about the company when it was a claim about one quarter — Q3's
R&D genuinely was 0.

So the read-out says both, each named: `rdToDateSF()` (ours, summed over entered quarters) and
`marketRdToDateSF()` (the field's, summed per company over the quarters where MR74 was actually
ingested — it reports `quarters` so a partial history is not passed off as a full one). And it adds
that a total alone does not buy a grade: §4.3's ramp resets on an unfunded quarter, so the same
sum spread differently buys fewer.

## MR74 is in thousands; everything we hold about ourselves is in units

`marketRdAvgSF()` is the only place the two meet — and it **excludes company 8**, because "am I
above the field" is a question about the others. The competitor read-out printed **"our R&D 0 vs
a market average of 419"** while the team's own report held 90,000 — two faults in one line: it
took OUR figure out of MR74 (a report about the *other* companies, which does not always carry it)
and compared MR74's thousands against a number in units. A missing cell became a confident zero.

Our own report is authoritative for our own figures. MR74 is the fallback, scaled ×1000, and when
neither has a figure the line says "not reported" rather than claiming zero. `renderIntelAnchor`'s
market-average line was carrying the same unscaled number and now shares the helper.

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

Each verdict renders **beside the action it judges**, in that card's own closed `<details class="fverd">`
("מה המנוע מודד") — not in a panel of its own, so the arithmetic is one click from the line it is
about. `PLAN_DOC` (v5) is still the *document* the submission tab hands back; v6 is deliberately **not**
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
