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
Invoked with an idea in the user's own message, `search` the tracker on its key words; where an item already holds the idea, record a `hit` on it, otherwise `add` it at once.
A match closed as not planned takes a hit; one closed as completed does not: file the idea as a new item naming it.
[REFERENCE.md](REFERENCE.md) gives an item's shape, the labels, the hit format, how `/compound` drains, what a spec and a commit do with items, and the plain `gh` to use where the script falls short.

**Bare**, drain the inbox: `claim` it, merge the candidates that say the same thing, and judge each against the items its search found, or a `search` on its key words where that found none.
Settle a match at once with `hit --candidate`; propose everything else in this format, then settle each with `add --candidate` once approved, or `drop` it.
Settle every file a merge folded in.

```
1. **New issue on <owner/repo>** · `priority: medium` `cost: cheap` `<repo label>`
   <One plain sentence stating the item.>
   <One short sentence saying why it is worth tracking.>

2. **New issue on <owner/repo>** · no triage label
   <One plain sentence stating the item.>
   <One short sentence saying why it is worth tracking.>

3. **Hit on <owner/repo>#<N>** · <item title>
   <One plain sentence of evidence.>
   <One short sentence saying why it is the same item.>

Recorded without asking: a hit on <repo>#<N> (<item title>).
```

Where this session engaged a deputy through `/deputy` and has not dismissed it, what is put to the user here goes to the deputy instead, as [ROUNDS.md](../deputy/ROUNDS.md) says, and the deputy's reply is printed verbatim under a one-line header before anything acts on it; otherwise it goes to the user as written.
A proposed hit is one `hit` returned unposted; post it with `--approved` once approved.
The closing line lists the hits posted, naming a closed item's state, as `(<item title>, closed as not planned)`; leave it out where none was, and where hits were all the drain found, print it and ask nothing.

**Mid-task**, meeting a candidate for this repo or another checked out on the machine: from the target's checkout, `park` it, its stdin written for a reader with none of your context, then carry on with your task, asking nothing.
Where `park` refuses naming a local roadmap file, add the entry there; for a repo not checked out here, or any other refusal, name the candidate in one line of your report.
