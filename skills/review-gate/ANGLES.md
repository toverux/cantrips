# Correctness angles

Each correctness finder receives the scope block plus one angle brief below, and reviews ONLY through that angle.
The quality lenses live in [QUALITY-LENSES.md](QUALITY-LENSES.md).

## Angle A — line-by-line diff scan

Read every hunk line by line, then read the enclosing function of each hunk — bugs on unchanged lines of a touched function are in scope, since the change re-exposes or fails to fix them.
For every line ask: what input, state, timing, or platform makes this line wrong?
Hunt inverted or wrong conditions, off-by-one, null/undefined dereference, missing `await`, falsy-zero checks, wrong-variable copy-paste, errors swallowed in a catch, unescaped pattern metacharacters.

## Angle B — removed-behavior auditor

For every line the diff deletes or replaces, name the invariant or behavior it enforced, then find where the new code re-establishes it.
When you can't find it, that's a candidate: a removed guard, a dropped error path, a narrowed validation, a deleted test that covered a real case.

## Angle C — cross-file tracer

For each function the diff changes, find its callers (search for the symbol) and check whether the change breaks any call site: a new precondition, a changed return shape, a new exception, an ordering dependency.
Check callees too: does a parallel change in the same diff make a call unsafe?

## Angle D — spec conformance

Compare the diff against the spec fetched in Scope, as amended by its annotations — a decision an annotation already revised is not a mismatch, and code matching the revision conforms.
The spec is a point-in-time decision record, so a candidate presumes neither side is wrong — the code may miss the decision, or the decision may have been revised without the spec being annotated.
Surface: requirements the spec asks for that the diff leaves missing or partial; behavior the diff adds that the spec never asked for; requirements implemented differently than the spec states.
Quote the spec line for each candidate; anchor location-less candidates to the spec and its requirement line.

## Angle E — language-pitfall specialist (high)

Hunt the classic pitfalls of the diff's language and framework — for example JS falsy-zero, `==` coercion, closure-captured loop variables; Python mutable default arguments, late-binding closures; Go nil-map writes, range-variable capture; SQL injection; timezone/DST drift; float equality.
Flag any instance the diff introduces.

## Angle F — wrapper/proxy correctness (high)

When the diff adds or modifies a type that wraps another (cache, proxy, decorator, adapter), check that every method routes through the wrapped instance rather than back through a registry, session, or global — the round trip re-enters the wrapper or recurses.
Check that the wrapper forwards every method its callers actually use.
