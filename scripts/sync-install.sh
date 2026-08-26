#!/usr/bin/env bash
#
# Mirror this working tree over the installed copies of cantrips (Claude Code and Codex CLI).
#
# A plugin update only refreshes an install when the marketplace advertises a higher version, so
# edits that are not released yet never reach a global install. This copies them in the way an
# install would: everything but .git, over the version directory each harness currently holds.
# Harnesses cantrips is not installed in are skipped.

set -euo pipefail
shopt -s dotglob

repo=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
repo_version=$(jq -r '.["."]' "$repo/.release-please-manifest.json")
targets=()
harnesses=()

# Every target is checked before any is touched. A refusal raised halfway leaves the harness already
# mirrored holding whatever tree the aborted run came from, which is worse than refusing outright.
check_target() {
  local target="$1"

  # The target is about to be deleted, so make sure it is a plugin cache directory and nothing else.
  case "$target" in
    */plugins/cache/*/cantrips/*) ;;
    *) echo "Refusing to overwrite $target: not a plugin cache directory." >&2; exit 1 ;;
  esac

  # Both harnesses install by copying. A link here would mean rm -rf reaches through it.
  if [ -L "$target" ]; then
    echo "Refusing to overwrite $target: it is a link, not a copied install." >&2
    exit 1
  fi

  # This script ships into the install, so the shipped copy resolves repo to an install directory —
  # and mirroring one install over another would overwrite it from the wrong version's tree.
  if [ "$target" = "$repo" ]; then
    echo "Refusing to overwrite $target: it is this script's own checkout." >&2
    exit 1
  fi
}

mirror() {
  local target="$1" harness="$2" installed_version
  installed_version=$(basename "$target")

  if [ "$installed_version" != "$repo_version" ]; then
    echo "$harness: install is $installed_version, working tree is $repo_version — syncing into the $installed_version directory."
  fi

  rm -rf "$target"
  mkdir -p "$target"

  # An install copies the whole checkout minus .git; mirror that, dotfiles included.
  # .scratch is skipped too: a real install is a clone and never has one, and dev:fork-diff's
  # upstream cache lives there — mirroring it would ship other projects' skill trees.
  for entry in "$repo"/*; do
    case "${entry##*/}" in
      .git|.scratch) continue ;;
    esac

    cp -a "$entry" "$target/"
  done

  echo "$harness: synced working tree over $target."
}

# --- find the installs ----------------------------------------------------------------------------

# Claude Code records the exact install path, so read it rather than guessing the version.
claude_registry="$HOME/.claude/plugins/installed_plugins.json"

if [ -f "$claude_registry" ]; then
  claude_target=$(jq -r '.plugins["cantrips@cantrips"][0].installPath // empty' "$claude_registry")

  if [ -n "$claude_target" ]; then
    # The registry stores a native path; bash needs a POSIX one on Windows.
    if command -v cygpath >/dev/null; then
      claude_target=$(cygpath -u "$claude_target")
    fi

    targets+=("$claude_target")
    harnesses+=("Claude Code")
  fi
fi

# Codex records installs in ~/.codex/config.toml without the version, and `codex plugin list` fails
# outright when any configured marketplace is stale, so read the cache instead: highest version wins.
codex_cache="$HOME/.codex/plugins/cache/cantrips/cantrips"

if [ -d "$codex_cache" ]; then
  codex_version=$(ls -1 "$codex_cache" | sort -V | tail -n 1)

  if [ -n "$codex_version" ]; then
    targets+=("$codex_cache/$codex_version")
    harnesses+=("Codex CLI")
  fi
fi

if [ ${#targets[@]} -eq 0 ]; then
  echo "cantrips is not installed in either harness — install it, then re-run this task." >&2
  exit 1
fi

# --- check every target, then mirror every target ---------------------------------------------------

for i in "${!targets[@]}"; do
  check_target "${targets[$i]}"
done

for i in "${!targets[@]}"; do
  mirror "${targets[$i]}" "${harnesses[$i]}"
done

echo "Run /reload-plugins in a live Claude Code session, or start a new session, to load it."
