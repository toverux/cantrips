---
name: cs-code-style
description: Load before writing or editing any C# file (.cs), the moment a task will create or modify C# code and before the first edit. Covers language level, member declaration style, type choice, and naming. The trigger is writing; a session that only reads code leaves it unloaded.
version: 2.0.0
---

# C# Code Style

- Write code that compiles clean under `<TreatWarningsAsErrors>true</TreatWarningsAsErrors>` and strict null-checking (`<Nullable>enable</Nullable>`).
- Use the very latest C# 14 language features.
- Use the `init` and `required` modifiers when appropriate rather than constructor-based parameters.
- Use the compiler-synthesized `field` keyword for backing fields rather than declaring them manually.
- Declare extension methods/properties in C# 14 `extension(Receiver) { ... }` blocks grouped by receiver type, rather than classic `this`-parameter extension methods.
- Choose the data structure type deliberately: class, struct, readonly struct, record class, record struct, readonly record struct, ref struct, or readonly ref struct.
- Prefer `is` and `is not` over `==` and `!=` where applicable.
- Name exception variables `ex` by default (catch clauses, `Assert.Throws` results, etc.).
