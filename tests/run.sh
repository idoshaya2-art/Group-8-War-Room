#!/usr/bin/env bash
# Runs every suite. Exit code is non-zero if any suite fails.
cd "$(dirname "$0")"
fail=0
for t in dead-code audit-fixes decisions rules-coverage rules-orderings rules-behaviour floor-contracts contract-card \
         plant-split-pipeline strategist player-path sweep-pages sweep-regression; do
  node "$t.cjs" || fail=1
done
# Audit-derived suites: each one pins a finding from docs/findings-v10.2.md to the behaviour its
# fix was verified against, so a later change cannot quietly reopen it.
for t in audit/wave1 audit/wave1-clean audit/wave2 audit/wave3 audit/wave4 audit/wave4-currency audit/wave5 audit/surfaces audit/rt_xss audit/planv6 audit/ingest audit/floor-overview audit/sale-goals audit/checklist audit/quarter-rollover; do
  node "$t.cjs" || fail=1
done
echo
if [ $fail -eq 0 ]; then echo "ALL SUITES GREEN"; else echo "SOME SUITES FAILED"; fi
exit $fail
