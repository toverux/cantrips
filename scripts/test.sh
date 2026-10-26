#!/usr/bin/env bash
#
# Run the tests of the scripts shipped inside skills and of the loop panel mod. They gate nothing:
# see AGENTS.md.
#
# Node needs 22.18 or later, the first release that runs TypeScript without a flag; it runs the
# skill scripts' tests and the mod's pure core (tests/mod). The mod's mounted scenarios run under
# `claude plugin test`, which needs the claude binary on PATH; without it they are skipped with a
# notice. Arguments go to node --test.

set -euo pipefail

repo=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
node --test "$@" "$repo/skills/*/scripts/*.test.ts" "$repo/tests/mod/*.test.ts"

if command -v claude >/dev/null 2>&1; then
  claude plugin test "$repo/mod"
else
  echo "claude is not on PATH: the mod's mounted scenarios (claude plugin test mod) were skipped" >&2
fi
