# Quality lenses

The shared hunt taxonomy, read by `/review-gate`'s quality finders and by `/simplify`'s fixers.
A carrier reviews ONLY through the lens or lenses it was assigned, and reads each one's restraints with it; the calling skill supplies its own contract — what to do with a finding, and the shape to return it in.

Rules governing every lens:

- A documented project standard overrides any lens: where the project endorses something a lens would flag, suppress it.
- Skip anything tooling already enforces.
- Where the changed material is agent-facing prose, what a fix must preserve is the instruction set.
  Repetition and sediment may go; a sentence that directs an agent to act, forbids an action, gates a step behind a condition, or states how completion is judged may not be cut or weakened.
  Where a sentence's kind is uncertain, it stays.

## Reuse

Flag new code that re-implements something that already exists, and name the thing to call instead.

- **Duplicated helper** — a new function covering what a utility directory, shared module, or adjacent file already provides; search those before concluding it is new.
- **Inline logic an existing utility covers** — hand-rolled string work, manual path handling, custom environment checks, ad-hoc type guards.
- **Reimplemented primitive** — a manual dedup loop where the language ships a set-based idiom, a hand-rolled deep clone where the runtime has one.
- **Hand-maintained guarantee** — code maintaining by hand what the platform, framework, or a verified downstream layer already guarantees; name the layer, and what the code collapses to without the hand-maintained version.

Restraints:

- Suggest a built-in only where it is behavior-equivalent for the inputs actually in play — locale-dependent formatting, sort-stability assumptions, native UI controls and serialization edge cases differ from hand-rolled versions.
- Remove a hand-maintained guarantee only where every output, error, side effect and ordering is preserved for current consumers.
  Scope the removal to the behavior the guarantee directly owns and keep the surrounding transformations; do not pair it with a serializer or coercion swap absent tests or direct comparisons proving exact equivalence; branches that become reachable only because the removal happened are not dead code.
- A swap that reads worse than what it replaces is not an improvement, however much duplication it retires.

**On agent-facing prose:** an instruction another file already carries — a restated rule, a re-explained format, a definition repeated at the point of use — where a pointer would do.

## Simplification

Flag unnecessary complexity the change adds, and name the simpler form that does the same job.

- **Redundant or derivable state** — state duplicating state, a cached value derivable from its source, an observer or effect that could be a direct call.
- **Copy-paste with slight variation** — near-duplicate blocks.
- **Weak boundaries** — parameters added instead of generalizing or restructuring what is there; internals exposed past an abstraction boundary; a raw string where a constant, enum or branded type already exists.
- **Needless structure** — nesting three or more levels deep; an abstraction built for needs nothing has; in component-tree UI frameworks (React, Vue, Svelte, SwiftUI, Compose…), a wrapper container adding no layout value.
- **Comments that narrate** — explaining WHAT the code does, describing the change, or naming the task.
- **Dead code left behind** — unreachable paths, unused imports, unused exports.

Restraints:

- Before proposing a shared abstraction for a duplicate, check whether the duplicate can be eliminated instead, derived from an existing source of truth.
  Consolidate only where elimination would not preserve behavior.
  Eliminating it by leaning on a platform, framework or downstream guarantee is the Reuse lens's call, under the conditions printed there — do not propose it from this lens.
- Flatten nesting with early returns, guard clauses, a lookup table, or an if/else-if cascade, and name which.
- Keep the non-obvious WHY: hidden constraints, subtle invariants, workarounds.
- Verify "unused" with the project's dead-code linter where one is configured, else a structural search (`ast-grep`) over plain grep, which false-positives on strings, comments and substring matches.
  Account for re-exports, dynamic imports and framework-magic exports; a false positive costs more here than a miss, so skip when uncertain.
- **Balance** — the goal is faster comprehension, not fewer lines, and every flag above has a failure mode in the opposite direction.
  Keep a helper that gives a concept a name, keep unrelated logic in separate functions, and keep an abstraction that exists for testability or whose purpose you have not confirmed obsolete — establish the original intent (`git blame`) before calling it dead.
  Drop any proposed change that would read longer or harder to follow than the original.

**On agent-facing prose:** sediment the file no longer needs — a paragraph restating the section above it, a rule the reader was already given, a step that no longer does anything, indirection through a file that adds nothing on the way.

## Efficiency

Flag wasted work the change introduces, and name the cheaper alternative.

- **Unnecessary work** — redundant computation, repeated file reads, duplicate network or API calls, N+1 patterns, and operations broader than needed: a whole file read for a portion of it, every item loaded to filter for one.
- **Missed concurrency** — independent operations run sequentially.
- **Hot-path bloat** — blocking work added to startup or to per-request/per-render paths.
- **Recurring no-op updates** — state or store writes inside polling loops, intervals, or handlers that fire unconditionally; the fix is a change-detection guard.
- **Existence pre-checks** — checking that a file or resource exists before operating on it (TOCTOU); operate directly and handle the error.
- **Memory** — unbounded data structures, missing cleanup, event listener leaks, and long-lived objects built from closures that retain the whole enclosing scope.

Restraints:

- Where a wrapper takes an updater callback, verify it honors same-reference returns, or callers' early-return no-ops are silently defeated.

**On agent-facing prose:** content loaded that the reader never uses — a reference file pulled in for one line of it, a brief pasted where a pointer would serve, a section every carrier pays for and one needs.

## Design

Load `/codebase-design` first and judge this whole lens in its vocabulary — depth, seam, leverage, locality, the deletion test.

**Altitude:** check that each change is implemented at the right depth, not as a fragile bandaid.
A special case layered on shared infrastructure, the same defect guarded at each call site rather than at its origin, a workaround for a behavior the diff itself introduces — each signals a fix that isn't deep enough; prefer generalizing the underlying mechanism.
Flag it only where the special case will recur, or already has — a one-off that stays a one-off is cheaper than the generalization it would justify.

**Design smells:** each smell is a labelled judgement call ("possible Feature Envy"), never a hard violation; each reads _what it is_ → _how to fix_ (Fowler, _Refactoring_ ch. 3):

- **Mysterious Name** — a name that doesn't reveal what it does or holds. → rename; if no honest name comes, the design's murky.
- **Feature Envy** — a method reaching into another object's data more than its own. → move the method onto the data it envies.
- **Data Clumps** — the same few fields or params travelling together. → bundle them into one type, pass that.
- **Primitive Obsession** — a primitive standing in for a domain concept. → give the concept its own small type.
- **Repeated Switches** — the same `switch`/`if`-cascade on the same type recurring across the change. → polymorphism, or one shared map.
- **Shotgun Surgery** — one logical change forcing scattered edits across many files. → gather what changes together into one module.
- **Divergent Change** — one module edited for several unrelated reasons. → split so each module changes for one reason.
- **Message Chains** — long `a.b().c().d()` navigation the caller shouldn't depend on. → hide the walk behind one method on the first object.
- **Middle Man** — a class or function that mostly delegates onward. → cut it, call the real target direct.
- **Refused Bequest** — an implementer ignoring or overriding most of what it inherits. → drop the inheritance, use composition.

**On agent-facing prose:** the smells above are code shapes, and altitude alone carries over — a rule patched into one skill that every caller needs, a special case bolted onto a shared reference instead of generalized into it, an instruction added at the call site where the mechanism was the honest home.

## Conventions

Check the changed material against the standards sources your brief supplies.
Flag a violation only when you can quote the exact rule and the exact line that breaks it — no style preferences, no "spirit of the doc" inferences; name the source file so the report can cite it.
