# Test suites

Run everything:

```bash
./tests/run.sh
```

All suites drive the real `index.html` in headless Chromium — the app itself is never
mocked. Only the AI provider is stubbed (no network), because the app is bring-your-own-key.

| Suite | What it protects |
|---|---|
| `dead-code` | Functions defined and never called. Added after two such functions were found by hand — one of them was where an estimate marker had been placed, so the marker silently never rendered. |
| `rules-coverage` | Every Data Log sheet (01–10) and guide rule is actually encoded. Currently 53/53. |
| `rules-orderings` | The encoded coefficients preserve every ordering and bound the guide states (e.g. price elasticity Brazil > EU > US), and the advertising budget is a true interior optimum. |
| `rules-behaviour` | The rules change outcomes rather than sitting in a constants table — grade limit, office legality, tax timing, loss carry-forward, interest on positive balances, n-of-N potential. |
| `floor-contracts` | The cash floor is itemised and sourced; commitments are grade-aware and use the real production deadline (one quarter before delivery). |
| `contract-card` | The Decisions card asks for the tranche that is actually due, not the grouped total. |
| `plant-split-pipeline` | Chip vs computer plant declaration, and that the Decisions → Simulator handoff is not a dead end. |
| `strategist` | The AI strategist's output is parsed defensively and every number is re-derived by the engine; illegal plans are rejected. |
| `player-path` | **Walks the journey a team actually takes**, in order, and asserts each step hands something usable to the next — including mobile. This is the suite that catches what unit tests miss. |

## Why `player-path` exists

Two real bugs shipped past 108 green unit checks and were found within ten minutes of
walking the app by hand: a contract card that counted any chip grade toward an X3
commitment, and a grouped commitment that demanded double its quarterly amount. Unit
suites test the functions someone thought to test. This one retraces the actual route.
