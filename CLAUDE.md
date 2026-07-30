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

Measured baseline: **536 passes, 0 failures, exit 0** — the sum of the per-suite `PASS n FAIL n`
lines. Measure it the same way every time, or the comparison is meaningless:

```
bash tests/run.sh 2>&1 | grep -E "PASS [0-9]+" | awk '{p+=$2; f+=$4} END{print p, f}'
```

(Counting the `✓` lines instead gives **562**, because three suites print ticks without a PASS
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

`PLAN_DOC` (v5) is still the *document* the submission tab hands back; v6 is deliberately **not**
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
