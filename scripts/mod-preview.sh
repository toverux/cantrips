#!/usr/bin/env bash
#
# Start the loop panel's preview: a detached tmux session running Claude Code on this working tree
# with the plugin loaded from it and the project setting source only, so the installed cantrips
# stays out and the engine hot-reloads the mod after each save. It runs on Haiku, since driving the
# pane exercises the mod rather than the model; arguments go to claude, a `--model` among them
# overriding it.
#
# Read the pane as text with `tmux capture-pane -p -t cantrips-mod`; type into it with
# `tmux send-keys -t cantrips-mod -l '<text>'` and, after a pause, `tmux send-keys -t cantrips-mod
# Enter`, since text and Enter in one call land in the typeahead; attach with `tmux attach -t
# cantrips-mod`.

set -euo pipefail

repo=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
session=cantrips-mod

if tmux has-session -t "=$session" 2>/dev/null; then
  echo "the preview session '$session' is already running; attach with: tmux attach -t $session"
  exit 0
fi

# 160 columns: wide enough for the engine to dock an unasked pane (144), and for a band beside it.
tmux new-session -d -s "$session" -x 160 -y 48 -c "$repo" \
  claude --plugin-dir "$repo" --setting-sources project --model haiku "$@"

echo "started the preview session '$session' on $repo"
echo "  attach: tmux attach -t $session"
echo "  read:   tmux capture-pane -p -t $session"
echo "  type:   tmux send-keys -t $session -l '/cantrips'; sleep 1; tmux send-keys -t $session Enter"
