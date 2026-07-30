# Finder briefs

Each finder receives the scope block plus its brief(s) below — one angle brief for a correctness finder, one lens brief per lens a quality finder carries.
A finder reviews ONLY through its assigned angle or lenses.
Every finder also re-checks the scope block's matched `docs/solutions/` learnings where they touch its angle, citing the learning file when the diff re-triggers one.

## Correctness angles

### Angle A — line-by-line diff scan

Read every hunk line by line, then read the enclosing function of each hunk — bugs on unchanged lines of a touched function are in scope, since the change re-exposes or fails to fix them.
For every line ask: what input, state, timing, or platform makes this line wrong?
Hunt inverted or wrong conditions, off-by-one, null/undefined dereference, missing `await`, falsy-zero checks, wrong-variable copy-paste, errors swallowed in a catch, unescaped pattern metacharacters.

### Angle B — removed-behavior auditor

For every line the diff deletes or replaces, name the invariant or behavior it enforced, then find where the new code re-establishes it.
When you can't find it, that's a candidate: a removed guard, a dropped error path, a narrowed validation, a deleted test that covered a real case.

### Angle C — cross-file tracer

For each function the diff changes, find its callers (search for the symbol) and check whether the change breaks any call site: a new precondition, a changed return shape, a new exception, an ordering dependency.
Check callees too: does a parallel change in the same diff make a call unsafe?

### Angle D — spec conformance

Compare the diff against the spec fetched in Scope, as amended by its annotations — a decision an annotation already revised is not a mismatch, and code matching the revision conforms.
The spec is a point-in-time decision record, so a candidate presumes neither side is wrong — the code may miss the decision, or the decision may have been revised without the spec being annotated.
Surface: requirements the spec asks for that the diff leaves missing or partial; behavior the diff adds that the spec never asked for; requirements implemented differently than the spec states.
Quote the spec line for each candidate; anchor location-less candidates to the spec and its requirement line.

### Angle E — language-pitfall specialist (high)

Hunt the classic pitfalls of the diff's language and framework — for example JS falsy-zero, `==` coercion, closure-captured loop variables; Python mutable default arguments, late-binding closures; Go nil-map writes, range-variable capture; SQL injection; timezone/DST drift; float equality.
Flag any instance the diff introduces.

### Angle F — wrapper/proxy correctness (high)

When the diff adds or modifies a type that wraps another (cache, proxy, decorator, adapter), check that every method routes through the wrapped instance rather than back through a registry, session, or global — the round trip re-enters the wrapper or recurses.
Check that the wrapper forwards every method its callers actually use.

## Quality lenses

Two rules govern every lens: a documented project standard overrides any lens (where the project endorses something a lens would flag, suppress it), and anything tooling already enforces is skipped.
Quality candidates use the same candidate shape; the `failure_scenario` states the concrete cost — what is duplicated, wasted, or harder to maintain, or which documented rule is broken — instead of a crash.

### Reuse

Flag new code that re-implements something the codebase already has — search shared and utility modules and files adjacent to the change, and name the existing helper to call instead.

### Simplification

Flag unnecessary complexity the diff adds: redundant or derivable state, copy-paste with slight variation, deep nesting, dead code left behind, abstraction built for needs nothing has.
Name the simpler form that does the same job.

### Efficiency

Flag wasted work the diff introduces: redundant computation or repeated I/O, independent operations run sequentially, blocking work added to startup or hot paths, long-lived objects built from closures that retain the whole enclosing scope.
Name the cheaper alternative.

### Design

Load `/codebase-design` first and judge this whole lens in its vocabulary — depth, seam, leverage, locality, the deletion test.

**Altitude:** check that each change is implemented at the right depth, not as a fragile bandaid.
Special cases layered on shared infrastructure signal a fix that isn't deep enough — prefer generalizing the underlying mechanism.

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

### Conventions

Check the diff against the standards sources from Scope.
Flag a violation only when you can quote the exact rule and the exact line that breaks it — no style preferences, no "spirit of the doc" inferences; name the source file so the report can cite it.
