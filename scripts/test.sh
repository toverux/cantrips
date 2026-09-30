#!/usr/bin/env bash
#
# Run the tests of the scripts shipped inside skills. They gate nothing: see AGENTS.md.
#
# Node needs 22.18 or later, the first release that runs TypeScript without a flag.

set -euo pipefail

repo=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
exec node --test "$@" "$repo/skills/*/scripts/*.test.ts"
