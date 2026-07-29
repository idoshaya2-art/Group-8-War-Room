#!/usr/bin/env bash
# Runs every suite. Exit code is non-zero if any suite fails.
cd "$(dirname "$0")"
fail=0
for t in dead-code audit-fixes decisions rules-coverage rules-orderings rules-behaviour floor-contracts contract-card \
         plant-split-pipeline strategist player-path sweep-pages sweep-regression; do
  node "$t.cjs" || fail=1
done
echo
if [ $fail -eq 0 ]; then echo "ALL SUITES GREEN"; else echo "SOME SUITES FAILED"; fi
exit $fail
