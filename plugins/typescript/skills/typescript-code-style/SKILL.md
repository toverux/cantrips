---
name: typescript-code-style
description: Load before writing or editing any TypeScript or JavaScript file (.ts, .tsx, .js, .jsx), the moment a task will create or modify such code and before the first edit. Covers strictness, style, nullability, immutability, and assertion-based error handling. The trigger is writing; a session that only reads code leaves it unloaded.
version: 2.0.0
---

# TypeScript Code Style

## First: Detect the Project's Assertion Helpers

The narrowing rules below branch on whether the project ships the `nn()` / `ensure*()` assertion helpers.
Detect this once, before your first edit: search the codebase for `nn(`, `nn.assert`, or `ensure` (ex. `ensureString`) as definitions or imports.

- Helpers found: apply the "With `nn()` / `ensure*()` Helpers" section below.
- Helpers absent: apply the "Without Helpers" section below.

Every other section applies to every project.

## TypeScript Strictness

- You are working with TypeScript's strictest settings.
- Never ever use `any`.
  Create types if necessary, derive from existing types, etc.
- Use `unknown` when the value is genuinely unknown.
- Use TypeScript built-in utility types when applicable, and the `type-fest` npm package for more advanced ones.
- In interfaces, use property-style over method-style method signatures; property-style function declarations allow stricter checking under `strictFunctionTypes`.
  Use method shorthand in object literals.

## Style

- Use named function hoisting to place the more important functions at the top: the deeper a function sits in the call stack, the deeper it sits in the file.
  Apply the same to functions inside functions, with helpers at the very bottom.
- Use template literals for strings containing English sentences, even without interpolations: they make single and double quotes inside the sentence painless.

## Nullability

- Prefer `undefined` over `null`; restrict `null` to serialization and interoperability boundaries.
- Use optional chaining (`?.`) very sparsely, only when the value can genuinely be null/undefined.

## Readonly Data

- Prefer immutable data structures.
  When a field must stay mutable, add a comment explaining why.
- Mark class and object properties `readonly` whenever possible, and use `Readonly<T>` when all properties of a type are readonly.

## Type Safety and Guards

- Use `==` and `!=` by default; reserve `===` and `!==` for when strict equality is specifically required (ex. distinguishing `null` from `undefined`).
- Replace the `!` non-null assertion with a runtime assertion that both narrows the type and fails loudly when the invariant is violated; the branch below says which.
  `!` is acceptable only in hot paths to avoid a function call, with the linter warning silenced.
- For cases neither branch covers, see "Assertions and Errors" below.

### With `nn()` / `ensure*()` Helpers

For values that must hold if the program is sound:

- Non-null: `nn(value)` inline when there is a single usage (`example(nn(value))`); `nn.assert(value)` as a precondition check when there are multiple usages.
- Booleans, strings, numbers: `ensureBoolean(value)`, `ensureString(value)`, `ensureNumber(value)`, each with an assertion-style variant (`ensureString.assert(value)`).
- Enum membership: `ensureInEnum(value, enumType)` / `ensureInEnum.assert(value, enumType)` (ex. `ensureInEnum('value', { prop: 'value' })`).
- Unreachable code paths: `unreachable()`, or `unreachable(value)` to record the offending value (ex. in a `switch` statement's `default` case).

### Without Helpers

For values that must hold if the program is sound:

- Assert type narrowing (non-null, boolean, string, number, enum membership) with a helper the project already provides; otherwise with a plain runtime check that throws when the invariant is violated.
- Assert unreachable code paths, ideally including the offending value (ex. in a `switch` statement's `default` case).
  A common pattern types the value as `never` and throws.

## Assertions and Errors

For server/CLI code, and for cases not already covered in "Type Safety and Guards":

- Use assertion-based error handling whenever possible, with `import assert from 'node:assert/strict'`.
- Use `assert()` for type guards when possible, ex. `assert(typeof value === 'string')`.
- Use `assert()` instead of throwing an exception for things that should not happen if the program is sound.
  Operational errors are never assertions.

For client code, throw standard errors.
