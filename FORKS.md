# Fork divergence ledger

How this plugin relates to every skill of its two upstreams — [mattpocock/skills](https://github.com/mattpocock/skills) at v1.2.0 and [EveryInc/compound-engineering-plugin](https://github.com/EveryInc/compound-engineering-plugin) at compound-engineering-v3.21.2.
Every upstream skill has a section: a forked skill lists how it deliberately differs and why — a wholesale rewrite's section naming the divergences worth recording rather than every one there is — and the rest are marked "Not ported." with the reason where one is known.
Updated in the same edit that creates or ends a difference, whether a sync skips an upstream delta or a session rewrites a fork's own text; `/sync-upstream` keeps every listed difference standing without re-litigation, save a divergence whose bullet offers no justification beyond house formatting — that class its audit may re-propose until the bullet records a reason.
That standing is anchored, not permanent: a listed difference stands for as long as the upstream text its bullet was anchored to survives, and once upstream rewrites that text the delta is judged afresh.
An entry stays until the difference is gone.
One sync policy lives here because it describes no divergence in any fork's text: upstream deltas to `/simplify`'s retired persona files are evaluated as content candidates for the shared lens file ([QUALITY-LENSES.md](skills/review-gate/QUALITY-LENSES.md)) and rewritten in this repo's voice, never merged back as text.
A section's "Verified against `<tag>`." line means a diff against that tag was actually run on it: for a carried fork, the hunk↔bullet correspondence was checked both ways; for a wholesale rewrite, only the weaker check — every bullet names a real difference and every byte-identity claim holds — which cannot see a divergence no bullet describes.
An annotated stamp, "Verified against `<tag>`. — `<reason>`.", weakens that claim by its reason — `<n> findings unresolved` for a section whose findings a sync deferred or held back, `not fully compared: <what>` for one a sync could not fully measure, the two chained `;`-separated where both hold — and a later refresh carries the annotation forward until its cause is resolved.
Each fork's sync point lives in its own `source:` frontmatter — the per-fork truth, which may lag the preamble's pin where a sync could not measure that fork at the new tag; upstream credits live in [NOTICE.md](NOTICE.md).

## Systematic conventions

Differences every fork shares, recorded once; per-skill sections list only what goes beyond these.

- Renamed to this repo's skill name, with cross-skill references rewritten to this repo's names.
- Frontmatter reworked: `version` and `source` added, `description` rewritten where the invocation mode needs it, `disable-model-invocation` and `argument-hint` set per invocation mode.
- An `agents/openai.yaml` sidecar beside every SKILL.md.
- A closing flow pointer naming the next pipeline step(s), where the fork hands on to one.
  Where a review-tail pointer leads into `/review-gate`, it offers `[--fix | --loop]` with a clause on when to take each — the fork's gate has an apply mode and a converge-until-green mode with no upstream counterpart ([docs/research/review-fix-looping-upstream.md](docs/research/review-fix-looping-upstream.md)), and the review tail is where a user chooses between them.
  A pointer with a settled answer names its flag outright instead, as `/review-gate --loop` does when the loop itself stops short of green.
- Prose written here goes one sentence per line (AGENTS.md rule 8); a carried passage keeps upstream's line breaks.
- Storage-touching steps speak the six storage verbs, translated per repo by the loop config (`docs/agents/cantrips-loop.md`, plugin defaults otherwise) — never a path or a CLI in the skill body.
- Reads and writes against the opt-in knowledge stores (`docs/adr/`, `docs/solutions/`) condition on the loop config enabling the store, so a repo that left one off gets no phantom read.
- Every sub-agent dispatch asks for a background dispatch where the harness supports one and names the Claude Code parameter that gets it wrong (`run_in_background: false`) — no upstream says this, and a blocking dispatch freezes the session for as long as the agent runs.
  This is the one place a skill body names a harness parameter, because the degradation is invisible from inside the skill and no harness-neutral wording reaches it.

## mattpocock/skills

### /codebase-design (codebase-design)

Verified against `v1.2.0`.

- DESIGN-IT-TWICE.md step 2 opens "Spawn 3+ sub-agents, in parallel where the harness supports it (sequentially otherwise)" instead of upstream's "in parallel using the Agent tool" — this plugin ships to Codex CLI as well, where no Agent tool exists and fan-out may have to be sequential.
- DESIGN-IT-TWICE.md step 2 asks for "the project's domain glossary (the `AGENTS.md` glossary section or `CONCEPTS.md`, where present)" in the sub-agent brief instead of upstream's bare "CONTEXT.md vocabulary" — `CONTEXT.md` is an upstream-only file convention this repo lacks.

### /diagnosing-bugs (diagnosing-bugs)

Verified against `v1.2.0`.

- "Phase 0 — Search past learnings and decisions" added ahead of Phase 1 — its solutions search has no upstream counterpart, opening the loop on `/compound`'s `docs/solutions/` store so a recorded root cause can short-circuit the diagnosis before any harness gets built.
- Upstream's opening `CONTEXT.md`-and-ADRs sentence is adapted into Phase 0 rather than carried: its `CONTEXT.md` mental-model read is dropped outright, not retargeted — `CONTEXT.md` is an upstream-only file convention this repo lacks — and the ADR check becomes a read of the loop-config-gated ADR store, so the fix is designed against the standing decisions without a phantom read where the store is off.
- "hand off to the `/improve-codebase-architecture` skill" reworded to "recommend `/improve-codebase-architecture` (user-invoked)" — the fork's target is `disable-model-invocation: true`, so the agent can only recommend it, never hand off to it.

### /grilling (grilling)

Verified against `v1.2.0`.

- The `description`'s "Use when" half is rewritten beyond what the systematic frontmatter rework covers — upstream triggers on stress-testing "or uses any 'grill' trigger phrases", the fork on being grilled about a plan, a decision stress-tested, or requirements fuzzy before a spec is written — `/grilling` opens this loop, and the fuzzy-requirements trigger is what fires it ahead of `/spec`, a pipeline position upstream's skill does not hold.
- Upstream's "design tree" is a "decision tree" throughout — the fork grills any plan, decision, or idea, code-related or not, so design-specific framing would misdescribe its own trigger.
- A rule carried over from the fork's retired "How to ask" section: a question or remark inside the user's answers is answered before the next round opens — upstream's rounds model says nothing about the reply direction, and a fresh round is exactly what buries a reply.
- `/research` proposed mid-interview when a frontier fact lives in external docs rather than the environment — upstream ships the skill but its grilling routes to it nowhere, leaving the user to remember it exists; here `/grilling` is a pipeline step, so it names the next one.
- Question numbers run sequentially across the whole interview rather than restarting each round — upstream's rounds model says only "number each question", and per-round numbering makes an answer naming "Q2" ambiguous once a third round exists.
- Presented questions are locked (revisable only by user feedback) and every interview message ends with its new questions plus a one-line tally of the numbers still open — upstream has no stability rule, and in practice returning sub-agents read as license to amend presented questions in prose, leaving the user to reconcile a round scattered across messages.
- The downstream test for a running exploration is spelled out (a question whose wording the report could change is held; in doubt, hold) — the fork's own earlier "only the questions downstream of it wait" was applied by vibes, shipping questions whose bodies cited the pending result and guaranteeing their revision.
- When an exploration reports, its findings get one short paragraph and fold into the questions they unblock, a finding that bears on a locked question staying commentary while the question stands as asked — upstream says nothing about how a report re-enters the interview, and the lock rule needs the return path stated, a returning report otherwise reading as license to amend presented questions.
- Upstream's closing sentence keeps its frontier-empty done condition, but the fork's "## Closing" section adds the one-sentence close with no summary, the flow pointer, and the wait for go-ahead — this fork ends in a pipeline handoff rather than in the agent enacting the plan itself.
  That section also carries a hand-back branch for an interview another skill invoked, so the callee stops owning the close — `/improve-codebase-architecture` runs the interview mid-step and has work left after it, which upstream's grilling, having no in-repo caller, never had to allow for.
- A fifth closing branch offering `/questionnaire` when the unresolved fact is held by a person rather than published anywhere — it completes the out-of-the-room case the `/research` branch opens, and it alone names when its answer arrives, since a recipient replies on their own clock while every other branch resolves in session.

### /handoff (handoff)

Verified against `v1.2.0`.

- Upstream's "Do not duplicate content already captured in other artifacts" paragraph flipped to positive phrasing, referencing them by path or URL rather than duplicating — not a hard guardrail, so the `/writing-for-agents` standard phrases it by its positive target.
- Added paragraph ruling a handoff out as a spec substitute, routing decisions that outlive the session into the feature's spec through the annotate-spec verb, or to `/compound` when the work has no spec — without it the skill invites durable decisions into a temp-directory file this pipeline never reads again.
- Added closing line requiring the document's path be reported back — a checkable completion criterion, and the user cannot point a fresh session at a temp-directory file whose path was never surfaced.

### /implement (implement)

Verified against `v1.2.0`.

- Body rewritten rather than carried; only the typechecking line is upstream bytes.
- Opening fetches the spec or ticket through the fetch-spec / fetch-ticket verbs and requires it in full first, plus a ticket's parent spec — the fork's inputs come from `/spec` and `/tickets`, so the parent link is known.
- The `/tdd` sentence splits in two: TDD is driven at the seams the spec already approved without re-asking, and work with no agreed seam gets explicit verification criteria stated up front — upstream's "where possible, at pre-agreed seams" leaves both the mandate and the no-seam case undefined.
- Ticket acceptance criteria are ticked as each one is verified — `/tickets` writes checkbox criteria that nothing else closes out.
- A ticket whose criteria are all verified is resolved through the resolve-ticket verb, with the note that a wrong resolve is one human reopen away, while the spec itself is closed by no skill — upstream's terse imperatives carry no ticket lifecycle, and spec closure stays the human's act through the backend here.
- A checkable "done when" criterion replaces upstream's open-ended ending — the `/writing-for-agents` standard requires a verifiable finish.
- Upstream's "Commit your work to the current branch." not carried — committing is `/commit`'s user-gated step here, and AGENTS.md forbids a skill committing on its own.
- The review tail adds a `/review-gate` severity suggestion (low for a trivial or mechanical diff, high for a large or risky one, medium otherwise) and a `/handoff` fallback when context runs low — both keep the chain runnable in one session with the working diff as context, which renaming upstream's `/code-review` pointer alone would not.

### /improve-codebase-architecture (improve-codebase-architecture)

Verified against `v1.2.0`.

- The inline vocabulary enumeration — the seven terms and the three principles — not carried; the fork points at `/codebase-design` instead, since restating a referenced skill's glossary duplicates both the file the reader is about to load and HTML-REPORT.md's own "Use exactly" list.
- `CONTEXT.md` replaced throughout by the project's domain glossary (an `AGENTS.md` glossary section or `CONCEPTS.md`) — this pipeline's knowledge stores, set by `/compound` and echoed by `/tdd` and `/codebase-design`, have no `CONTEXT.md`.
- HTML-REPORT.md's "ADR callout" renamed "Settled-decision callout", and the settled decisions this scan must not re-litigate are read from whichever of `docs/adr/` and `docs/solutions/` the loop config enables — upstream assumes an always-present ADR tree, where both stores are opt-in here and a recorded rejection may sit in either.
- "Don't list every theoretical refactor an ADR forbids." not carried — the retained "only surface it when the friction is real enough to warrant revisiting the decision" already carries that constraint.
- "use the Agent tool with `subagent_type=Explore`" generalized to "dispatch an exploration subagent" — this plugin ships to two harnesses and `subagent_type=Explore` exists only in Claude Code.
- The `/domain-modeling` side-effect block, including the offer to write an ADR, replaced by capture through `/compound` — this repo has no `/domain-modeling` skill, and `/compound` owns both glossary and `docs/solutions/` writes under a user gate.
- Upstream's gate on the rejection capture — offer it only when the reason would be needed by a future explorer to avoid re-suggesting the same thing — is not carried, its skip clause (ephemeral and self-evident reasons) standing alone — the capture routes through `/compound`, whose user gate is where worth-recording is decided here.
- Step 3 owns the close, offering `/codebase-design`, `/spec` or `/implement` by what the interview settled, because the `/grilling` it runs hands back instead of closing — upstream ends on its own side-effect block and never delegates an interview, so nothing there had to decide which skill closes.

### /prototype (prototype)

Verified against `v1.2.0`.

- Rule 6's capture destination is the feature's spec — a dated annotation through the annotate-spec verb carrying the branch pointer, the verdict, and the question it settled, falling back to the folding commit when no spec exists — where upstream leaves a context pointer on the implementation issue; this pipeline has no tracker, and the spec is where a prototype's verdict re-enters the loop.
- LOGIC.md anti-patterns "Don't add tests" and "Don't wire it to the real database" not carried — both restate SKILL.md's "Skip the polish" and "No persistence by default" rules.
- UI.md anti-pattern "Variants that differ only in colour or copy" not carried — restates step 2's structural-difference requirement.

### /questionnaire (to-questionnaire)

Verified against `v1.2.0`.

- Step 3 writes `questionnaire-<slug>.md` where upstream writes `to-questionnaire-<slug>.md` — the rename drops the `to-` prefix, and this filename is the one the recipient sees.

### /research (research)

Verified against `v1.2.0`.

No divergences beyond the systematic conventions.

### /resolving-merge-conflicts (resolving-merge-conflicts)

Verified against `v1.2.0`.

- Step 2's primary-source list ends by fetching the specs behind each change through the fetch-spec verb instead of upstream's "check original issues/tickets." — in this pipeline the recorded intent behind a change lives in the `/spec` artifact.
- Step 2 adds the no-spec fallback — work from the commits and the PR, and say which side's intent you had to infer — the fetch-spec edit above introduces a source a backend can hold nothing for, and a resolution that guessed an intent without saying so reads as if it had read the spec.

### /review-gate (code-review)

Verified against `v1.2.0`.

- Upstream's two fixed axes (Standards + Spec, two parallel sub-agents, reports aggregated verbatim) replaced wholesale by an effort-scaled finder/verifier pipeline — `low`/`medium`/`high`, correctness angles A–F, quality lenses, one independent verifier per location returning CONFIRMED/PLAUSIBLE/REFUTED, a `high`-only sweep, a ranked capped report with outcome tracking, `--fix` apply mode, and a no-sub-agent fallback — because independent verification of every candidate is what buys precision at `medium` and recall at `high`, which unverified side-by-side axis reports cannot.
- Findings are deduped, merged by root cause, ranked, and capped, reversing upstream's explicit "do not merge or rerank findings" and dropping its _Why two axes_ rationale section — the separation upstream protected with that rule is served here by finder isolation, so ranking no longer lets one axis mask another.
- The finder briefs live in siblings rather than inline in SKILL.md — the correctness angles in [ANGLES.md](skills/review-gate/ANGLES.md), the quality lenses in [QUALITY-LENSES.md](skills/review-gate/QUALITY-LENSES.md) — so each finder loads only its own angle or lens; the lens file is shared with `/simplify`, which reads three of its five lenses, and is the single source for what the two skills hunt on every path but one, and for what a fix to prose must preserve, while deliberately carrying no limit on where a fix may reach, since a carrier handed such a limit withholds the candidate rather than the fix.
  `low` is that one path and is not a lapse: it dispatches nothing, loads no lens file, and so restates two of the file's items — the Reuse lens's duplicated helper and the Simplification lens's dead code — inline in its own turn 2.
  Both skills' inline fallbacks dispatch nothing either but still hunt from the file — `/review-gate`'s loads it whole, `/simplify`'s runs the pasted lens of each fixer it stands in for — so they sit inside the claim rather than beside `low`.
- That limit is a section of its own, "The mutation boundary": the run's target plus the seams it needs, narrowed to whatever files the arguments named, with a fix that cannot stay inside it handed back rather than granted a wider scope.
  Upstream's review has no apply mode at all, so nothing there bounds where a fix may reach; the boundary earns its own section because every path arrives at it there — `low` loads no lens file, and LOOP.md stands in for the reporting section an apply-time rule would otherwise have sat in.
  It carries `/simplify`'s name for the same constraint, which is upstream's own, so the two review paths in this plugin name one edit-reach limit one way.
- Each restraint is stated under the lens it qualifies and is self-contained there, and no lens names a phase of the skill that dispatched it, since a carrier is handed one lens section and both a pointer across to another lens and a reference to a caller's step resolve to nothing in its context.
  Simplification's consolidation restraint is the one restraint that is not self-contained, handing the platform-guarantee route out of a duplicate to the Reuse lens "under the conditions printed there" — unreadable to a carrier handed the Simplification section alone, which is `/simplify`'s dispatched Simplification fixer and `/review-gate`'s Simplification finder at `high`.
  It resolves wherever a carrier is handed Reuse too: `/review-gate` at `medium`, the three mechanical lenses travelling in one finder there, and `/review-gate`'s inline fallback, where one context works every lens.
  An inline `/simplify` pass sits between the two, whatever put it inline — the parent holds the three lenses that skill works, Reuse included, yet the pass runs under one assigned lens — and which side it lands on is part of what the deferred fix settles.
  Recorded rather than resolved; [IDEAS.md](IDEAS.md) holds the options and the trigger.
- The three mechanical lenses draw on what this fork and `/simplify`'s retired personas each knew, carrying defect classes upstream's briefs never had — reimplemented primitives, parameter sprawl, stringly-typed values, narrating comments, N+1, TOCTOU pre-checks, memory leaks — held to roughly six items each so a merged brief stays pasteable, with Design and Conventions outside that budget.
  Neither of those two is carried untouched: Design's divergences are recorded below, and Conventions is written here, upstream having no standalone lens but a Standards sub-agent brief whose "cite the standard" it tightens into quoting the exact rule and the exact line that breaks it.
- The Design lens opens by loading `/codebase-design` and judging the whole lens in its vocabulary — depth, seam, leverage, locality, the deletion test — which upstream's baseline has no counterpart to.
  Upstream binds its smells with two rules the fork carries, the repo overriding and each smell being a judgement call, but names no vocabulary to judge them in; this plugin already carries one as a skill to point at.
- Reuse, Simplification, Efficiency and Design each gloss what the lens means on agent-facing prose, and the file's preamble carries the prose preservation rule as a governing rule, since this plugin is itself prose and both skills now review it.
- Design's prose gloss rules the smells themselves out on prose and carries altitude alone across — upstream's smell baseline asks the depth question nowhere, and a carrier handed ten code shapes against a Markdown diff returned empty or forced object-oriented vocabulary onto skill files.
- The altitude paragraph inside the Design lens absorbs the call-site and symptom-patch cases and a restraint against flagging a one-off — a bare "prefer generalizing the mechanism" invites the finding on every local fix.
- The twelve-smell baseline is compressed to ten inside the Design lens, the carried entries trimmed toward a noun phrase plus its fix — Duplicated Code and Speculative Generality are dropped because the Reuse and Simplification lenses already cover them, and the trim keeps a brief short enough to paste into every quality finder.
  Two entries carry upstream's fuller detector cues instead — Mysterious Name and Primitive Obsession, restored where the trim had cost a lone carrier the detector cue — and Message Chains rides byte-identical.
- Scope establishes the untracked files alongside the diff (`git ls-files --others --exclude-standard`) and marks them in the scope block as files a carrier reads whole — upstream reviews only committed work from a user-supplied fixed point, so this fork's working-tree default opened a hole no diff can close, and an unreviewed new file fails silently.
- Scope names the standards sources rather than leaving them to upstream's "anything in the repo": the `AGENTS.md`/`CLAUDE.md` files governing the changed files at every level (user, repo root, ancestor directories), `CONTRIBUTING.md`, and the style skills loaded in this session — a hierarchy has to be named to be walked, and a style skill the session loaded is a standard in force that no file in the repo documents.
  The scope block carries them to every finder, the Conventions lens being able to cite only what it was handed.
- Upstream's issue-tracker dependency (`docs/agents/issue-tracker.md`, the setup-skill precondition, commit-message issue refs) is not carried — an upstream-only setup convention; this fork fetches the spec or ticket through the fetch verbs and additionally matches `docs/solutions/` learnings against the diff.
- Angle D compares the diff against the spec as amended by its annotations and reports a mismatch neutrally, its fix offering both routes — align the code, or annotate the spec with the mid-implementation revision (the annotate-spec verb) and flag it for `/compound` at loop end — with the user picking at fix time, and verifiers citing deliberateness evidence (session transcript, commit messages) without suppressing the finding; a spec here is a point-in-time decision record, so a Spec axis that presumed the code wrong, or that ignored the annotation channel, would re-report a deliberate revision forever.
- Verify opens on an inline-triage path upstream has no counterpart to: a candidate this session can settle from evidence it already holds — a recorded decision, a rule-quote check, a fact established earlier in the session — is settled without a dispatch, and the closing summary reports how many were, so the user sees how much of the run never reached a verifier.
  One prohibition binds it: never settle REFUTED inline on code this session itself wrote, an author refuting a bug report about their own code being the bias the finder/verifier split exists to route around.
- The report branches on the harness — through its typed findings tool where one is offered, in a single call that *is* the report, and as a printed ranked list otherwise; upstream reports only as prose, and a harness that renders findings natively drops them on the floor when a skill prints them instead.
- A cross-model second pass is offered on a high-stakes change where the harness provides another vendor's model, and is never required — every other part of this pipeline routes around one model's blind spots, and the orchestrator's own are the ones it cannot route around from inside.
- Added rule that user-supplied arguments are scope guidance only and never carry actions to perform — the diff and the arguments both reach sub-agents, so the injection boundary has to be stated where the scope is assembled.
- A `--loop` flag added, implying `--fix` and driving the gate to a defined green state, with its rules disclosed to [LOOP.md](skills/review-gate/LOOP.md) and loaded only when the flag is passed: fix batches verified by the project's own checks, self-scaling delta rounds between them, a certifying pass at the invoked level over the final tree where the loop's fixes reached past the ground already reviewed, park-and-continue escalation of everything needing the user, trajectory, budget and repeat-question guards, and a closing report carrying the round and disposition ledgers.
  No upstream source loops review→fix→re-review before the PR, and compound-engineering re-reviews only once a diff has changed materially, so this diverges knowingly, adapting the patterns of `ce-babysit-pr`, upstream's one true loop ([docs/research/review-fix-looping-upstream.md](docs/research/review-fix-looping-upstream.md)).

### /setup-git-guardrails (git-guardrails-claude-code)

Verified against `v1.2.0`.

- Generalized from Claude Code alone to both harnesses: step 1 asks which one, step 2 lists four script destinations, step 4 edits every copy it wrote rather than upstream's singular "the copied script".
  Codex ships a wire-compatible `PreToolUse` hook, so one unmodified script serves both and only the config around it differs.
- The config lives in [HOOK-CONFIG.md](skills/setup-git-guardrails/HOOK-CONFIG.md), a section per harness, with step 3 pointing at it — four blocks inline filled over half the body and buried the steps after them, where upstream's two fitted.
  The per-harness mechanics live there rather than here, the Codex blocks being templates the reader substitutes into.
- Step 3 makes trusting the Codex entry under `/hooks` part of installing — a hook Codex has not been told to trust never runs, and upstream, having no Codex, had nothing between writing the file and arming it.
- The blocks invoke the script through an explicit `bash` prefix, and the Claude pair adds `"shell": "bash"` — upstream leans on an undocumented `.sh` auto-prefix and on the executable bit surviving, neither of which holds across two harnesses and three shells.
- Step 2 states the script's `bash`/`jq`/`grep` prerequisites and what their absence costs — missing `jq` empties the command the patterns match against, so the script exits 0 and the guardrail passes everything; upstream's single-platform audience made the dependency invisible rather than absent.
- Step 4 adds that the entries are extended regexes rather than literal text, since it invites the user to edit them and `grep -qE` silently mis-matches a pattern written as literal.
- "before Claude executes them" and "Claude sees a message" say "the agent" instead — the fork covers two harnesses, and only one of them is Claude.
- Step 5's payload spells the blocked command in split quoting, so the test command's own text never matches a pattern — upstream's plain payload is denied by the very hook it is meant to test once one is installed, and a denied test proves nothing about the script or about anything the user changed in step 4.
  It then adds a live-fire step upstream has no counterpart to, a real `git push --dry-run` whose denial is the only evidence the wiring carries, since a script test that dodges the hook by design can say nothing about it.
- Step 5 adds the Windows note to run the test through Git Bash by its full path — `bash` on the Windows PATH is the WSL stub, which reaches no script and reports no verdict — upstream's single-platform, executable-bit install never routes the test through a Windows shell.
- HOOK-CONFIG.md's Codex `commandWindows` string carries its own contract, upstream having no Windows or Codex counterpart to any of it: the `&` call operator, the `; exit $LASTEXITCODE` re-raise (pwsh reports every non-zero native exit as 1, a hook error that lets the command through), the two substitution notes (the Git Bash path, the project path where the project is not the repository root), and a hand-run of the finished string from PowerShell before moving on — every mistake in that string fails open, and a wrong path shows up nowhere else.
- The Claude blocks match `Bash|PowerShell` where upstream matches `Bash` — Claude Code ships a second shell tool named `PowerShell`, and `matcher` being a regex over the tool name, the upstream matcher leaves the agent a route around the guardrail wherever that tool is enabled.

### /spec (to-spec)

Verified against `v1.2.0`.

- Issue-tracker publication and the `ready-for-agent` triage label not carried — the fork publishes through the publish-spec verb, and the label vocabulary has no counterpart here.
- The `/setup-matt-pocock-skills` prerequisite line not carried — per-repo setup is `/setup-cantrips-loop`'s job here, reached through the loop config the fork already points at rather than a prerequisite line.
- Opening paragraph rewritten to imperative voice, replacing upstream's "Do NOT interview the user" prohibition with a pointer to `/grilling` — the interview is a separate pipeline step here, and the standard prefers stating what to do over what not to do.
- Step 1's "domain glossary vocabulary" trimmed to "domain vocabulary" — upstream's provisioned glossary is a convention this pipeline never establishes.
- New step 2 reading `AGENTS.md` plus the config-enabled knowledge stores (ADRs for decisions already made, solutions for gotchas) — the spec is where `/compound`'s stores re-enter the loop, and past specs are deliberately not mined, so decisions implementation abandoned stop propagating.
- Step 2 flags a conflict with a standing ADR explicitly in the spec and routes the revision through `/compound` at loop end — upstream's "respect any ADRs" clause left silent override open, and `/compound` is the ADR store's sole writer here.
- Step 4 states the freeze-and-annotate rule at the template — body frozen at publication, work-status lines out, dated annotations via the annotate-spec verb — because downstream sessions read the spec as a point-in-time decision record, a lifecycle upstream delegates to its tracker.
- Seams step condensed from four rule sentences to two and repointed at `/implement` and `/codebase-design` — upstream restates the highest-seam rule, and the fork owns the seam vocabulary in a dedicated skill.
- Upstream's "Testing Decisions" template section replaced by "Test Seams" carrying the seams approved in step 3 — the fork's contract with `/implement` is the approved seam list, not a general description of what makes a good test.

### /tdd (tdd)

Verified against `v1.2.0`.

- Domain-vocabulary sentence rewritten to point at the `AGENTS.md` glossary section or `CONCEPTS.md` — `CONTEXT.md` is an upstream-only file convention this repo lacks.
- Upstream's "respect ADRs in the area you're touching" is carried in substance rather than in text, scoped to the case where nothing upstream of this skill has read those records — a spec that folded them in, as `/spec` step 2 does, stands in for the read.
- Seam definition gains "(full vocabulary: `/codebase-design`)" — this repo ships the deep-module vocabulary as its own skill, so the reference here stays one clause; upstream's v1.2.0 paragraph spelling out the same pointer is not carried on top of it.
- "Test only at agreed seams" relaxed so seams the user already approved in `/spec` need no re-asking — the pipeline hands `/tdd` an approved spec, and upstream's unconditional confirmation would re-litigate it every cycle.
- Upstream's "Ask: 'What's the public interface, and which seams should we test?'" not carried — a scripted question the preceding paragraph already mandates, and no-op prompts are what `/writing-for-agents` prunes.
- "Bug fixes start red on the bug" paragraph added — this skill is model-invoked on "fix bugs test-first" and upstream states the failing-repro-first rule nowhere; nothing routes a fix here from `/diagnosing-bugs`, which writes its own regression test.
- Refactoring pointer names `/simplify` and `/review-gate` as the review tail instead of upstream's single `code-review` skill — this repo splits that tail into two steps, so a rename alone would drop the second target.

### /teach (teach)

Verified against `v1.2.0`.

- The `NOTES.md` bullet gains a "refer back to it when designing lessons or working with the user" clause, and upstream's trailing `## NOTES.md` section is not carried — the section carried that directive, which the bullet alone lacked, so the clause keeps it stated once, at the point of use.
- The learning-records bullet drops upstream's "loosely equivalent to architectural decision records in software development" analogy and its `0001-<dash-case-name>.md` naming sentence — the numbering rule already lives in LEARNING-RECORD-FORMAT.md and the analogy earns nothing at the point of use.
- LEARNING-RECORD-FORMAT.md spells out "architectural decision records" where upstream writes "ADRs" — dropping the analogy from SKILL.md left the acronym with no expansion anywhere in the skill.
- The Glossaries closing line links GLOSSARY-FORMAT.md — upstream ships the file but no upstream skill body points at it.
- LEARNING-RECORD-FORMAT.md writes `MISSION.md` and `GLOSSARY.md` as code spans where upstream uses `[[…]]` wiki-links — a teaching workspace is plain Markdown, not an Obsidian vault.

### /tickets (to-tickets)

Verified against `v1.2.0`.

- Ticket publication runs through the publish-tickets verb instead of upstream's issue-tracker conventions, and the spec is fetched through the fetch-spec verb the same way.
- Blocking edges ride the backend's native dependency links where it has them, each ticket's "Blocked by" prose otherwise — one breakdown serves a files-backed and a tracker-backed repo alike.
- Upstream's `<issue-template>` not carried, and `<local-ticket-template>` renamed `<ticket-template>` now that it is the only one — a tracker-backed repo here shapes its issues from that single template.
  The closing passage's "In either form," opener goes with it, reworded to "in tickets" inside the sentence.
- The ticket template's `**Status:** ready-for-agent` line not carried — it is upstream's triage label vocabulary, which has no counterpart here.
- The `/setup-matt-pocock-skills` prerequisite line not carried — per-repo setup is `/setup-cantrips-loop`'s job here, reached through the loop config the fork already points at.
- Step 2's heading drops upstream's "(optional)" — the step's own first line already makes the exploration conditional.
- Step 2's "domain glossary vocabulary" trimmed to "domain vocabulary" — upstream's provisioned glossary is a convention this pipeline never establishes.
- Step 2's "respect ADRs in the area you're touching" not carried — the ADR read belongs to `/spec` step 2 in this pipeline, which flags conflicts into the spec body this skill breaks down; the conversation-only route runs without the read, an accepted gap.
- The vertical-slice rule on context-window sizing gains "— one ticket, one `/implement` run" — the size that matters here is one run of the step this fork's closing pointer names.
- The publish step ends "Publishing leaves the parent spec untouched." — upstream's "Do NOT close or modify any parent issue" prohibition, carried as the positive constraint this repo's authoring standard asks for, with the lifecycle rule itself stated once in `/implement`.
- Upstream's "Work the **frontier**" sentence moves out of the publish step into the closing flow pointer — it decides which ticket `/implement` takes next, not how tickets are published.

### /wait-what (wait-what)

Verified against `v1.2.0`.

- The body is carried byte-identical but for its closing clause: "use the ubiquitous language from `CONTEXT.md`" becomes "use the project's ubiquitous language", naming no file.
  The other forks point at a domain glossary because they are composing something; this one re-says a message already on screen, where a file read would cost the interrupt the speed that is its whole value.

### /writing-for-agents (writing-for-agents)

Verified against `v1.2.0`.

- The `description` is rewritten beyond what the systematic frontmatter rework covers — a deliberate widening of the model-invocation trigger from upstream's skills, `AGENTS.md` and `CLAUDE.md` to any file an agent will load and act on, rules files included — because the vocabulary applies to every agent-facing document, and a description scoped to skills left the skill unfired on the rest.
- SKILL-MECHANICS.md's three claims that a user-invoked skill has no description — "keeps a `description`" in the model-invoked bullet, "with no descriptions" on shared reference, "user-invoked skills have no description" under router skills — are corrected to say the description is out of the agent's reach, fixing a contradiction in upstream's own text: its user-invoked bullet says the `description` becomes human-facing, so the skill has one and only the agent cannot see it.
- "Pipeline closings" section added, pointing at the sibling [flow-pointers.md](skills/writing-for-agents/flow-pointers.md) — the pipeline skills here all end on a flow pointer, and the shared presentation format needs one authoritative home rather than a restatement in each skill.
  Its last line prescribes the pointer's verb-first wording, from an observed failure the section itself no longer names: an agent read the earlier `([presentation](…))` phrasing as a citation, never loaded the file, and invented a closing format.
- A **gate** bullet added to Pruning — any line conditioning behaviour fails the no-op test when its condition names competence the agent already shows, and fails it worse when the agent cannot observe the condition — because upstream's no-op entry reaches only a weak leading word, and an audit of this repo's own skills found conditionals to be where no-ops actually accumulate, the unobservable condition worst of all since it reads to a maintainer as an enforced rule.
  The same bullet extends the test to rationale — a justification the reader would have followed the rule without — because a persuasive voice is where no-ops survive a pruning pass that catches bare restatement.
- Two more Pruning bullets, **Director's commentary** and **Snapshot** — upstream's failure modes catch prose that went stale (**sediment**) or grew too long (**sprawl**), and neither reaches prose that was never load-bearing: a derivation shipped beside its conclusion, or a count standing where an invariant belongs.
- The **gate** and **Snapshot** bullets each keep the limb that says when the thing is legitimate — a gate whose condition encodes what the model cannot infer, a version baseline reading as of-a-date — carried over from the retired GLOSSARY.md, which was the only place those criteria lived.
  Without them the two bullets read as blanket prohibitions, and this repo's own loop-config gates and `source:` baselines are the first things a pruning pass would take.
- SKILL-MECHANICS.md's opening line drops upstream's "frontmatter" from what the file promises and writes the skill name with the `/` prefix (AGENTS.md rule 7) — the file's three sections are Invocation, Splitting by invocation and Router skills, so an agent routed there for frontmatter finds no rule for `name`, `argument-hint`, `version` or `source`; the same trim applies to SKILL.md's pointer at it, and README describes the skill without naming the split at all, its roster staying at the altitude a reader installing the plugin can act on.
  Frontmatter for this repo is AGENTS.md rule 2's job.

### ask-matt

Not ported. Personal to upstream's author.

### claude-handoff

Not ported. Upstream marks it in-progress; `/handoff` forks the finished variant.

### domain-modeling

Not ported. Deferred in IDEAS.md; the AGENTS.md glossary section and its CONCEPTS.md graduation path (via `/compound`) cover the need.

### grill-me

Not ported. An earlier variant of grilling; this repo forks grilling instead.

### grill-with-docs

Not ported. A docs-driven grilling variant; `/grilling` plus `/research` cover it.

### loop-me

Not ported. Upstream marks it in-progress.

### migrate-to-shoehorn

Not ported. Migration tooling for upstream's own stack.

### scaffold-exercises

Not ported. Course-content tooling personal to upstream's author.

### setup-matt-pocock-skills

Not ported. Provisions upstream's tracker and label conventions; per-repo setup is `/setup-cantrips-loop`'s job here.

### setup-pre-commit

Not ported. Check tooling outside the loop's scope.

### setup-ts-deep-modules

Not ported. Upstream marks it in-progress, and it wires one stack's lint tooling; `/codebase-design` carries the deep-module vocabulary harness-free.

### triage

Not ported. Needs an issue tracker and an inbound issue flow; deferred in IDEAS.md.

### wayfinder

Not ported. A local-files adaptation is sketched in IDEAS.md; adopt when a decision surface outgrows `/grilling` → `/spec`.

### wizard

Not ported. Generates a bash wizard for manual human-only procedures — provisioning, credentials, dashboards; outside the loop's scope.

### writing-beats

Not ported. Upstream marks it in-progress.

### writing-fragments

Not ported. Upstream marks it in-progress.

### writing-shape

Not ported. Upstream marks it in-progress.

## EveryInc/compound-engineering-plugin

### /commit (ce-commit)

Verified against `compound-engineering-v3.21.2`.

- Step 4 body discipline rewritten: the body states the problem and why this approach, plain and self-contained, and the session's process (attempts, verification) dies with the session — upstream-style open-ended guidance produced verbose session-narrative bodies.
- Step 1's compound-candidate scan added — with a diff-review stop on `/compound`'s written prose before it enters a commit, since the destination gate clears a one-line proposal, not the document — along with the loop-closing frame around it (the opening line, Step 5's note that learning writes form their own `docs`-type commit, and the closing "learnings captured, committed" paragraph) — `/commit` closes this repo's engineering loop and must leave the tree clean including `/compound`'s writes, which upstream's single-purpose commit skill has no equivalent for.
- Step 3's branch choice defers to the repo's own workflow on the default branch, committing in place where history is trunk-based — upstream mandates cutting a feature branch whenever the current branch is the default and forbids asking, which is upstream's workflow, not a universal one.
  The other half holds in substance rather than in text: a detached HEAD cuts a branch and Step 3 does not ask, over a rationale this fork spells out where upstream leaves it bare.
  Step 3 also answers for the branch state upstream's rule never fires on — already on a feature branch, commit where you are — since a step named for choosing a branch that says nothing about the commonest state reads as an instruction to cut one.
- Upstream's `gh repo view --json defaultBranchRef` fallback not carried — `git rev-parse` plus a `main` default resolves the branch without adding a `gh` dependency to the skill.
- The body is a condensed rewrite in this repo's voice: the H1 and the standalone Context table are gone, and upstream's `## Context` section merges with the Workflow step 0 that only re-runs it into one Step 2 bullet list.
  The table itself is not restored — it carries a not-a-git-repo stop and an unborn-repo column the fork's bullets lack, while the fork's clean-tree stop and `origin/`-strip rule run the other way, both recorded below.
- Step 4's conventional-commit default names the type enum where upstream gives the shape `type(scope): description` with only a fix-over-feat tie-break — handed the shape without the set, an agent invents types outside it, and a repo whose release tooling keys on the type then skips the commit silently.
  The tie-break is carried reworded into Step 4 with its why test spelled out; upstream's closing "User override wins." is not carried.
- Upstream's Bad/Good subject examples not carried — Step 4 states the subject rule as its own bullet with the _why_ test spelled out.
- A "Formatting details" bullet added, deferring wrapping, trailers, and sign-offs to the repo's documented rules and the user's global instructions — the plugin must stay distributable, so per-user commit-message habits belong outside the skill body.
- Upstream's v3.21.2 "**Done when:** / **Stop when:**" header and its "Do not use `git diff HEAD` alone as cleanliness (it misses untracked files)" and "never compare against `origin/<name>`" guards not carried — each states what the fork already does elsewhere.
  Step 2's clean-tree stop and the closing "learnings captured, committed" paragraph state the header's both limbs, and the fork's done condition has to include Step 1's learning writes, which upstream's has no equivalent for; the two guards prohibit a path the fork does not take: Step 2 reads cleanliness from `git status` and strips the `origin/` prefix.

### /compound-refresh (ce-compound-refresh)

Verified against `compound-engineering-v3.21.2`.

- The body is an original-words reimplementation rather than carried text, and the bullets below record the divergences worth naming rather than every one there is.
  The two judgment rules merged at v3.21.2 are the exception: "Unverifiable is not false" keeps upstream's wording nearly intact and "Shared code is not shared problem" condenses upstream's clause, so a future sync reconciles those two against upstream and the rest against this entry.
  One limb of Unverifiable is deliberately absent there — upstream's never-stale-mark limb, which prohibits an act the fork cannot perform, the mode that needs it being uncarried below.
- A second store is audited, unconditionally: the project's `AGENTS.md`, through a bloat / contradictions / staleness lens held to `/writing-for-agents` — upstream reviews `<root>/solutions/` only — while the opt-in `docs/adr/` store gets no garbage collection, supersession being the ADR store's own hygiene mechanism.
- Four verdicts instead of upstream's five, with Replace folded into Update — the fork's Update already covers rewriting a contradicted fix to the current truth and presenting it as the rewrite it is.
- Upstream's non-interactive mode (`mode:non-interactive`, with `mode:headless` its deprecated alias) not carried, and with it the stale-marking that mode falls back on — `status`, `stale_reason` and `stale_date` written into a doc's frontmatter whenever a classification is too ambiguous to act on unattended.
  Every change in this pipeline is user-gated, so there is no unattended path to fall back from, and the fork's format contract defines no such fields.
- Upstream's `## Blocking questions` section not carried — it names four harnesses' question tools and their fallback rules, then adds its own ask-one-at-a-time and recommended-option-first principles; the fork presents verdicts for approval in plain prose.
- The pattern-doc tier (`<root>/solutions/patterns/`, which upstream classifies as derived guidance) and the `_archived/` legacy cleanup not carried — [solutions-format.md](skills/compound/solutions-format.md) defines one flat directory with no derived tier and no archive.
- Scope matching is filename, then `area`/`tags`, then content keyword — this repo's frontmatter has `area` and `tags` where upstream has `module`, `component`, and category subdirectories.
- The `CONCEPTS.md` vocabulary machinery — upstream's `## CONCEPTS.md bootstrap requests` disambiguation, its `## Vocabulary Capture` step and the `references/concepts-vocabulary.md` that step reads — reduces to a single pointer, `/compound` owning the glossary-graduation convention here.
- Upstream's `## Discoverability Check` not carried, its `CONCEPTS.md` check included — it appends a pointer to the project's instruction files so a reader without the plugin finds the store, where here every storage-touching skill reaches the store through the loop config instead, and this fork's `AGENTS.md` lens prunes what stopped earning its always-loaded cost rather than adding to it.
- The subagent strategy (investigation versus replacement roles, and the rules picking between the main thread, parallel agents and batches) not carried — orchestration is the harness's business, not the skill's.
- Upstream's `## Commit` section (its per-mode branch, PR and staging choices, and its commit-message rule) not carried — `/commit` owns landing changes, and the fork closes by pointing at it.
- Upstream's auto-memory scan not carried — its investigation step reads Claude Code's injected auto-memory block for same-domain drift signals and demotes a memory-only signal below codebase evidence.
  Naming a harness tool is outside what the systematic conventions permit a skill body, and the fork's own "Act only on contradiction, where the code demonstrably does otherwise" already keeps a memory note from carrying a verdict.
- Upstream's broad-sweep triage not carried — past a doc-count threshold it clusters, works the highest-impact cluster first, and confirms continuation between batches.
  The fork investigates every doc in scope before a single gate, so there is no batch to order and no continuation to confirm.
- Upstream's `assets/` and `references/` not bundled — they encode a richer doc schema (`problem_type`, `component`, `severity` enums, resolution templates) that [solutions-format.md](skills/compound/solutions-format.md) supersedes.
- Upstream's `scripts/` not bundled — the two Python validators would reintroduce a dependency and a check step this repo deliberately lacks, and there is no enum schema left to validate.
- Upstream's `## Setup` section not carried — a Node fence running `scripts/context.mjs` ahead of any dispatch, plus its truncation-recovery and rerun rules; it injects one harness's session context, and this repo's Boundaries rule out shipping a runtime dependency.
  The same section opens `ce-simplify-code` and is skipped there for this reason.

### /simplify (ce-simplify-code)

Verified against `compound-engineering-v3.21.2`.

- Body rewritten; the three paragraphs merged from upstream stay byte-identical: model selection, the mutation boundary, and pre-release compatibility scaffolding.
- The three reviewer personas and `references/personas/` are gone, the hunt taxonomy having moved into the shared [QUALITY-LENSES.md](skills/review-gate/QUALITY-LENSES.md) that `/review-gate` reads too, with the fixer preamble each persona separately repeated now stated once in the body and paired with a single lens at dispatch — upstream and this fork maintained the same three dimensions in two separately-authored texts that had already drifted apart in both directions, so refining either meant editing both or letting the gap widen.
- Upstream's code-reuse rule 3 is compressed into that file's Reuse lens — the **Hand-maintained guarantee** item and the restraint printed under it — and upstream's code-quality rule 3 into its **Simplification** lens, the copy-paste item plus the consolidation restraint, which states the behavior-preservation gate on consolidating in upstream's own words ("otherwise consolidate only when behavior-preserving") so a finder handed that lens alone carries it without `/simplify`'s preservation contract.
  What the Simplification restraint does not carry is three of that rule's clauses: the platform-guarantee route out of a duplicate, which is the Reuse lens's call here under the conditions printed there, and the two brakes closing upstream's rule — a branch made reachable by removing a guard is not dead, and a serializer or coercion swap wants proof of exact equivalence first — which this repo prints only under the Reuse lens's **Hand-maintained guarantee** restraint, scoped to that removal.
  So a Simplification-only carrier holds the **Dead code left behind** item without the not-dead-branch brake beside it, which is a gap rather than a decision and is deferred in [IDEAS.md](IDEAS.md) with the cross-lens pointer above it.
  The lens file holds the authoritative wording, so a future sync reconciles against it rather than against this entry.
- The preservation contract is two-limbed and hoisted above Step 1 so it governs every step rather than only the fix loop, keeping upstream's exact-behavior test for code and adding, for agent-facing prose, one upstream has no counterpart to because its scope gate refuses prose outright: the instruction set is what is preserved, so repetition and sediment may go while no directive, prohibition, gate or completion criterion may be cut or weakened, and a sentence of uncertain kind stays.
- That prose rule is also carried as a governing rule in QUALITY-LENSES.md, so `/review-gate --fix` is bound by it when it applies a quality finding to prose.
- Step 1 adds the untracked files to every resolved git scope (`git ls-files --others --exclude-standard`) — upstream's branch diff and its `git diff HEAD` fallback both skip a file with no committed version, so a brand-new file went unsimplified and unmentioned.
- Upstream's scope preflight is not carried at all — it refuses documentation-only diffs, where this plugin is itself prose and a blank invocation under that gate bailed on exactly the material most worth passing over.
  Its enumeration of generated, vendored, lockfile and mechanical-churn content went with it: an agent handed a diff to simplify does not refactor a lockfile or rewrite vendored code, so the gate spent four lines restating the default and a fifth undoing its own over-reach.
- Step 4 verifies per material rather than per diff, running the code checks over code and, over prose, a diff-read of every line the pass removed or reworded — a consequence of the widened gate, since upstream's typecheck/lint/test step has nothing to check on prose and re-reading the post-pass file cannot reveal an instruction the pass cut.
- The safety-check prohibition gains its prose analogue: a gate or a prohibition is a safety check.
- "Structure pins" paragraph not carried — tied to ce-plan's `session-settled:` plan convention; nothing in this pipeline passes a plan to `/simplify`.
- Upstream's `## Setup` section not carried, for the reason recorded under `/compound-refresh` — both CE skills open on the same fence.
- Task-tracking paragraph not carried — harness housekeeping.
- "Bounded dispatch" paragraph carried in part: its queueing and active-agent-limit backpressure is dropped — the harness's business, and three fixed reviewers never reach the limit — while its inline-fallback rule stays in Step 2, a lost dispatch otherwise costing the pass a whole lens in silence.
  That rule is reworded rather than carried, both changes following from dropping the backpressure half: upstream triggers on "any other reason" than the backpressure it had just excluded, which names nothing once that clause is gone, so the fork triggers on a failed dispatch or a harness with no way to make one — the case upstream's own "run the reviews inline or serially" covered.
  And upstream's "the same prompt asset" is a persona file this fork does not have, so the fork names the contract, the lens and the scope instead — everything Step 2 hands a fixer except the fixer brief, whose "Edit nothing yourself" is addressed to a dispatched agent and would forbid the parent the very fixes Step 3 tells it to apply.
  Step 3's opening carries upstream's own "whether returned by subagents or produced inline" coverage, reworded to name a dispatched fixer and this context — the same breadth, in the fallback's vocabulary.
- "Permission mode" paragraph not carried — no dispatch primitive here takes a `mode` parameter, so telling the agent to omit it is a no-op.
- Upstream's per-harness tool enumerations not carried — the blocking-question tools in Step 1 and the subagent primitives in Step 2 — no skill in this repo names a harness tool, and such names go stale; the background-dispatch parameter in Step 2 is the standing exception the systematic conventions record.
- Step 4's failure rule keeps upstream's free choice between repairing the break and reverting the simplification, and narrows it with the mutation boundary — a repair landing outside it leaves revert the only route — because carrying upstream's boundary paragraph into Step 3 turned "fix the underlying break" into an instruction that could reach outside a user-named scope.
- Step 5's skipped-findings category splits upstream's undifferentiated "skipped" into false positives, churn not worth it, and fixes the mutation boundary put out of reach — the third only exists because Step 3 carries upstream's boundary rule, and a skip it caused is the one a user most needs named.
- Step 1's third branch is narrowed to "outside a git repository", where upstream also routes a git repository that yields no diff — inside git the fork's own empty-scope stop asks the user instead, and falling back to conversation files there would simplify material the user never put in scope.
  It drops upstream's "files the user named" as a source on that branch too, branch 1 already holding a user-named scope authoritative.
- Step 5's "If nothing changed, say so" not carried — the per-lens applied counts and the three skipped categories are reported unconditionally, so a pass that changed nothing says so by reporting zeroes against them.

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

### ce-retune

Not ported. Retunes a skill corpus for a new model and refuses without a benchmark harness that can A/B two builds; this repo has no such harness and no build step to A/B.

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
