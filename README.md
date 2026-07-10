# @toverux's skills and rules

These are personal agent skills and rules I use a lot and share across projects.

They are either completely portable and generic or depend lightly on things I have set up in pretty
much any of my projects.

## AGENTS.md Template

In [agents-md-template.md](agents-md-template.md), you can find the template for AGENTS.md I use in
all of my projects.
Adapt it, change it, fill the gaps.

## Skills

| Name                                                     | Description                                                                                                                                                                                                                             | Fully generic | Agent-invokable | Notes                                                                                                                                                                                                                                                                                                                                            |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [general-guidelines](skills/general-guidelines/SKILL.md) | Behavioral guidelines to reduce common LLM coding mistakes. Always use this when writing, reviewing, or refactoring code to avoid overcomplication, make surgical changes, surface assumptions, and define verifiable success criteria. | Yes           | Yes             | Inspired from Karpathy's guidelines, with [Surgical Changes](https://github.com/multica-ai/andrej-karpathy-skills/blob/main/skills/karpathy-guidelines/SKILL.md#3-surgical-changes) removed: agents cornered into being too surgical will accumulate technical debt over time, and today models are smart enough not to need these instructions. |

## Rules

| Name                                                                      | Description                                                                                          | Fully generic                                                       | Matches                | Notes                                                                                                                                                        |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [general-code-style](rules/general-code-style.md)                         | Language-agnostic style: line breaks, 100-char line length, comments, and docblocks.                 | Yes                                                                 | `**/*`                 | Assumes a 100-character line length and wikilink references in non-Markdown files.                                                                           |
| [cs-code-style](rules/cs-code-style.md)                                   | C# code style guidelines.                                                                            | Almost — assumes C# 14, `Nullable` and `TreatWarningsAsErrors`      | `**/*.cs`              |                                                                                                                                                              |
| [typescript-code-style](rules/typescript-code-style.md)                   | TypeScript code style: strictness, nullability, `readonly` data, and assertion-based type guards.    | No — assumes project helpers (`nn()`, `ensure*()`, `unreachable()`) | `**/*.{js,jsx,ts,tsx}` | Pick this **or** [typescript-code-style-no-utils](rules/typescript-code-style-no-utils.md), not both (same glob). Also opinionated: prefers `==` over `===`. |
| [typescript-code-style-no-utils](rules/typescript-code-style-no-utils.md) | Same as typescript-code-style but with plain runtime checks instead of the custom assertion helpers. | Almost — assumes TypeScript's strictest settings                    | `**/*.{js,jsx,ts,tsx}` | Variant of [typescript-code-style](rules/typescript-code-style.md) for projects without the `nn()`/`ensure*()` utilities.                                    |

## Authoring documents

I recommend installing this skill globally:
`skills add mattpocock/skills --skill writing-great-skills`.

Run `oxfmt` to format Markdown files in this repo (no configuration committed, defaults are fine).

> [!TIP]
> To run `skills` or `oxfmt`, you can use npx and alikes, ex. `bunx skills@latest`.
