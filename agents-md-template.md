# AGENTS.md

## Project overview

Project-specific overview.

## Tech stack

Project-specific tech stack. Ex:

- [mise-en-place](https://mise.jdx.dev): A tool to manage dev tools, env vars, and tasks per project.

## Repository structure

Project-specific repository structure to point the agent to core modules. Ex:

- `src`: Source code.
- `tests`: Unit tests.

## Commands

You can run `mise tasks` to see the full list of shortcut commands. Do NOT use npx to run commands, always prefer mise shortcuts, or bun/bunx if there is no dedicated mise shortcut.

- `mise build`: Check that the project compiles fine.
- `mise check:agents`: Run type checking, formatting, and linting, with optimized output.

Always run the appropriate check/test commands after performing changes; but do it at the end of the editing session, not in the middle.

## Guidelines

Project-specific guidelines. Ex:

- Never trust the client in networked multiplayer.
- Keep gameplay rules deterministic where possible.
- Separate simulation logic from presentation.

## Boundaries

Never:

- Create a git branch, stage files, or commit work yourself unless the user expressly told you so.
- Commit secrets, tokens, `.env` files, dumps, or credentials.
- Modify generated files unless the generation command was run.
- Change public API behavior without calling it out.
- Add large dependencies for small utilities.

Ask first before:

- Adding a dependency.
- Changing database schema.
- Changing authentication/authorization logic.
- Reworking architecture.
- Adding background jobs, queues, or external services.
- Performing destructive file or data operations.

## Preferred agent behavior

- Start by inspecting existing patterns.
- Prefer LSP over Grep/Glob/Read for code navigation.
- Make the smallest safe change, but if you think a refactor is overdue, speak up.
- Prefer editing existing files over creating parallel abstractions.
- When uncertain, state the assumption and proceed conservatively.
- Propose updates to `AGENTS.md` or `docs/` when you notice a pattern or introduced changes that deserve to be documented for future sessions.
