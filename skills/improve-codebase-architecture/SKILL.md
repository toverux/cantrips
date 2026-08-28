---
name: improve-codebase-architecture
description: Scan a codebase for deepening opportunities, present them as a visual HTML report, then grill through whichever one you pick.
disable-model-invocation: true
version: 1.2.1
source: mattpocock/skills@1.2.0 (improve-codebase-architecture)
---

# Improve Codebase Architecture

Surface architectural friction and propose **deepening opportunities** — refactors that turn shallow modules into deep ones. The aim is testability and AI-navigability.

Built on a shared design vocabulary: run `/codebase-design` first and use its terms and principles exactly in every suggestion.
Where the project keeps a domain glossary (an `AGENTS.md` glossary section or `CONCEPTS.md`), its terms give names to good seams.

## Process

### 1. Explore

**Scope before you scan — YAGNI.** Deepening a module pays off by making future changes to it easier, so put extra weight on the parts of the codebase that have recently changed. Decide *where* to look before you look:

- If the user named a direction — a module, a subsystem, a pain point — take it, and skip the inference below.
- Otherwise, walk back a good stretch of the commit history (`git log --oneline`) to find the codebase's hot spots — the files and areas that keep coming up — and let those paths pull your attention first. If the changes are scattered with no clear hot spot, widen the net.

Read the project's domain glossary first, then — for whichever of the two stores the loop config enables — search `docs/adr/` for standing decisions and `docs/solutions/` for learnings and recorded rejections in the area: decisions already settled there should not be re-litigated.
The loop config is `docs/agents/cantrips-loop.md`; when that doc is absent, both stores are off and neither search runs.

Then dispatch an exploration subagent to walk the codebase, in the background where the harness supports it (Claude Code: do not use `run_in_background: false`). Don't follow rigid heuristics — explore organically and note where you experience friction:

- Where does understanding one concept require bouncing between many small modules?
- Where are modules **shallow** — interface nearly as complex as the implementation?
- Where have pure functions been extracted just for testability, but the real bugs hide in how they're called (no **locality**)?
- Where do tightly-coupled modules leak across their seams?
- Which parts of the codebase are untested, or hard to test through their current interface?

Apply the **deletion test** to anything you suspect is shallow: would deleting it concentrate complexity, or just move it? A "yes, concentrates" is the signal you want.

### 2. Present candidates as an HTML report

Write a self-contained HTML file to the OS temp directory so nothing lands in the repo. Resolve the temp dir from `$TMPDIR`, falling back to `/tmp` (or `%TEMP%` on Windows), and write to `<tmpdir>/architecture-review-<timestamp>.html` so each run gets a fresh file. Open it for the user — `xdg-open <path>` on Linux, `open <path>` on macOS, `start <path>` on Windows — and tell them the absolute path.

The report uses **Tailwind via CDN** for layout and styling, and **Mermaid via CDN** for diagrams where a graph/flow/sequence reliably communicates the structure. Mix Mermaid with hand-crafted CSS/SVG visuals — use Mermaid when relationships are graph-shaped (call graphs, dependencies, sequences), and hand-built divs/SVG when you want something more editorial (mass diagrams, cross-sections, collapse animations). Each candidate gets a **before/after visualisation**. Be visual.

For each candidate, render a card with:

- **Files** — which files/modules are involved
- **Problem** — why the current architecture is causing friction
- **Solution** — plain English description of what would change
- **Benefits** — explained in terms of locality and leverage, and how tests would improve
- **Before / After diagram** — side-by-side, custom-drawn, illustrating the shallowness and the deepening
- **Recommendation strength** — one of `Strong`, `Worth exploring`, `Speculative`, rendered as a badge

End the report with a **Top recommendation** section: which candidate you'd tackle first and why.

**Use the project's domain glossary for the domain, and the `/codebase-design` vocabulary for the architecture.** If the glossary defines "Order," talk about "the Order intake module" — not "the FooBarHandler," and not "the Order service."

**Settled-decision conflicts**: if a candidate contradicts a decision recorded in an enabled store — a `docs/adr/` record or a `docs/solutions/` rejection — only surface it when the friction is real enough to warrant revisiting the decision. Mark it clearly in the card (e.g. a warning callout: _"contradicts a recorded rejection — but worth reopening because…"_).

See [HTML-REPORT.md](HTML-REPORT.md) for the full HTML scaffold, diagram patterns, and styling guidance.

Do NOT propose interfaces yet. After the file is written, ask the user: "Which of these would you like to explore?"

### 3. Grilling loop

Once the user picks a candidate, run the `/grilling` skill to walk the decision tree with them — constraints, dependencies, the shape of the deepened module, what sits behind the seam, what tests survive.

Side effects happen inline as decisions crystallize — capture the durable ones through `/compound`:

- **A deepened module named after a term missing from the domain glossary, or a fuzzy term sharpened during the conversation** — a glossary candidate.
- **The user rejects a candidate with a load-bearing reason** — capture it so future architecture reviews don't re-suggest the same thing.
  Skip ephemeral reasons ("not worth it right now") and self-evident ones.

The interview hands back here rather than closing itself, so this step owns the close.
Close with a flow pointer (read [flow-pointers.md](../writing-for-agents/flow-pointers.md) for the format), picking by what the interview settled: `/codebase-design` when alternative interfaces for the deepened module are still worth exploring — its design-it-twice parallel sub-agent pattern surfaces the options; `/spec` (user-invoked) when the deepening is a change worth a written contract; `/implement` (user-invoked) when it is small enough to go straight in.
Where the interview ended in a rejection, the capture above is the outcome — say so and offer this skill again on the next candidate.
