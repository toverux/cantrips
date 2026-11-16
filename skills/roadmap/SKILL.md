---
name: roadmap
description: Read or write this repo's roadmap, the list of planned and wanted work. Use when you meet a gap or an idea worth a roadmap item, or when asked what the roadmap holds or what to work on next.
argument-hint: '[an idea to file]'
version: 1.0.0
---

The repo's loop config, `docs/agents/cantrips-loop.md`, says where the roadmap lives in its `## Roadmap` section.

**Local file**, where the config has no such section or names it: the roadmap is the git-ignored `.scratch/ROADMAP.md`, read and edited directly.
Invoked with an idea, add it there as an entry; invoked bare, say there is no inbox to drain.

**GitHub issues**: run `node <this skill's directory>/scripts/roadmap.ts <command>`; its `--help` lists the commands.
Invoked with an idea in the user's own message, `search` the tracker on its key words; where an item already holds the idea, record a hit on it, otherwise `add` it at once.
[REFERENCE.md](REFERENCE.md) gives an item's shape, the labels, the hit format, and the plain `gh` to use where the script falls short.

**Mid-task**, meeting a candidate for this repo or another checked out on the machine: from the target's checkout, `park` it, its stdin written for a reader with none of your context, then carry on with your task, asking nothing.
Where `park` refuses naming a local roadmap file, add the entry there; for a repo not checked out here, or any other refusal, name the candidate in one line of your report.
