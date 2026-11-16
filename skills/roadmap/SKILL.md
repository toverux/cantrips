---
name: roadmap
description: Read or write this repo's roadmap, the list of planned and wanted work. Use when you meet a gap or an idea worth a roadmap item, or when asked what the roadmap holds or what to work on next.
version: 1.0.0
---

The repo's loop config, `docs/agents/cantrips-loop.md`, says where the roadmap lives in its `## Roadmap` section.
Where it has none, the roadmap is the git-ignored local file `.scratch/ROADMAP.md`: read and edit it directly.

On the GitHub backend, run `node <this skill's directory>/scripts/roadmap.ts <command>`; its `--help` lists the commands.
Where the script falls short, use plain `gh` on the tracker the config names.
