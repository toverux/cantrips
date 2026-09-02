# Why cantrips

What this plugin does differently from the skill collections it forks, and the reasoning behind each
choice. [README.md](README.md) describes *what* the skills do; this file is *why they are shaped that
way*, for anyone deciding whether the shape suits them.

## Where it came from

Two skill sets are commonly run side by side: [Matt Pocock's
skills](https://github.com/mattpocock/skills) as the drivers — grill the plan, write the spec, slice
the tickets — and [Every's Compound
Engineering](https://github.com/EveryInc/compound-engineering-plugin) as the executant, which does
the work and remembers what happened. The pairing works, and it has three costs:

- **The two sets do not know about each other.** Nothing hands off, so you are the integration layer
  on every task.
- **CE skills are long.** Several run into the hundreds of lines, which makes it hard to audit what
  an agent is about to do.
- **The ecosystem is Claude-first.** Codex CLI users get whatever happens to port.

Cantrips is one loop instead: leaner than CE, more integrated than Pocock's, running on both
harnesses from a single skills tree. It is not a superset — plenty of upstream skills are
deliberately not ported, each with its reason recorded in [FORKS.md](FORKS.md).

It targets engineers who want a deliberate loop they stay in control of, rather than an autonomous
mode that runs ahead of them.

## The design decisions

### A pipeline, not a menu

Every skill ends by naming the next step, and whether to take it in this session or break to a fresh
context.

The alternative — a bag of independent commands — makes you carry the pipeline in your head and
re-answer "which skill now?" at every step. That question was the main tax of running two
uncoordinated sets, so removing it was the first design goal.

Skills also brief each other rather than starting cold: the spec records the test seams `/tdd` will
bite at, `/implement` suggests a `/review-gate` effort level scaled to the diff it just produced, and
`/review-gate` flags anything worth remembering for `/commit`'s learnings scan.

### Ceremony scales to the work

Four tiers — small fix, feature, big/multi-session, bug — because a process that only has one gear
gets abandoned on the work that does not need it. A typo fix does not get a spec.

### Two harnesses, one skills tree

Claude Code and Codex CLI, from the same `skills/` directory, with dual plugin manifests and a
per-skill `agents/openai.yaml` sidecar. The sidecar is load-bearing: Codex ignores
`disable-model-invocation`, so without it a deliberate gate would auto-fire there.

Degradation is designed rather than accidental. Where Codex has no sub-agents, `/review-gate` runs
the same angles inline as a single-pass review **and says so in its report** — a mode that silently
degrades on one harness while reading correct on the other is worse than one that announces itself.

### Storage is a set of verbs, not a path

No skill hard-codes where a spec or a ticket lives. They speak six verbs — publish, fetch and
annotate the spec; publish, fetch and resolve the ticket — and one plain-prose doc per repo
translates each verb for the backend in use: local markdown, GitHub issues via `gh`, or a tracker you
describe in a paragraph.

A bare install runs on defaults with no configuration step, so the abstraction costs nothing to
ignore.

### Memory is gated, tiered, and read back

Automatic memory fails in two ways: it hoards trivia, and it is often write-only. Three rules
address that.

- **Every write is user-gated.** Approve, redirect, or kill. Nothing lands without you.
- **A two-part bar** gates what is even proposed: would it change a future agent's behavior in a
  *different* session, and is it non-obvious and stable? Session-specific noise dies there.
- **It is read back.** `/spec` reads decision memory before proposing anything, `/review-gate`
  re-checks matched learnings against the diff, and `/diagnosing-bugs` opens by searching past
  learnings before it builds a repro. A root cause you already paid for gets caught again.

Learnings route to the cheapest store that serves them: the project's `AGENTS.md`, a decision record,
a problem-shaped solution doc, a rules file, a skill, or your own global memory file. The knowledge
stores are opt-in, and skills skip reads and writes against a store that is off.

`/compound-refresh` garbage-collects, because memory that is never pruned eventually lies. Its prime
directive is *match docs to reality, never the reverse*.

### A spec is a point-in-time record

A spec's body freezes at publication. Work-status lines never enter it, because execution state
already lives in git and in the backend. Afterthoughts arrive as dated annotations, so the original
decision and its revisions stay distinguishable.

The consequence is deliberate: post-loop drift between spec and code is not an error. Code and git
are truth; the spec is history. `/spec` also never mines past specs, so decisions that implementation
abandoned stop propagating, and no skill ever closes a spec — that is your call.

### Finders find, verifiers judge

`/review-gate` is a three-way fork: Pocock's `code-review` for the design principles, a
finder/verifier architecture modeled on Claude Code's built-in reviewer, CE's compounding, and
additions of its own.

A single reviewer reading a diff top to bottom misses bugs for two reasons — attention dilutes across
concerns, and the finder of a candidate bug is a poor judge of it. So finders each hold exactly one
concern, and an independent verifier judges every candidate, returning CONFIRMED, PLAUSIBLE or
REFUTED with evidence. Refuted and unverified candidates never reach a `medium` or `high` report.
A finder that silently drops a bug it half-believes is the failure this structure exists to prevent.

Two further properties:

- **A spec-conformance angle** compares the diff against the spec's requirements, catching "built the
  wrong thing, correctly" — which no code-only review can see. A mismatch is reported neutrally with
  both fixes, because the code may be the side that is right.
- **Effort is a precision/recall dial**, stated as such: `low` is one inline pass, `medium` favors
  precision, `high` favors recall and adds a gap-hunting sweep. `--loop` converges until green — fix
  batch, project checks, delta re-review, then a certifying pass — parking anything that needs you
  until the round ends.

### Auto-fix has a boundary

`--fix` and `/simplify` both respect a **mutation boundary**: the run's target plus the seams it
needs, narrowed to any files you named. A fix that cannot stay inside is handed back rather than
granted a wider scope, and the report says which fixes that cost you.

Safety checks are never simplified away — and in agent-facing prose, a gate or a prohibition counts
as one. Since this plugin is itself prose, both review paths carry a preservation contract for it:
repetition and sediment may go, but no directive, prohibition, gate or completion criterion may be
cut or weakened.

### Tests at agreed seams; refactoring outside the cycle

`/tdd` names the three ways agent-written suites rot and blocks each: **implementation-coupled** tests
that break on refactor, **tautological** assertions that recompute the expected value the way the code
does, and **horizontal slicing** — all tests first, then all code — which verifies imagined behavior.

Tests live only at seams approved at spec time, while the decisions are fresh. And refactoring is
deliberately not part of the red-green-refactor cycle here: it belongs to the review tail,
`/simplify` and `/review-gate`.

### Diagnosis starts with the feedback loop

`/diagnosing-bugs` builds a tight, deterministic, red-capable repro *before* entertaining any theory,
because jumping straight to a hypothesis is the failure it exists to prevent. Hypotheses are then
generated three to five at a time, each falsifiable, because single-hypothesis debugging anchors on
the first plausible idea.

### Grilling inverts the agent's default posture

Agents are agreeable: they fill gaps with silent assumptions and build the wrong thing confidently.
`/grilling` runs rounds over a decision tree, asking the whole frontier each round — every question
whose prerequisites are settled — each numbered and carrying a recommended answer. Facts get looked
up in the environment; *decisions* stay yours.

### Faithfulness to upstream is a maintenance strategy

The obvious failure mode of any fork is drift into an unmergeable state. The answer here is
discipline rather than optimism:

- Where a hunk can stay **byte-identical to upstream, it does** — even where a quality pass finds a
  real improvement in it, because that edit would trade a permanent sync divergence for a redundancy
  upstream chose.
- [FORKS.md](FORKS.md) is a **divergence ledger**: every upstream skill has an entry, forks listing
  exactly how they differ and why, the rest marked not-ported with the reason.
- Each skill's frontmatter pins the exact upstream version it synced from, so updating is a diff
  against upstream rather than guesswork.

### No build

No dependencies, no package manager, no build, no lint step, no test suite. The repository is
Markdown plus a handful of JSON manifests, which means you can read the whole thing before trusting
it with your codebase.

The cost is real and worth naming: every invariant here is honored by hand, and nothing fails when
one drifts. [AGENTS.md](AGENTS.md) lists them.

## What this is not

- **Not autonomous.** There is no hands-off ship-to-PR mode. Every gate that matters waits for you,
  and that is a design choice, not a missing feature. If you want autonomy, CE's outer loop is the
  better fit.
- **Not a superset of its upstreams.** Roughly half of each upstream is deliberately not ported.
  [FORKS.md](FORKS.md) says which and why; [IDEAS.md](IDEAS.md) holds what was deferred rather than
  rejected.
- **Not team-scale tooling.** It targets a solo workflow. PR shepherding, issue triage and inbound
  flows are deferred, not built.
- **Not battle-tested by many people yet.** It is dogfooded daily on this repository and a handful of
  others. Expect rough edges, and please report them.

## Questions

**Does the memory actually get used, or just written?** Read back by three skills: `/spec`,
`/review-gate` and `/diagnosing-bugs`. That was the point of building it.

**Can I run it alongside the upstreams?** Not as whole plugins — uninstall those two first, because
the forks carry the same trigger vocabulary under new names and the duplicates fight each other.
Individual upstream skills are fine: install them one at a time, skipping whatever cantrips already
forks — `npx skills add mattpocock/skills --skill wizard`, say, for one of the skills this plugin
does not port. Roughly half of each upstream is not ported, so this is a real option rather than a
technicality; [FORKS.md](FORKS.md) is the pick list.

**Is it locked to one harness or one tracker?** Neither. Claude Code and Codex CLI both, storage
configurable per repo, MIT-licensed, and both upstreams remain independently installable.

**Is the ceremony worth it on small work?** On a small fix the loop is `/grilling` (optional) →
implement → `/review-gate` → `/commit`. Skip what does not earn its place.

## Where to look next

- [README.md](README.md) — what each skill does, and how to install.
- [FORKS.md](FORKS.md) — every divergence from upstream, with its reason.
- [IDEAS.md](IDEAS.md) — what was considered and deliberately deferred.
- [AGENTS.md](AGENTS.md) — the authoring standard and the invariants held by hand.
- `skills/<name>/SKILL.md` — the authoritative source for any skill. They are meant to be read.
