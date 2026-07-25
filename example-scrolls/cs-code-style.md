---
ward:
  kind: rule
  description: C# style — language level, member declaration style, type choice, and naming.
  version: 1.0.0
  applicability:
    - '**/*.cs'
  scope: project
---

# C# Code Style

Detect the project's facts first, then apply these guidelines.
The mechanical conventions at the end are defaults that yield to whatever the surrounding code already does.

## Detect language version and project settings

Before your first edit, discover:

- The C# language version in use (`<LangVersion>`, otherwise inferred from the target framework).
- The target .NET version(s).
- The project's role: reusable library, ASP.NET Core or console app, or UI app (WPF/WinForms/MAUI). It decides the `ConfigureAwait` branch below.
- Whether `TreatWarningsAsErrors` is enabled.
- Whether `Nullable` is enabled.
- Whether `ImplicitUsings` is enabled, which decides the `using` directives you add or omit.

Store these facts in the project's persistent instruction files (ex. AGENTS.md) so you never rediscover them, and tell the user you recorded them there and why.
When settings differ across projects, record them as a table with one row per project — when every project shares the same settings, record them once under an "all projects" note.

## Language version and features

- Use the newest C# language features available in the detected version.
- Write code that produces no warnings — when one fires, decide deliberately whether to fix the code or suppress it inline with a justification.
- (C# 9) Prefer `is` and `is not` over `==` and `!=` where applicable.
- (C# 11) Use the `init` and `required` modifiers where they fit rather than constructor parameters.
- (C# 14) Use the compiler-synthesized `field` keyword for backing fields rather than declaring them manually.
- (C# 14) Declare extension methods and properties in `extension(Receiver) { ... }` blocks grouped by receiver type, rather than classic `this`-parameter extension methods.
- Choose the data structure type deliberately, from the options the language version offers:
  - `class` for reference-type objects with identity, mutable state, or inheritance; the default choice.
  - `struct` for small, short-lived values allocated inline to avoid GC pressure.
  - (C# 7.2) `readonly struct` for a value that never mutates after construction — it removes defensive copies.
  - (C# 7.2) `ref struct` for a value that must stay on the stack, ex. wrapping a `Span<T>` — it cannot be boxed or heap-allocated.
  - (C# 7.2) `readonly ref struct` for a stack-only value that is also immutable.
  - (C# 9) `record class` for immutable reference-type data compared by value, with `with`-expression copies (DTOs, domain models).
  - (C# 10) `record struct` for small value-type data compared by value, without heap allocation.
  - (C# 10) `readonly record struct` for the same as a fully immutable value — the default small value object.

## Types and members

- Reach for records by default for data-carrying types (DTOs, API contracts, value objects, immutable models), where value equality and `with`-copies come for free; keep plain classes for entities with identity, behavior, or a mutable lifecycle.
- Mark concrete classes `sealed` by default; open one for inheritance only when it is designed as a base.
- (C# 12) Use a primary constructor for the dependency-capture case (services, controllers, handlers) where parameters are only ever read; fall back to a classic constructor when a parameter needs `readonly` enforcement, validation, or transformation before storage.
- Mark a field `readonly` whenever it is assigned only at declaration or in the constructor, and prefer immutable shapes (init-only properties, `readonly struct`); when a field must stay mutable, add a comment saying why.
- Prefer a local function over a lambda for a named in-method helper (real stack frames, recursion, no delegate allocation); reserve lambdas for LINQ and delegates passed as arguments. Mark a non-capturing local function or lambda `static` (static local functions from C# 8, static lambdas from C# 9).
- Return multiple values as a named tuple `(int Count, string Name)` for lightweight local or private results, or as a `record` when the shape is public, reused, or deserves a name; reserve `out` parameters for the `Try*` pattern.
- (C# 8) Use a `using` declaration (`using var x = ...;`) when the resource lives to the end of its scope, and a `using (...)` block only to dispose earlier; prefer `await using` for resources with async teardown. A `sealed` disposable implements a plain `Dispose()` without the `protected virtual Dispose(bool)` and finalizer ceremony.

## Nullability, guards, and errors

- With `Nullable` enabled, annotate a reference type `?` only when it can genuinely be null, and use `?.`, `??`, `??=` only over genuinely nullable values — never as defensive padding over values the flow analysis already proves non-null.
- Prove non-null through checks, pattern matching, and early guards rather than the `!` null-forgiving operator; use `!` only where non-nullness is provable but inexpressible to the compiler (ex. after a `TryGetValue` guarded by its `bool`), with a comment saying why.
- Trust the nullable annotations instead of validating arguments routinely; validate only at trust boundaries (public API surface, deserialization, external input), preferring the framework throw-helpers over hand-written `if`/`throw`: (.NET 6) `ArgumentNullException.ThrowIfNull`, (.NET 7) `ArgumentException.ThrowIfNullOrEmpty`, (.NET 8) `ThrowIfNullOrWhiteSpace` and `ArgumentOutOfRangeException.ThrowIf*`.
- Throw an always-on exception for a broken invariant — `InvalidOperationException`, or (.NET 7) `throw new UnreachableException()` for code that should be unreachable — so violations surface in production too; reserve `Debug.Assert` for expensive checks you are content to strip from release builds.
- Handle operational failures (I/O, bad external input) with idiomatic exceptions rather than a `Result<T>` type: reuse framework exception types, and add a custom one only when callers must catch it distinctly.
- Preserve the stack with `throw;` rather than `throw ex;`, and wrap with an inner exception when adding context (`throw new X(message, ex)`); catch only what you can handle, avoiding a bare `catch (Exception)` outside a top-level boundary.
- Name exception variables `ex` by default (catch clauses, `Assert.Throws` results, etc.).

## Collections and LINQ

- (C# 12) Initialize collections with collection expressions and spreads (`[]`, `[a, b, c]`, `[.. first, .. second]`) in target-typed positions (fields, properties, returns, arguments), over `new[] { ... }`, `new List<T> { ... }`, and `.Concat(...).ToList()`. Materialize a fluent chain with `.ToArray()` or `.ToList()` at its tail, and reach for a spread only when it reads better than a chain.
- Write LINQ in method (fluent) syntax by default; switch to query syntax only where it genuinely reads better (multiple joins, `let` bindings, complex group-by).
- Use LINQ for declarative map/filter/reduce where it reads clearly, and a `foreach` when the body has side effects (never side-effect inside `Select` or `Where`), when there is early exit with accumulating state, or in a measured hot path — dropping to a loop whenever it reads clearer.
- At public boundaries, return the narrowest read-only abstraction that fits (`IReadOnlyList<T>` / `IReadOnlyCollection<T>`, or `IEnumerable<T>` for a lazy sequence) when the collection is shared or aliased internal state a caller could mutate into a side effect; a freshly produced collection the caller solely owns may be returned as a plain `List<T>` or array. Accept `IEnumerable<T>` on parameters unless you need count or random access.

## Control flow

- (C# 8) Prefer a `switch` expression over a `switch` statement when a branch yields a value, and use pattern matching (type, property, and from C# 9 relational and logical `and`/`or`/`not`) to collapse conditional chains — as deep as it reads clearly, backing off to plainer forms when a pattern turns cryptic. Let an unmatched `switch` expression throw, or use `throw new UnreachableException()` in a `default`, per the invariant rule above.
- Flatten nesting with guard clauses and early returns so the happy path stays at the left margin. Use a ternary for simple one-line either/or selection; nest or chain ternaries only when that genuinely reads better than the alternatives.

## Strings

- Build strings with `$"..."` interpolation over `+` concatenation and `string.Format`; (C# 11) use raw string literals (`"""`) for multi-line or embedded-quote content (JSON, SQL, regex); use a `StringBuilder` for iterative accumulation; and use `nameof(member)` over a hard-coded member name.

## Async

- Suffix async method names with `Async`, matching the surrounding code where it has already settled a convention.
- Return `Task` / `Task<T>` by default, and `ValueTask` only in a measured hot path that usually completes synchronously.
- Use `async void` only for event handlers; every other async method returns `async Task`.
- Accept a `CancellationToken` as the last parameter (`= default` on public APIs) and flow it through to inner async calls.
- Await results rather than blocking on them (`.Result`, `.Wait()`, `.GetAwaiter().GetResult()`), and prefer `await` over returning the `Task` directly except for a trivial pass-through.
- Apply `ConfigureAwait(false)` to every context-independent await in library or shared code; omit it in app code with no synchronization context (ASP.NET Core, console); in a UI app, capture context only when resuming onto the UI thread, per the project role from detection.

## Mechanical conventions

These are defaults, not law: where the surrounding code already follows a convention, match it instead of imposing these.

- Use `var` everywhere the language allows it.
- (C# 9) Use target-typed `new()` for fields and properties where the type is already on the line, and an explicit `new Type()` in return and argument positions where the type is not on screen. For collection-typed members, use a collection expression `[]` instead (see Collections and LINQ).
- (C# 10) Declare namespaces file-scoped (`namespace Foo;`); use a block only for a file that needs more than one namespace.
- Use expression-bodied members for any member that is a single expression on one readable line; keep block bodies for multi-statement members and for constructors and finalizers.
- State every access modifier explicitly, including `private` members and `internal` types.
- Qualify every instance member access with `this.` (fields, properties, methods, events) and every static member with its declaring type name (`OrderService.MaxRetries` even inside `OrderService`); a bare member name is never written.
- Name instance fields in `camelCase` without a leading underscore, constants and `static readonly` fields in `PascalCase`, and boolean members with an affirmative `Is`/`Has`/`Can`/`Should` prefix. Write two-letter acronyms all-caps (`IOStream`) and longer ones PascalCase (`HtmlNode`), treating `Id` and `Ok` as words. Name a sole type parameter `T`, and several descriptively (`TKey`, `TValue`, `TResult`). Give each variable a distinct name rather than shadowing one from an outer scope.
- Order a type's members by kind — constants, fields, constructors, properties, methods, nested types — public before private within each group; inside a method body, order local functions by call flow, entry logic first and helpers below.
- Place `using` directives at the top of the file above the namespace, `System.*` first then the rest alphabetical.
- Write one attribute per line rather than stacking several in one `[...]`.
- Keep XML-doc tag content flush with the `///`, never indented under the tag.
- Keep each type small enough to navigate without `#region`.
