# @toverux's skills and rules

These are personal agent skills and rules I use a lot and share across projects.

They are either completely portable and generic or depend lightly on things I have set up in pretty
much any of my projects.

## Recommended plugins and skills

Curated set of third-party plugins and skills I like to have with me, the kind you install globally once.

### Plugins

- [chrome-devtools-mcp@claude-plugins-official](https://github.com/ChromeDevTools/chrome-devtools-mcp) — Control and inspect a live Chrome browser from your coding agent.
- [playwright@claude-plugins-official](https://github.com/anthropics/claude-plugins-public/tree/main/external_plugins/playwright) — Browser automation and end-to-end testing MCP server by Microsoft.
- [claude-code-setup@claude-plugins-official](https://github.com/anthropics/claude-plugins-official/tree/main/plugins/claude-code-setup) — Analyze codebases and recommend tailored Claude Code automations such as hooks, skills, MCP servers, and subagents.
- [claude-md-management@claude-plugins-official](https://github.com/anthropics/claude-plugins-official/tree/main/plugins/claude-md-management) — Tools to maintain and improve CLAUDE.md files - audit quality, capture session learnings, and keep project memory current.
- [context7@claude-plugins-official](https://github.com/anthropics/claude-plugins-public/tree/main/external_plugins/context7) — Upstash Context7 MCP server for up-to-date documentation lookup.
- [frontend-design@claude-plugins-official](https://github.com/anthropics/claude-plugins-official/tree/main/plugins/frontend-design) — Create distinctive, production-grade frontend interfaces with high design quality.
- [codex@openai-codex](https://github.com/openai/codex-plugin-cc) — Use Codex from inside Claude Code for code reviews or to delegate tasks to Codex.

### Skills

- [Skills For Real Engineers](https://github.com/mattpocock/skills) — Skills by Matt Pocock. 
- [Compound Engineering](https://github.com/EveryInc/compound-engineering-plugin) — AI skills that make each unit of engineering work easier than the last. (Also a plugin, but brings a lot)

## AGENTS.md Template

In [agents-md-template.md](agents-md-template.md), you can find the template for AGENTS.md I use in
all of my projects.
Adapt it, change it, fill the gaps.

## Skills

| Name                                                     | Description                                                                                                                                                                                                                             | Fully generic                                                                                                    | Agent-invokable | Notes                                                                                                                                                                                                                                                                                                                                            |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [general-guidelines](skills/general-guidelines/SKILL.md) | Behavioral guidelines to reduce common LLM coding mistakes. Always use this when writing, reviewing, or refactoring code to avoid overcomplication, make surgical changes, surface assumptions, and define verifiable success criteria. | Yes                                                                                                              | Yes             | Inspired from Karpathy's guidelines, with [Surgical Changes](https://github.com/multica-ai/andrej-karpathy-skills/blob/main/skills/karpathy-guidelines/SKILL.md#3-surgical-changes) removed: agents cornered into being too surgical will accumulate technical debt over time, and today models are smart enough not to need these instructions. |
| [grill-me](skills/grill-me/SKILL.md)                     | Grill the user relentlessly about a plan, decision, or idea. Interviews you one question at a time, walking down each branch of the decision tree until shared understanding is reached.                                                | Almost — the "How to ask" section targets the Claude Code harness (AskUserQuestion), but says to adapt as needed | No              | This is a personal fork over [Matt Pocock's /grilling skill](https://github.com/mattpocock/skills/blob/main/skills/productivity/grilling/SKILL.md) encouraging it to use the `AskUserQuestion` tool.                                                                                                                                             |

## Rules

| Name                                                                      | Description                                                                                          | Fully generic                                                       | Matches                | Notes                                                                                                                                                        |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [general-code-style](rules/general-code-style.md)                         | Language-agnostic style: line breaks, 100-char line length, comments, and docblocks.                 | Yes                                                                 | `**/*`                 | Assumes a 100-character line length and wikilink references in non-Markdown files.                                                                           |
| [cs-code-style](rules/cs-code-style.md)                                   | C# code style guidelines.                                                                            | Almost — assumes C# 14, `Nullable` and `TreatWarningsAsErrors`      | `**/*.cs`              |                                                                                                                                                              |
| [typescript-code-style](rules/typescript-code-style.md)                   | TypeScript code style: strictness, nullability, `readonly` data, and assertion-based type guards.    | No — assumes project helpers (`nn()`, `ensure*()`, `unreachable()`) | `**/*.{js,jsx,ts,tsx}` | Pick this **or** [typescript-code-style-no-utils](rules/typescript-code-style-no-utils.md), not both (same glob). Also opinionated: prefers `==` over `===`. |
| [typescript-code-style-no-utils](rules/typescript-code-style-no-utils.md) | Same as typescript-code-style but with plain runtime checks instead of the custom assertion helpers. | Almost — assumes TypeScript's strictest settings                    | `**/*.{js,jsx,ts,tsx}` | Variant of [typescript-code-style](rules/typescript-code-style.md) for projects without the `nn()`/`ensure*()` utilities.                                    |

## Hooks

Claude Code hooks that run on tool events. Unlike skills, hooks are wired up per project in
`.claude/settings.json` (see below).

| Name                                            | Description                                                                                                                               | Fully generic                       | Notes                                                                                                                                                                                                                                                                      |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [check-line-length](hooks/check-line-length.sh) | `PostToolUse` hook that warns Claude, with the offending line numbers, when a source file it just edited exceeds the 100-character limit. | Almost — needs `bash`, `jq`, `awk`. | Configurable per language via env vars (see below). Pairs with [general-code-style](rules/general-code-style.md). Exempts one-line lint suppression comments and non-source files; long strings and files where the limit does not apply are left to the agent's judgment. |

### check-line-length

Copy the script into the project (ex. `.claude/hooks/`) and register it in `.claude/settings.json`.
Configure the target language with two environment variables prefixed on the command (the defaults
target JS/TS):

- `CHECK_LINE_LENGTH_EXTENSIONS`: space-separated extensions to check, without dots.
- `CHECK_LINE_LENGTH_SUPPRESSION`: extended regex matching one-line suppression directives to exempt
  from the limit (empty disables the exemption).

JS/TS (the defaults, shown explicitly):

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "CHECK_LINE_LENGTH_EXTENSIONS='ts tsx js jsx mjs cjs' CHECK_LINE_LENGTH_SUPPRESSION='oxlint-disable|eslint-disable|biome-ignore|@ts-expect-error|@ts-ignore' bash .claude/hooks/check-line-length.sh"
          }
        ]
      }
    ]
  }
}
```

## Versioning

Every skill, rule, and hook carries a [semver](https://semver.org) `version` so a copy pulled into a
project can be compared against the source of truth here:

- **Skills and rules:** a `version` field in the frontmatter.
- **Hooks:** a `# Version:` comment near the top of the script.

Bump the version whenever you change a component's content, so downstream copies can tell they are out
of date.

## Authoring documents

I recommend installing this skill globally:
`skills add mattpocock/skills --skill writing-great-skills`.

Run `oxfmt` to format Markdown files in this repo (no configuration committed, defaults are fine).

> [!TIP]
> To run `skills` or `oxfmt`, you can use npx and alikes, ex. `bunx skills@latest`.
