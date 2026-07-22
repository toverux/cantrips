<!--
Starter AGENTS.md template. Copy it into your project, replace the placeholder prose and "Ex:"
blocks, and delete any section (or line) your project doesn't need: every line an agent loads costs
context, so keep only what changes its behavior.
Pairs with the grimoire cantrips loop: docs/specs/, docs/solutions/, and the Glossary section are
its conventions; drop them if you don't use it.
-->

# AGENTS.md

## Project overview

Two or three sentences: what the project is, who it serves, and the one architectural fact an agent must know before touching anything.

## Tech stack

Only the tools an agent will actually invoke or write for.
Ex:

- [mise-en-place](https://mise.jdx.dev): manages dev tools, env vars, and tasks for this repo.

## Repository structure

Point the agent at the core modules; skip directories it can infer.
Ex:

- `src`: Source code.
- `tests`: Unit tests.
- `docs/specs`: Feature specs (committed Markdown, one `<feature>.md` per feature; big features get a `<feature>/` directory of tickets alongside).
- `docs/solutions`: Problem-shaped learnings captured by the `/compound` skill (root cause, gotcha, "what didn't work"); search it before diagnosing or re-deciding.

## Commands

The commands an agent needs, each with what it verifies.
Ex:

- `mise build`: Check the project compiles fine.
- `mise check:agents`: Run type checking, formatting and linting, with output optimized for agents.

You can run `mise tasks` to see the full list of shortcut commands; append arguments freely, mise passes them through (ex. `mise some:task --some-arg`).
Do NOT use npx to run commands; prefer mise shortcuts, or bun/bunx when no shortcut exists.

Always run the appropriate check/test commands after performing changes; but do it at the end of the editing session, not in the middle.

## Glossary

Domain terms as this project uses them ("we call this X, not Y"), one line per term.
The `/compound` skill proposes additions here; when the section outgrows AGENTS.md, graduate it to a `CONCEPTS.md` file and leave a pointer.

## Guidelines

Project rules an agent cannot infer from the code.
Ex:

- Never trust the client in networked multiplayer.
- Keep gameplay rules deterministic where possible.
- Separate simulation logic from presentation.

## Boundaries

Never:

- Create a git branch, stage files, or commit work yourself unless the user expressly told you so.
- Commit secrets, tokens, `.env` files, dumps or credentials.
- Modify generated files unless the generation command was run.
- Change public API behavior without calling it out.

Ask first before:

- Adding a dependency.
- Changing database schema or authentication/authorization logic.
- Reworking architecture, or adding background jobs, queues, or external services.
- Performing destructive file or data operations.

## Preferred agent behavior

- Start by inspecting existing patterns.
- Prefer LSP over Grep/Glob/Read for code navigation.
- Make the smallest safe change, but if you think a refactor is overdue, speak up.
- When uncertain, state the assumption and proceed conservatively.
- Propose updates to `AGENTS.md` or `docs/` when you notice a pattern or introduce changes that deserve to be documented for future sessions.
