# Fork divergence ledger

How this plugin relates to every skill of its two upstreams — [mattpocock/skills](https://github.com/mattpocock/skills) at v1.1.0 and [EveryInc/compound-engineering-plugin](https://github.com/EveryInc/compound-engineering-plugin) at compound-engineering-v3.20.0.
Every upstream skill has a section: a forked skill lists how it deliberately differs and why; the rest are marked "Not ported." with the reason where one is known.
Updated in the same edit that creates or ends a difference, whether a sync skips an upstream delta or a session rewrites a fork's own text; `/sync-upstream` keeps every listed difference standing without re-litigation.
An entry stays until the difference is gone.
Each fork's sync point lives in its own `source:` frontmatter; upstream credits live in [NOTICE.md](NOTICE.md).

## Systematic conventions

Differences every fork shares, recorded once; per-skill sections list only what goes beyond these.

- Renamed to this repo's skill name, with cross-skill references rewritten to this repo's names.
- Frontmatter reworked: `version` and `source` added, `description` rewritten, `disable-model-invocation` and `argument-hint` set per invocation mode.
- An `agents/openai.yaml` sidecar beside every SKILL.md.
- A closing flow pointer naming the next pipeline step(s).
- Agent-facing prose reflowed one sentence per line (AGENTS.md rule 6); carried passages otherwise stay byte-identical to upstream.
- Storage-touching steps speak the six storage verbs, translated per repo by the loop config (`docs/agents/cantrips-loop.md`, plugin defaults otherwise) — never a path or a CLI in the skill body.
- Reads and writes against the opt-in knowledge stores (`docs/adr/`, `docs/solutions/`) condition on the loop config enabling the store, so a repo that left one off gets no phantom read.

## mattpocock/skills

### /codebase-design (codebase-design)

- DESIGN-IT-TWICE.md step 2 opens "Spawn 3+ sub-agents, in parallel where the harness supports it (sequentially otherwise)" instead of upstream's "in parallel using the Agent tool" — this plugin ships to Codex CLI as well, where no Agent tool exists and fan-out may have to be sequential.
- DESIGN-IT-TWICE.md step 2 asks for "the project's domain glossary (the `AGENTS.md` glossary section or `CONCEPTS.md`, where present)" in the sub-agent brief instead of upstream's bare "CONTEXT.md vocabulary" — `CONTEXT.md` is an upstream-only file convention this repo lacks.

### /diagnosing-bugs (diagnosing-bugs)

- "Phase 0 — Search past learnings" added ahead of Phase 1, with no upstream counterpart — it opens the loop on `/compound`'s `docs/solutions/` store so a recorded root cause can short-circuit the diagnosis before any harness gets built.
- Upstream's opening `CONTEXT.md`-and-ADRs sentence not carried — this pipeline produces neither artifact, so the instruction would send the agent hunting for files that never exist.
- "hand off to the `/improve-codebase-architecture` skill" reworded to "recommend `/improve-codebase-architecture` (user-invoked)" — the fork's target is `disable-model-invocation: true`, so the agent can only recommend it, never hand off to it.

### /grilling (grilling)

- Upstream's "this plan" / "design tree" / "exploring the codebase" generalized to "this" / "decision tree" / "exploring the environment (filesystem, tools, etc.)" — the fork grills any plan, decision, or idea, code-related or not, so code- and design-specific framing would misdescribe its own trigger.
- Upstream's "Ask the questions one at a time… Asking multiple questions at once is bewildering." paragraph not carried as such — the one-at-a-time rule survives inside "How to ask" as a clause on each asking mode, and the rationale sentence went with the paragraph it justified.
- Upstream's "For each question, provide your recommended answer." replaced by the local "How to ask" section — sequential Q-numbering, lettered candidate answers with reasoning and tradeoffs first and the recommendation marked "(Recommended)", open questions asked openly, and the user's own remarks answered before the next question, because a bare "recommend an answer" left the interview's presentation unspecified.
- `/prototype` and `/research` proposed mid-interview when a decision needs empirical evidence or external facts — upstream has no sibling skills to hand an unresolvable question to.
- Upstream's "Do not enact the plan until I confirm we have reached a shared understanding." replaced by the local "## Closing" section — a checkable done-condition (every branch resolved), a one-sentence close with no summary, and a wait for go-ahead, since this fork ends in a pipeline handoff rather than in the agent enacting the plan itself.

### /handoff (handoff)

- Upstream's four flat instruction paragraphs restructured into a lead paragraph plus four constraint bullets, each compressed — the `/writing-great-skills` standard asks for leading words, scannable constraints, and positive phrasing.
- Added paragraph ruling a handoff out as a spec substitute, routing decisions that outlive the session into the feature's spec through the annotate-spec verb, or to `/compound` when the work has no spec — without it the skill invites durable decisions into a temp-directory file this pipeline never reads again.
- Added closing line requiring the document's path be reported back — a checkable completion criterion, and the user cannot point a fresh session at a temp-directory file whose path was never surfaced.

### /implement (implement)

- Body rewritten rather than carried; only the typechecking line is upstream bytes — upstream is five terse imperatives, and the fork has to name what a seam obliges, when a ticket resolves, and what "done" means.
- Opening fetches the spec or ticket through the fetch-spec / fetch-ticket verbs and requires it in full first, plus a ticket's parent spec — the fork's inputs come from `/spec` and `/tickets`, so the parent link is known.
- The `/tdd` sentence splits in two: TDD is driven at the seams the spec already approved without re-asking, and work with no agreed seam gets explicit verification criteria stated up front — upstream's "where possible, at pre-agreed seams" leaves both the mandate and the no-seam case undefined.
- Ticket acceptance criteria are ticked as each one is verified — `/tickets` writes checkbox criteria that nothing else closes out.
- A ticket whose criteria are all verified is resolved through the resolve-ticket verb, with the note that a wrong resolve is one human reopen away, while the spec itself is closed by no skill — upstream's terse imperatives carry no ticket lifecycle, and spec closure stays the human's act through the backend here.
- A checkable "done when" criterion replaces upstream's open-ended ending — the `/writing-great-skills` standard requires a verifiable finish.
- Upstream's "Commit your work to the current branch." not carried — committing is `/commit`'s user-gated step here, and AGENTS.md forbids a skill committing on its own.
- The review tail adds a `/review-gate` severity suggestion (low for a trivial or mechanical diff, high for a large or risky one, medium otherwise) and a `/handoff` fallback when context runs low — both keep the chain runnable in one session with the working diff as context, which renaming upstream's `/code-review` pointer alone would not.

### /improve-codebase-architecture (improve-codebase-architecture)

- The inline vocabulary enumeration — the seven terms and the three principles — not carried; the fork points at `/codebase-design` instead, since restating a referenced skill's glossary duplicates both the file the reader is about to load and HTML-REPORT.md's own "Use exactly" list.
- `CONTEXT.md` replaced throughout by the project's domain glossary (an `AGENTS.md` glossary section or `CONCEPTS.md`) — this pipeline's knowledge stores, set by `/compound` and echoed by `/tdd` and `/codebase-design`, have no `CONTEXT.md`.
- HTML-REPORT.md's "ADR callout" renamed "Settled-decision callout", and the settled decisions this scan must not re-litigate are read from whichever of `docs/adr/` and `docs/solutions/` the loop config enables — upstream assumes an always-present ADR tree, where both stores are opt-in here and a recorded rejection may sit in either.
- "Don't list every theoretical refactor an ADR forbids." not carried — the retained "only surface it when the friction is real enough to warrant revisiting the decision" already carries that constraint.
- A "Scope before you scan — YAGNI" block added, taking a user-named direction when given and otherwise reading `git log --oneline` for hot spots — deepening pays off only on code that keeps changing, so an undirected whole-codebase scan buries the return.
- "use the Agent tool with `subagent_type=Explore`" generalized to "dispatch an exploration subagent" — this plugin ships to two harnesses and `subagent_type=Explore` exists only in Claude Code.
- The instruction to run `/grilling` replaced by the grilling discipline stated inline, with a parenthetical that the user can invoke `/grilling` by name — `/grilling` is user-invoked here, so a skill cannot run it.
- The `/domain-modeling` side-effect block, including the offer to write an ADR, replaced by capture through `/compound` — this repo has no `/domain-modeling` skill, and `/compound` owns both glossary and `docs/solutions/` writes under a user gate.

### /prototype (prototype)

- Rule 6 rewritten from upstream's "Delete or absorb when done" to "Capture it when done" — a prototype is a primary source here, so it lands on a throwaway branch, with the branch pointer, verdict, and question delivered as a dated annotation on the feature's spec through the annotate-spec verb, falling back to the folding commit when no spec exists.
- Rule 4's closing "and then delete it" dropped — the same capture policy keeps the prototype rather than binning it.
- Upstream's closing "## When done" section not carried — the rewritten rule 6 and the flow pointer already say where the verdict goes (the annotate-spec verb), and upstream's ADR and `NOTES.md` destinations have no counterpart in that channel.
- LOGIC.md step 3's closing sentence rewritten to keep the pure-logic rationale without upstream's "the TUI shell gets deleted" — the shell survives on the throwaway branch under the capture policy.
- LOGIC.md step 7 retitled "Capture the answer and the prototype" and rewritten to defer to the SKILL's capture policy, absorbing upstream's "Don't ship the TUI shell into production" anti-pattern — the capture rule is stated once and referenced, not restated.
- LOGIC.md anti-patterns "Don't add tests" and "Don't wire it to the real database" not carried — both restate SKILL.md's "Skip the polish" and "No persistence by default" rules.
- UI.md step 6 rewritten so the winner folds into main and the losing variants move to the throwaway branch, with "The full set of variants is the primary source" replacing upstream's "Don't leave variant components or the switcher lying around" — same capture policy, phrased positively.
- UI.md anti-pattern "Variants that differ only in colour or copy" not carried — restates step 2's structural-difference requirement.

### /research (research)

No divergences beyond the systematic conventions.

### /resolving-merge-conflicts (resolving-merge-conflicts)

- Step 2's primary-source list ends by fetching the specs behind each change through the fetch-spec verb instead of upstream's "check original issues/tickets." — in this pipeline the recorded intent behind a change lives in the `/spec` artifact.

### /review-gate (code-review)

- Upstream's two fixed axes (Standards + Spec, two parallel sub-agents, reports aggregated verbatim) replaced wholesale by an effort-scaled finder/verifier pipeline — `low`/`medium`/`high`, correctness angles A–F, quality lenses, one independent verifier per location returning CONFIRMED/PLAUSIBLE/REFUTED, a `high`-only sweep, a ranked capped report with outcome tracking, `--fix` apply mode, and a no-sub-agent fallback — because independent verification of every candidate is what buys precision at `medium` and recall at `high`, which unverified side-by-side axis reports cannot.
- Findings are deduped, merged by root cause, ranked, and capped, reversing upstream's explicit "do not merge or rerank findings" and dropping its _Why two axes_ rationale section — the separation upstream protected with that rule is served here by finder isolation, so ranking no longer lets one axis mask another.
- The finder briefs live in siblings rather than inline in SKILL.md — the correctness angles in [ANGLES.md](skills/review-gate/ANGLES.md), the quality lenses in [QUALITY-LENSES.md](skills/review-gate/QUALITY-LENSES.md) — so each finder loads only its own angle or lens and the orchestrator never pays for briefs it does not use.
- QUALITY-LENSES.md is shared with `/simplify`, which reads three of its five lenses, and is the single source for what the two review paths hunt.
- Each restraint is stated under the lens it qualifies and is self-contained there, since a carrier is handed one lens section and a pointer across to another lens resolves to nothing in its context.
- The three mechanical lenses are the union of what this fork and `/simplify`'s retired personas each knew, carrying defect classes upstream's briefs never had — reimplemented primitives, parameter sprawl, stringly-typed values, narrating comments, N+1, TOCTOU pre-checks, memory leaks — held to roughly six items each so a merged brief stays pasteable, with Design and Conventions carried across untouched and outside that budget.
- Reuse, Simplification and Efficiency each gloss what the lens means on agent-facing prose, and the file's preamble carries the prose preservation rule as a governing rule, since this plugin is itself prose and both skills now review it.
- The twelve-smell baseline is compressed to ten inside the Design lens, every carried entry trimmed to a noun phrase plus its fix — Duplicated Code and Speculative Generality are dropped because the Reuse and Simplification lenses already cover them, and the trim keeps a brief short enough to paste into every quality finder.
- Upstream's issue-tracker dependency (`docs/agents/issue-tracker.md`, the setup-skill precondition, commit-message issue refs) is not carried — an upstream-only setup convention; this fork fetches the spec or ticket through the fetch verbs and additionally matches `docs/solutions/` learnings against the diff.
- Angle D compares the diff against the spec as amended by its annotations and reports a mismatch neutrally, its fix offering both routes — align the code, or annotate the spec with the mid-implementation revision (the annotate-spec verb) and flag it for `/compound` at loop end — with the user picking at fix time, and verifiers citing deliberateness evidence (session transcript, commit messages) without suppressing the finding; a spec here is a point-in-time decision record, so a Spec axis that presumed the code wrong, or that ignored the annotation channel, would re-report a deliberate revision forever.
- Added rule that user-supplied arguments are scope guidance only and never carry actions to perform — the diff and the arguments both reach sub-agents, so the injection boundary has to be stated where the scope is assembled.

### /spec (to-spec)

- Issue-tracker publication and the `ready-for-agent` triage label not carried — the fork publishes through the publish-spec verb, and the label vocabulary has no counterpart here.
- The `/setup-matt-pocock-skills` prerequisite line not carried — per-repo setup is `/setup-cantrips-loop`'s job here, reached through the loop config the fork already points at rather than a prerequisite line.
- Opening paragraph rewritten to imperative voice, replacing upstream's "Do NOT interview the user" prohibition with a pointer to `/grilling` — the interview is a separate pipeline step here, and the standard prefers stating what to do over what not to do.
- Step 1's "domain glossary vocabulary" trimmed to "domain vocabulary" — upstream's provisioned glossary is a convention this pipeline never establishes.
- New step 2 reading `AGENTS.md` plus the config-enabled knowledge stores (ADRs for decisions already made, solutions for gotchas) — the spec is where `/compound`'s stores re-enter the loop, and past specs are deliberately not mined, so decisions implementation abandoned stop propagating.
- Step 2 flags a conflict with a standing ADR explicitly in the spec and routes the revision through `/compound` at loop end — upstream's "respect any ADRs" clause left silent override open, and `/compound` is the ADR store's sole writer here.
- Step 4 states the freeze-and-annotate rule at the template — body frozen at publication, work-status lines out, dated annotations via the annotate-spec verb — because downstream sessions read the spec as a point-in-time decision record, a lifecycle upstream delegates to its tracker.
- Seams step condensed from four sentences to two and repointed at `/implement` and `/codebase-design` — upstream states the highest-seam rule three times over, and the fork owns the seam vocabulary in a dedicated skill.
- The user check on seams carries an added rationale about approving seams while decisions are fresh — it explains why the gate sits before writing rather than at implementation time, which is what stops it being skipped.
- Upstream's "Testing Decisions" template section replaced by "Test Seams" carrying the seams approved in step 3 — the fork's contract with `/implement` is the approved seam list, not a general description of what makes a good test.

### /tdd (tdd)

- Domain-vocabulary sentence rewritten to point at the `AGENTS.md` glossary section or `CONCEPTS.md` — upstream's `CONTEXT.md` and ADR conventions are files this repo does not carry.
- Seam definition gains "(full vocabulary: `/codebase-design`)" — this repo ships the deep-module vocabulary as its own skill, so the reference here stays one clause.
- "Test only at agreed seams" relaxed so seams the user already approved in `/spec` need no re-asking — the pipeline hands `/tdd` an approved spec, and upstream's unconditional confirmation would re-litigate it every cycle.
- Upstream's "Ask: 'What's the public interface, and which seams should we test?'" not carried — a scripted question the preceding paragraph already mandates, and no-op prompts are what `/writing-great-skills` prunes.
- "Bug fixes start red on the bug" paragraph added — `/diagnosing-bugs` routes fixes into `/tdd`, so the failing-repro-first rule has to be stated where the loop is defined.
- Refactoring pointer names `/simplify` and `/review-gate` as the review tail instead of upstream's single `code-review` skill — this repo splits that tail into two steps, so a rename alone would drop the second target.

### /teach (teach)

- Teaching Workspace file list reordered so the files appear in the order a session touches them — upstream interleaves the workspace's inputs and outputs arbitrarily.
- The `NOTES.md` bullet carries an example preference and a "refer back to it when designing lessons" clause, and upstream's trailing `## NOTES.md` section is not carried — the section only restated the bullet.
- The learning-records bullet drops upstream's "loosely equivalent to architectural decision records in software development" analogy and its `0001-<dash-case-name>.md` naming sentence — the numbering rule already lives in LEARNING-RECORD-FORMAT.md and the analogy earns nothing at the point of use.
- LEARNING-RECORD-FORMAT.md spells out "architectural decision records" where upstream writes "ADRs" — dropping the analogy from SKILL.md left the acronym with no expansion anywhere in the skill.
- Upstream's three consecutive "Each lesson should …" paragraphs are carried as one "Each lesson should:" bullet list — three parallel requirements scan as a list, not as prose.
- The Glossaries closing line links GLOSSARY-FORMAT.md — upstream ships the file but no upstream skill body points at it.
- LEARNING-RECORD-FORMAT.md writes `MISSION.md` and `GLOSSARY.md` as code spans where upstream uses `[[…]]` wiki-links — a teaching workspace is plain Markdown, not an Obsidian vault.

### /tickets (to-tickets)

- Ticket publication runs through the publish-tickets verb instead of upstream's issue-tracker conventions, and the spec is fetched through the fetch-spec verb the same way.
- Blocking edges ride the backend's native dependency links where it has them, each ticket's "Blocked by" prose otherwise — one breakdown serves a files-backed and a tracker-backed repo alike.
- The publish step ends "Publishing leaves the parent spec untouched." — upstream's "Do NOT close or modify any parent issue" prohibition, carried as the positive constraint this repo's authoring standard asks for, with the lifecycle rule itself stated once in `/implement`.

### /writing-great-skills (writing-great-skills)

- Second paragraph added, extending the principles to any file an agent loads and acts on (`AGENTS.md`, `CLAUDE.md`, rules files) and flagging Invocation as the one skill-specific section — this repo applies the standard to its own AGENTS.md and rules files, which upstream's skill-only framing leaves outside scope.
- "Pipeline closings" section added, pointing at the sibling [flow-pointers.md](skills/writing-great-skills/flow-pointers.md) — the pipeline skills here all end on a flow pointer, and the shared presentation format needs one authoritative home rather than a restatement in each skill.
  Its last line prescribes the pointer's verb-first wording, from an observed failure the section itself no longer names: an agent read the earlier `([presentation](…))` phrasing as a citation, never loaded the file, and invented a closing format.
- Upstream's `disable-model-invocation: true` dropped in favour of a trigger-rich description, making the fork model-invoked — the standard has to load before any agent-facing file is written, and a session that merely reads such files would otherwise never pull it in.

### ask-matt

Not ported. Personal to upstream's author.

### claude-handoff

Not ported. Upstream marks it in-progress; `/handoff` forks the finished variant.

### design-an-interface

Not ported. Deprecated upstream.

### domain-modeling

Not ported. Deferred in IDEAS.md; the AGENTS.md glossary section and its CONCEPTS.md graduation path (via `/compound`) cover the need.

### edit-article

Not ported. Personal to upstream's author.

### grill-me

Not ported. An earlier variant of grilling; this repo forks grilling instead.

### grill-with-docs

Not ported. A docs-driven grilling variant; `/grilling` plus `/research` cover it.

### git-guardrails-claude-code

Not ported. Harness configuration tooling outside the loop's scope.

### loop-me

Not ported. Upstream marks it in-progress.

### migrate-to-shoehorn

Not ported. Migration tooling for upstream's own stack.

### obsidian-vault

Not ported. Personal to upstream's author.

### qa

Not ported. Deprecated upstream.

### request-refactor-plan

Not ported. Deprecated upstream.

### scaffold-exercises

Not ported. Course-content tooling personal to upstream's author.

### setup-matt-pocock-skills

Not ported. Provisions upstream's tracker and label conventions; per-repo setup is `/setup-cantrips-loop`'s job here.

### setup-pre-commit

Not ported. Check tooling outside the loop's scope.

### triage

Not ported. Needs an issue tracker and an inbound issue flow; deferred in IDEAS.md.

### ubiquitous-language

Not ported. Deprecated upstream.

### wayfinder

Not ported. A local-files adaptation is sketched in IDEAS.md; adopt when a decision surface outgrows `/grilling` → `/spec`.

### wizard

Not ported. Upstream marks it in-progress.

### writing-beats

Not ported. Upstream marks it in-progress.

### writing-fragments

Not ported. Upstream marks it in-progress.

### writing-shape

Not ported. Upstream marks it in-progress.

## EveryInc/compound-engineering-plugin

### /commit (ce-commit)

- Step 4 body discipline rewritten: the body states the problem and why this approach, plain and self-contained, and the session's process (attempts, verification) dies with the session — upstream-style open-ended guidance produced verbose session-narrative bodies.
- Step 1's compound-candidate scan added — with a diff-review stop on `/compound`'s written prose before it enters a commit, since the destination gate clears a one-line proposal, not the document — along with the loop-closing frame around it (the opening line, Step 5's note that learning writes form their own `docs`-type commit, and the closing "learnings captured, committed" paragraph) — `/commit` closes this repo's engineering loop and must leave the tree clean including `/compound`'s writes, which upstream's single-purpose commit skill has no equivalent for.
- Step 3's branch choice defers to the repo's own workflow, committing in place where history is trunk-based — upstream mandates cutting a feature branch whenever the current branch is the default and forbids asking, which is upstream's workflow, not a universal one.
- Upstream's detached-HEAD blocking-question machinery not carried — it enumerates four harnesses' question tools and their fallback rules, whereas the fork asks the question once and lets the harness supply the mechanism.
- Upstream's `gh repo view --json defaultBranchRef` fallback not carried — `git rev-parse` plus a `main` default resolves the branch without adding a `gh` dependency to the skill.
- The body is a condensed rewrite in this repo's voice: the H1 and the standalone Context table are gone, upstream's Context section and its redundant "Step 1: Gather context" are merged into one Step 2 bullet list — the fork gets leaner than upstream, never heavier.
- Upstream's "Other types remain primary when they fit better. The user may override for a specific change." and "Do not re-read these files; they are loaded at session start." not carried — the first restates the priority list already given, the second is a no-op instruction.
- A "Formatting details" bullet added, deferring wrapping, trailers, and sign-offs to the repo's documented rules and the user's global instructions — the plugin must stay distributable, so per-user commit-message habits belong outside the skill body.

### /compound-refresh (ce-compound-refresh)

- The whole body is an original-words reimplementation, not carried text — upstream's 680-line phased workflow (Phases 0–5 with mode detection) condenses to a 68-line audit loop, so no passage is under byte-identical carriage.
- A second store is audited: the project's `AGENTS.md`, through a bloat / contradictions / staleness lens held to `/writing-great-skills` — upstream audits `docs/solutions/` only.
- Four verdicts instead of upstream's five, with Replace folded into Update — the fork's Update already covers rewriting a contradicted fix to the current truth and presenting it as the rewrite it is.
- Headless mode (`mode:headless`, stale-marking via `status`/`stale_reason`/`stale_date`) not carried — every change in this pipeline is user-gated, and the fork's format contract defines no such frontmatter fields.
- Upstream's interaction principles and per-harness blocking-question machinery not carried — the fork presents verdicts for approval in plain prose.
- The pattern-doc tier (`docs/solutions/patterns/`, Phase 1.5, Pattern Guidance) and the `_archived/` legacy cleanup not carried — [solutions-format.md](skills/compound/solutions-format.md) defines one flat directory with no derived tier and no archive.
- Scope matching is filename, then `area`/`tags`, then content keyword — this repo's frontmatter has `area` and `tags` where upstream has `module`, `component`, and category subdirectories.
- The `CONCEPTS.md` vocabulary machinery (bootstrap disambiguation, Phase 4.5, the discoverability checks) reduces to a single pointer — `/compound` owns the glossary-graduation convention here.
- The subagent strategy (investigation versus replacement roles, parallelization tables) not carried — orchestration is the harness's business, not the skill's.
- Phase 5's commit flow (branch/PR decision tables, commit-message rules) not carried — `/commit` owns landing changes, and the fork closes by pointing at it.
- Upstream's `assets/` and `references/` not bundled — they encode a richer doc schema (`problem_type`, `component`, `severity` enums, resolution templates) that [solutions-format.md](skills/compound/solutions-format.md) supersedes.
- Upstream's `scripts/` not bundled — the two Python validators would reintroduce a dependency and a check step this repo deliberately lacks, and there is no enum schema left to validate.
- `AGENTS.md` is audited unconditionally while the opt-in `docs/adr/` store gets no garbage collection — supersession is the ADR store's own hygiene mechanism.

### /simplify (ce-simplify-code)

- Body rewritten in this repo's lean voice — one sentence per line, Steps 1, 4 and 5 condensed — while the model-selection paragraph merged from upstream stays byte-identical.
- The three reviewer personas and `references/personas/` are gone, the hunt taxonomy having moved into the shared [QUALITY-LENSES.md](skills/review-gate/QUALITY-LENSES.md) that `/review-gate` reads too, with the fixer preamble each persona separately repeated now stated once in the body and paired with a single lens at dispatch — upstream and this fork maintained the same three dimensions in two separately-authored texts that had already drifted apart in both directions, so refining either meant editing both or letting the gap widen.
- Upstream persona deltas are consequently evaluated as content candidates for the shared lens file and rewritten in this repo's voice, never merged back as text.
- Upstream's code-reuse rule 5 and code-quality rule 3, previously held byte-identical, are compressed into that file's Reuse lens and its restraints and no longer diff clean, every constraint they imposed surviving and only the GraphQL-projection specifics dropped as one vendor's worked example — the lens file holds the authoritative wording, so a future sync reconciles against it rather than against this entry.
- The preservation contract is two-limbed and hoisted above Step 1 so it governs every step rather than only the fix loop, keeping upstream's exact-behavior test for code and adding, for agent-facing prose, one upstream has no counterpart to because its scope gate refuses prose outright: the instruction set is what is preserved, so repetition and sediment may go while no directive, prohibition, gate or completion criterion may be cut or weakened, and a sentence of uncertain kind stays.
- That prose rule is also carried as a governing rule in QUALITY-LENSES.md, so `/review-gate --fix` is bound by it when it applies a quality finding to prose.
- The scope preflight admits agent-facing prose — skills, `AGENTS.md`/`CLAUDE.md`, rules files — where upstream refuses documentation-only diffs, leaving human-facing documentation excluded by default and reachable through the existing named-scope escape, because upstream's gate was written for code repositories while this plugin is itself prose and a blank invocation here bailed on exactly the material most worth passing over.
- Step 4 verifies per material rather than per diff, running the code checks over code and, over prose, a diff-read of every line the pass removed or reworded — a consequence of the widened gate, since upstream's typecheck/lint/test step has nothing to check on prose and re-reading the post-pass file cannot reveal an instruction the pass cut.
- The safety-check prohibition gains its prose analogue: a gate or a prohibition is a safety check.
- "Structure pins" paragraph not carried — tied to ce-plan's `session-settled:` plan convention; nothing in this pipeline passes a plan to `/simplify`.
- Task-tracking paragraph and the ce-work/lfg size-gate parenthetical not carried — harness housekeeping and upstream-only callers.
- "Bounded dispatch" paragraph not carried — queueing and active-agent-limit backpressure are the harness's business, and three fixed reviewers never reach the limit.
- "Permission mode" paragraph not carried — no dispatch primitive here takes a `mode` parameter, so telling the agent to omit it is a no-op.
- Upstream's per-harness tool enumerations not carried — the blocking-question tools in Step 1 and the subagent primitives in Step 2 — no skill in this repo names harness tools, and such names go stale.
- Step 5's worked example ("Applied 6 — reuse 2, quality 3, efficiency 1…") not carried — the per-dimension instruction already fixes the report shape, and sample figures invite mimicry.

### ce-babysit-pr

Not ported. GitHub PR shepherding; deferred in IDEAS.md until work routinely ships through reviewed PRs.

### ce-brainstorm

Not ported. Part of CE's autonomous outer loop (IDEAS.md); `/grilling` covers exploratory framing with the user in the loop.

### ce-code-review

Not ported. `/review-gate` (forked from Pocock's code-review) is this pipeline's review step.

### ce-commit-push-pr

Not ported. The loop ends at `/commit`; pushing and PRs stay user-driven.

### ce-compound

Not ported. Reimplemented from scratch as the original `/compound`.

### ce-debug

Not ported. `/diagnosing-bugs` (forked from Pocock) covers diagnosis.

### ce-doc-review

Not ported. Every-specific editorial workflow.

### ce-dogfood

Not ported. Every-specific dogfooding workflow.

### ce-explain

Not ported.

### ce-handoff

Not ported. `/handoff` (forked from Pocock) covers session handoff.

### ce-ideate

Not ported. Every-specific product workflow.

### ce-optimize

Not ported.

### ce-plan

Not ported. Part of CE's outer loop (IDEAS.md); `/spec` is this pipeline's plan artifact.

### ce-polish

Not ported.

### ce-pov

Not ported. Every-specific editorial workflow.

### ce-product-pulse

Not ported. Every-specific product workflow.

### ce-promote

Not ported. Every-specific editorial workflow.

### ce-proof

Not ported. Every-specific editorial workflow.

### ce-resolve-pr-feedback

Not ported. GitHub PR lifecycle; deferred in IDEAS.md with ce-babysit-pr.

### ce-riffrec-feedback-analysis

Not ported. Every-specific product workflow.

### ce-setup

Not ported. Per-repo setup is `/setup-cantrips-loop`'s job here.

### ce-strategy

Not ported. Every-specific product workflow.

### ce-sweep

Not ported.

### ce-test-browser

Not ported. Platform-specific test harness outside the loop's scope.

### ce-test-xcode

Not ported. Platform-specific test harness outside the loop's scope.

### ce-work

Not ported. Part of CE's outer loop (IDEAS.md); `/implement` executes with the user in the loop.

### ce-worktree

Not ported. Harness workflow tooling outside the loop's scope.

### lfg

Not ported. CE's hands-off ship-to-PR wrapper; deferred in IDEAS.md as a possible autonomous tier.
