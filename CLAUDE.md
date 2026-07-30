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

Measured baseline: **520 checks, 0 failures.** If the count drops, a suite stopped
running rather than started passing — find out which.

`tests/audit/` pins the findings in `docs/findings-v10.2.md`: one suite per wave, each
asserting the behaviour its fix was verified against, so a later change cannot quietly
reopen a closed finding.

## Two things the app deliberately does not claim to know

- Three of the six plant-capacity figures in `DATALOG.capacity` are **not** on the
  printed Data Log page (which carries only `50.000`, `25.000`, `18.000`). They came
  from an OCR reconstruction and render with the `unver` marker. `CAPACITY_UNVERIFIED`
  holds the reason for each. X-Europe is the one the 30,000-unit X3 commitment rests
  on — it needs a human to check page 2 against the print.
- Optimal capacity is not in the Data Log at all; that table is *maximal*. `MR24`
  measures it, and there is a field for its answer. Until it is entered the engine says
  "not measured" rather than treating maximal as optimal.
