#!/usr/bin/env bash
# Version: 1.0.0
#
# PostToolUse hook: warns the agent when a source file it just edited has lines exceeding the 100-character limit from
# the general-code-style rule.
# Exits with code 2 so the warning (offending line numbers) is fed back to the agent to fix.
#
# The limit has exceptions (see general-code-style). Two are handled mechanically:
#  - One-line lint warning suppression comments (skipped, see the awk filter).
#  - Markdown docs meant for agents (never checked; not a source extension).
# The rest are judgment calls a hook cannot detect reliably, so the warning names them and leaves the decision to the
# agent:
#  - Long strings that do not make sense to split.
#  - Any file where the limit is not applicable or desirable.
#
# Per-project configuration via environment variables (defaults target JS/TS):
#  - CHECK_LINE_LENGTH_EXTENSIONS: space-separated extensions to check, no dots.
#  - CHECK_LINE_LENGTH_SUPPRESSION: extended regex (ERE) matching one-line suppression directives to exempt; empty
#    disables the exemption.
#    Ex. for C#: "#pragma warning disable|ReSharper disable".
#
# Note: awk's `length` may count bytes rather than characters on some awk builds.
# Assumes spaces-indented, ASCII-only source, so byte count and column count coincide in practice.

extensions=${CHECK_LINE_LENGTH_EXTENSIONS:-"ts tsx js jsx mjs cjs"}
suppression=${CHECK_LINE_LENGTH_SUPPRESSION:-"oxlint-disable|eslint-disable|biome-ignore|@ts-expect-error|@ts-ignore"}

# Hook payload is JSON on stdin. Never block the tool on a parse/read issue.
file_path=$(jq -r '.tool_input.file_path // empty' 2>/dev/null) || exit 0
[ -n "$file_path" ] || exit 0

# Skip files whose extension is not in the configured list.
filename=${file_path##*/}
case "$filename" in
  *.*) ;;
  *) exit 0 ;;
esac
file_ext=${filename##*.}
file_ext=${file_ext,,}

matched=0
for ext in $extensions; do
  if [ "$file_ext" = "$ext" ]; then
    matched=1
    break
  fi
done
[ "$matched" -eq 1 ] || exit 0

[ -f "$file_path" ] || exit 0

# Collect 1-based line numbers exceeding the limit, skipping suppression directives.
offending=$(awk -v pat="$suppression" '
  length > 100 && !(pat != "" && $0 ~ pat) {
    numbers = numbers (numbers == "" ? "" : ", ") NR
  }
  END { print numbers }
' "$file_path")

[ -n "$offending" ] || exit 0

count=$(printf '%s' "$offending" | awk -F', ' '{ print NF }')
if [ "$count" -eq 1 ]; then
  noun=line verb=exceeds pronoun=it
else
  noun=lines verb=exceed pronoun=them
fi

{
  printf '%s: %s %s %s the 100-character limit. Offending %s: %s.\n' \
    "$file_path" "$count" "$noun" "$verb" "$noun" "$offending"
  printf 'Wrap or shorten %s, unless the excess is an unsplittable string or an exempt file.\n' \
    "$pronoun"
} >&2

exit 2
