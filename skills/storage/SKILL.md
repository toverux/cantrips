---
name: storage
description: Mirror a feature folder one way to GitHub issues. Use only where the repo's loop config names /storage.
version: 1.0.0
---

On Claude Code, the plugin's Stop hook syncs every mirrored feature at each turn's end, and first publishes one once it holds a ticket.
Where the loop config says to sync a feature, its storage section names the tracker: `node <this skill's directory>/scripts/mirror.ts sync <feature folder> --tracker <owner/repo>` is that sync, the tracker needed on its first run only.
The sync closes the spec's issue once every ticket is resolved, and reopens it when one is added or no longer resolved.
Closing the feature: `close <feature folder>` closes the feature's issues still open, and needs `--done` or `--not-planned` where its tickets are not all resolved; delete the folder once it and any step it prints succeeded.
