# Sub-agent capabilities in Claude Code and Codex CLI

Research date: 2026-10-01. Findings apply to **Claude Code 2.1.286** (installed; latest release,
2026-09-30) and **Codex CLI 0.155.1** (installed) checked against **0.159.3** (latest stable,
2026-09-30); `rust-v0.161.0-alpha.*` pre-releases were not read. Claude Code sources: the docs at
code.claude.com (fetched as Markdown the same day), its changelog page, and what this session and a
`claude -p` probe expose. Codex sources: openai/codex at tags
[`rust-v0.155.1`](https://github.com/openai/codex/tree/rust-v0.155.1) (`be2951e`) and
[`rust-v0.159.3`](https://github.com/openai/codex/tree/rust-v0.159.3), its GitHub release notes, the
OpenAI docs, and the local install (`codex features list`, `~/.codex/models_cache.json`, and the
session rollouts of 2026-09-19).

Each claim is labelled by evidence: **documented** (vendor docs or changelog), **in source** (code
at the cited tag), **observed** (this machine). Where they disagree, the note says so; anything
marked _not established_ was looked for and not settled.

Context: the plugin's skills hedge per harness ("where the harness supports it", "where the harness
cannot message a sub-agent it spawned", the Codex clause of the "Model selection" paragraph), and
[ADR 0005](../adr/0005-an-authoritative-arbiter-of-proportionality-in-the-review-gate.md) records a
2026-09-19 test of both harnesses. This note is meant to decide which hedges can go.

## Summary table

The Codex column depends on which multi-agent surface a session gets — **V1** or **V2** — and that
is chosen per model by OpenAI's model catalog, not by the feature list (see
[Spawning](#1-spawning-a-sub-agent)). On 2026-09-19 the catalog put the default model on V2.

| Capability | Claude Code 2.1.286 | Codex CLI 0.155.1 / 0.159.3 |
| --- | --- | --- |
| 1. Spawn from a session | Yes, on by default: `Agent` tool (`prompt`, `description`, `subagent_type`, `model`, `isolation`, `run_in_background` outside fork mode) | Yes, on by default: `spawn_agent`. V1: `message`/`items`, `agent_type`, `fork_context`, `model`, `reasoning_effort`. V2: `task_name`, `message`, `fork_turns`, `model`, `reasoning_effort`, `agent_type` |
| 2. Parallel fan-out | Yes. Cap of 20 running sub-agents (`CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`, 2.1.217+) | Yes, low cap. V2: 4 slots including the parent, so 3 children; finished children are unloaded on demand. V1: 6 threads, and finished children hold their slots until `close_agent`. Past the cap a spawn fails with `AgentLimitReached` |
| 3. Background dispatch | Yes, the default. Interactive sessions run in fork mode (2.1.232+), which removes `run_in_background`; `-p` and the SDK keep it. A completion notification arrives in a later turn | Yes, always: the spawn returns at once. The result lands in the parent's context without starting a turn of its own; `wait_agent` blocks until it does |
| 4. Model / named agent per dispatch | `model` enum `sonnet`/`opus`/`haiku`/`fable`; `subagent_type` names a definition. Definitions are Markdown + YAML frontmatter; **plugins ship them** in `agents/` | `model` + `reasoning_effort` (V2: by default, and not on a full-history fork). `agent_type` is exposed only once the user defines a role. Roles are TOML in `~/.codex/agents/` or `.codex/agents/`; **plugins cannot ship them** |
| 5. Follow-up to a spawned agent | Yes: `SendMessage` (`to` = agent ID or name) resumes it with its context (2.1.77+). Not Explore/Plan, which are one-shot | Yes. V1: `send_input` (`interrupt` flag). V2: `send_message` (starts no turn), `followup_task` (starts one). V2 lets config drop both (`disable_direct_message`, 0.158.0+, default off) |
| 6. Close / stop / release | No close step and none needed: completed agents hold no slot. `TaskStop` stops a running one, and a later `SendMessage` resumes it | V1: `close_agent` (needed to free a slot) and `resume_agent`. V2: no close; `interrupt_agent` (renamed from `close_agent` in 0.139.0), and finished children are unloaded automatically |
| 7. Typed output channel | Not on `Agent`, which returns prose. Typed only in a Workflow script: `agent(prompt, {schema})`, validated with up to 5 retries. `ReportFindings` exists, but only to render findings in the main conversation | None. A child's result is a string (`completed: string \| null`); `codex exec --output-schema` covers a whole non-interactive session, not a child |

## 1. Spawning a sub-agent

**Claude Code.** The model gets an `Agent` tool (named `Task` until 2.1.63, which still works as an
alias)
([sub-agents#restrict-which-subagents-can-be-spawned](https://code.claude.com/docs/en/sub-agents#restrict-which-subagents-can-be-spawned)).
It is listed with no permission required
([tools-reference](https://code.claude.com/docs/en/tools-reference)). Background agent support
dates from 2.0.60, 2025-12-06
([changelog](https://code.claude.com/docs/en/changelog)).
_Observed, 2.1.286:_ in this background sub-agent session the schema is `description`, `prompt`
(required), `subagent_type`, `model` (enum `sonnet`, `opus`, `haiku`, `fable`), and `isolation`
(enum `worktree`, `remote`). A `claude -p --setting-sources project` probe saw the same schema plus
`run_in_background`. Its stream-json `init` event lists the tool under the legacy name `Task`.
Neither schema has the `name` parameter the docs describe
([sub-agents#subagent-names](https://code.claude.com/docs/en/sub-agents#subagent-names)); whether
the main interactive session has one is _not established_.

**Codex CLI.** _Documented:_ sub-agents are "enabled by default"; `[agents] enabled` defaults to
`true` ([Subagents](https://developers.openai.com/codex/subagents), which 308-redirects to
learn.chatgpt.com/docs/agent-configuration/subagents).
_In source:_ two tool surfaces exist.

- **V1**: in the `multi_agent_v1` namespace, `spawn_agent`, `send_input`, `wait_agent`,
  `resume_agent` and `close_agent`
  ([spec_plan.rs#L1344-L1369](https://github.com/openai/codex/blob/rust-v0.155.1/codex-rs/core/src/tools/spec_plan.rs#L1344-L1369)).
  When tool search is on these are deferred, so the model has to search before it can call them
  (same lines; release 0.133.0, #23144).
- **V2**: in the `collaboration` namespace by default, `spawn_agent`, `send_message`,
  `followup_task`, `wait_agent`, `interrupt_agent` and `list_agents`
  ([spec_plan.rs#L1285-L1343](https://github.com/openai/codex/blob/rust-v0.155.1/codex-rs/core/src/tools/spec_plan.rs#L1285-L1343),
  [config/mod.rs#L242](https://github.com/openai/codex/blob/rust-v0.155.1/codex-rs/core/src/config/mod.rs#L242)).

Which surface a session gets is resolved in
[config/mod.rs#L1552-L1579](https://github.com/openai/codex/blob/rust-v0.155.1/codex-rs/core/src/config/mod.rs#L1552-L1579),
in this order:

1. `features.multi_agent_v2 = true` forces V2.
2. `agents.enabled = false` disables both surfaces.
3. Otherwise the **model catalog's per-model `multi_agent_version`** decides.
4. Only a model without one falls back to the `multi_agent` flag, which gives V1.

The resolved version is then pinned to the thread
([session/mod.rs#L473-L489](https://github.com/openai/codex/blob/rust-v0.155.1/codex-rs/core/src/session/mod.rs#L473-L489)).
0.159.3 resolves it the same way.
_Observed:_ `codex features list` reports `multi_agent stable true` and `multi_agent_v2 stable
false`. Yet the catalog cached on 2026-09-19 (`client_version` 0.155.1) puts `gpt-6-astra`,
`gpt-5.6-sol` and `gpt-5.6-terra` on `v2`, `gpt-5.6-luna` on `v1`, and gives `gpt-5.5` no value.
So a default session runs V2 while the feature list implies V1. What the catalog says today is
_not established_; the cache is twelve days old, and the docs now name `gpt-6.1-sol`, which it does
not hold.

History, _documented_ in the [releases](https://github.com/openai/codex/releases):

- 0.85.0: the V1 collab tools gain role presets and `send_input` interrupts.
- 0.88.0 / 0.95.0: "collab in experimental".
- 0.117.0: V2 brings path-based addresses (`/root/agent_a`).
- 0.145.0: V2 "marked stable", opt-in.
- 0.148.0: the catalog exposes per-model multi-agent versions.

The release that made `multi_agent` stable and on by default is _not established_ from the
release notes.

## 2. Parallel fan-out

**Claude Code.** _Documented:_ several sub-agents can run at once ("Run parallel research",
[sub-agents#run-parallel-research](https://code.claude.com/docs/en/sub-agents#run-parallel-research)).
When 20 are running, the next spawn fails with `Concurrent subagent limit reached`, an error that
tells Claude not to retry; `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` changes the cap (2.1.217+), and
ultracode sessions are exempt. Nesting defaults to three layers below the main conversation
([sub-agents#concurrent-subagent-limit](https://code.claude.com/docs/en/sub-agents#concurrent-subagent-limit),
[#let-subagents-spawn-their-own-subagents](https://code.claude.com/docs/en/sub-agents#let-subagents-spawn-their-own-subagents)).
Workflows run their own pool, 16 concurrent agents by default
([workflows#behavior-and-limits](https://code.claude.com/docs/en/workflows#behavior-and-limits)).

**Codex CLI.** _In source:_ V2 allows `max_concurrent_threads_per_session` = 4 by default,
**counting the parent**. That leaves 3 children
([config/mod.rs#L237-L247](https://github.com/openai/codex/blob/rust-v0.155.1/codex-rs/core/src/config/mod.rs#L237-L247),
[`effective_agent_max_threads`](https://github.com/openai/codex/blob/rust-v0.159.3/codex-rs/core/src/config/mod.rs#L1607-L1621)),
and the model is told so: "There are 4 available concurrency slots … including you"
([session/multi_agents.rs](https://github.com/openai/codex/blob/rust-v0.155.1/codex-rs/core/src/session/multi_agents.rs)).

When the slots are full, a spawn first unloads a child that has completed, errored or been
interrupted and has nothing queued. With none to unload it fails with `AgentLimitReached`
([residency.rs#L100-L122 and #L266-L272 @0.159.3](https://github.com/openai/codex/blob/rust-v0.159.3/codex-rs/core/src/agent/control/residency.rs#L100-L122)).

V1 allows 6 threads by default and a nesting depth of 1, so its children cannot spawn. Its
`close_agent` description reads "Completed agents remain open and count toward the concurrency
limit until closed"
([multi_agents_spec.rs#L313-L333](https://github.com/openai/codex/blob/rust-v0.155.1/codex-rs/core/src/tools/handlers/multi_agents_spec.rs#L313-L333)).

_Documented:_ `agents.max_concurrent_threads_per_session` (alias `max_threads`) "caps concurrently
open spawned-agent threads, excluding the primary", and "when unset, Codex chooses a default"
([Subagents](https://developers.openai.com/codex/subagents)). For V2 the source adds 1 to that key
to count the parent
([config/mod.rs `resolve_multi_agent_v2_config` @0.159.3](https://github.com/openai/codex/blob/rust-v0.159.3/codex-rs/core/src/config/mod.rs#L2752-L2765)).
_Observed:_ the 2026-09-19 session's developer message read "There are 4 available concurrency
slots". On 2026-10-01 a V2 session (`gpt-6-astra`, 0.155.1) asked to dispatch six and then four
sub-agents at once read that count and dispatched in waves within it: no spawn failed, and its
closing account named the cap (transcript `3e8a956e-4134-433e-946d-d660bb286646`).

## 3. Background (non-blocking) dispatch

**Claude Code.** _Documented:_ background is the default
([sub-agents#run-subagents-in-foreground-or-background](https://code.claude.com/docs/en/sub-agents#run-subagents-in-foreground-or-background)).

- **Fork mode on**, the interactive default since 2.1.232: every spawned sub-agent runs in the
  background, and Claude Code "removes the Agent tool's `run_in_background` parameter, so Claude
  can't ask for the foreground"
  ([#turn-fork-mode-on-or-off](https://code.claude.com/docs/en/sub-agents#turn-fork-mode-on-or-off)).
- **Fork mode off** (`-p`, the Agent SDK, `CLAUDE_CODE_FORK_SUBAGENT=0`): Claude "runs the
  subagent in the background by default and in the foreground when it needs the result before
  continuing".
- `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1` forces the foreground.

Results arrive "as a completion notification in a later turn". A background sub-agent runs on a
reduced built-in tool set
([#available-tools](https://code.claude.com/docs/en/sub-agents#available-tools)).
_Observed:_ the absence of `run_in_background` in this session, and its presence in `-p`, match the
docs.

**Codex CLI.** _In source:_ there is no background flag, because `spawn_agent` always returns at
once: V1 with `agent_id` and `nickname`, V2 with `task_name`. The V1 description tells the model
"While the subagent is running in the background, do meaningful non-overlapping work" and "Call
wait_agent very sparingly"
([multi_agents_spec.rs#L694-L727](https://github.com/openai/codex/blob/rust-v0.155.1/codex-rs/core/src/tools/handlers/multi_agents_spec.rs#L694-L727)).
When a child finishes, its status is injected into the parent's context with
`trigger_turn = false`: V2 as an inter-agent `FINAL_ANSWER` message, V1 through
`inject_fragment_without_turn`
([agent/control.rs#L667-L711](https://github.com/openai/codex/blob/rust-v0.155.1/codex-rs/core/src/agent/control.rs#L667-L711)).
So the parent picks the result up during a live turn or on its next one; an idle parent is not
woken by it. A live run of that idle case is _not established_. `wait_agent` is the blocking
primitive: V1 waits on chosen ids, V2 on any mailbox update, with a 30 s default, a 10 s minimum
under V2 and a 1 h maximum. The docs add that with many agents running, "Codex waits until all
requested results are available, then returns a consolidated response"
([Subagents](https://developers.openai.com/codex/subagents)).

## 4. Model and named-agent selection per dispatch

**Claude Code.**

- _Per dispatch, documented:_ the `model` parameter sits first in the resolution order, ahead of
  the definition's `model`, then `CLAUDE_CODE_SUBAGENT_MODEL`, then the main conversation's model
  ([sub-agents#choose-a-model](https://code.claude.com/docs/en/sub-agents#choose-a-model)). It was
  restored in 2.1.72 ([changelog](https://code.claude.com/docs/en/changelog)).
  `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` takes it away from Claude
  ([#run-every-subagent-on-one-model](https://code.claude.com/docs/en/sub-agents#run-every-subagent-on-one-model)).
  `subagent_type` picks a named definition.
- _Definitions, documented:_ Markdown files with YAML frontmatter, where only `name` and
  `description` are required. The fields are `tools`, `disallowedTools`, `model` (an alias, a full
  ID or `inherit`), `permissionMode`, `maxTurns`, `skills`, `mcpServers`, `hooks`, `memory`,
  `background`, `omitClaudeMd`, `effort`, `isolation`, `color`, `initialPrompt` and
  `experimental.cacheTtl`
  ([sub-agents#supported-frontmatter-fields](https://code.claude.com/docs/en/sub-agents#supported-frontmatter-fields)).
  They load from managed settings, `--agents`, `.claude/agents/`, `~/.claude/agents/` and plugins,
  in that priority order.
- _Plugins, documented:_ a plugin's `agents/` directory, scanned recursively, or the manifest's
  `agents` key, which replaces the scan, takes `.md` files only. Each agent is namespaced
  `<plugin>:<name>`, and subfolders join the name (`my-plugin:review:security`).
  - Supported fields: `name`, `description`, `model`, `effort`, `maxTurns`, `tools`,
    `disallowedTools`, `skills`, `memory`, `background`, `omitClaudeMd`, `isolation`, `color` and
    `cacheTtl`.
  - Ignored fields: `permissionMode`, `hooks`, `mcpServers` and `initialPrompt`.

  Sources:
  [plugins/components#agents](https://code.claude.com/docs/en/plugins/components#agents),
  [plugins-reference](https://code.claude.com/docs/en/plugins-reference). Plugins have shipped
  agents since 2.0.12, and plugin agents gained `effort`, `maxTurns` and `disallowedTools` in
  2.1.78 ([changelog](https://code.claude.com/docs/en/changelog)).

**Codex CLI.**

- _Per dispatch, in source:_
  - **V1** always exposes `model` and `reasoning_effort`, and lists up to 5 picker-visible models
    in the description, which tells the model "Do not set the `model` field unless the user
    explicitly asks"
    ([multi_agents_spec.rs#L581-L617, #L694](https://github.com/openai/codex/blob/rust-v0.155.1/codex-rs/core/src/tools/handlers/multi_agents_spec.rs#L581-L617)).
  - **V2** exposes them while `expose_spawn_agent_model_overrides` is on, which is the default
    ([config/mod.rs#L1303-L1320](https://github.com/openai/codex/blob/rust-v0.155.1/codex-rs/core/src/config/mod.rs#L1303-L1320)).
    Its hint says full-history forks, the default (`fork_turns` omitted or `"all"`), "do not
    accept overrides". It also says: "Only set `model` or `reasoning_effort` when explicitly
    requested by the user, applicable `AGENTS.md` instructions, or skill instructions; when doing
    so, set `fork_turns` to `\"none\"` or a positive integer string"
    ([session/multi_agents.rs#L50](https://github.com/openai/codex/blob/rust-v0.155.1/codex-rs/core/src/session/multi_agents.rs#L50)).
    Whether the runtime rejects or silently drops an override on a full fork is
    _not established_.
  - An unknown model slug fails with the list of models that are available
    ([multi_agents_common.rs#L395-L420](https://github.com/openai/codex/blob/rust-v0.155.1/codex-rs/core/src/tools/handlers/multi_agents_common.rs#L395-L420)).
  - `agents.default_subagent_model` and `default_subagent_reasoning_effort` apply when the spawn
    names no model.
  - Since 0.156.0 the model catalog can override the description and **parameter schema** of
    every V2 tool (#46297, #46505), so the exact V2 schema a model sees is server-controlled.
- _Named agent, in source:_ `agent_type` appears on `spawn_agent`, in both V1 and V2, **only when
  `config.agent_roles` is non-empty**, and that set holds user-defined roles alone
  ([spec_plan.rs#L1306, #L1356](https://github.com/openai/codex/blob/rust-v0.155.1/codex-rs/core/src/tools/spec_plan.rs#L1306)).
  The built-in `default`, `worker` and `explorer` roles
  ([agent/role.rs#L338-L404](https://github.com/openai/codex/blob/rust-v0.155.1/codex-rs/core/src/agent/role.rs#L338-L404))
  therefore cannot be selected until the user defines a role of their own.
- _Definitions:_
  - _Documented:_ TOML files in `~/.codex/agents/` or `.codex/agents/`, requiring `name`,
    `description` and `developer_instructions`. The docs say other `config.toml` keys can follow,
    "such as `model`, `model_reasoning_effort`, `sandbox_mode`, `mcp_servers`, and
    `skills.config`" ([Subagents](https://developers.openai.com/codex/subagents)).
  - _In source:_ roles are discovered recursively in the `agents/` folder of each config layer, or
    declared as `[agents.<name>]` with `description`, `config_file` and `nickname_candidates`
    ([agent-roles/src/loader.rs#L70-L95](https://github.com/openai/codex/blob/rust-v0.155.1/codex-rs/agent-roles/src/loader.rs#L70-L95),
    [config_toml.rs#L682-L730](https://github.com/openai/codex/blob/rust-v0.155.1/codex-rs/config/src/config_toml.rs#L682-L730)).
  - _In source:_ a role applies only a **bounded** set of overrides: `developer_instructions`,
    `model`, `model_reasoning_effort`, `model_reasoning_summary`, `model_verbosity`,
    `personality` and `service_tier`; turning off the `shell_tool`, `apps`, `plugins`, memory and
    request-permissions features; and turning skills off
    ([agent/role.rs#L36-L48 and `apply_role_to_config_inner`](https://github.com/openai/codex/blob/rust-v0.155.1/codex-rs/core/src/agent/role.rs#L36-L48)).
    `sandbox_mode` and `mcp_servers` are not applied: the same holds at 0.159.3 and on `main` at
    `6b4daaf`, and the restriction dates from 0.149.0 (#39299, "Restrict agent roles to bounded
    configuration overrides").
- _Plugins, in source:_ the plugin manifest reads `skills`, `mcpServers`, `apps`, `hooks` and
  `interface`, plus `extensions` from 0.159.3 on, and **has no agents component**
  ([core-plugins/src/manifest.rs#L47-L68](https://github.com/openai/codex/blob/rust-v0.155.1/codex-rs/core-plugins/src/manifest.rs#L47-L68)).
  Roles load only from config layers, so a Codex plugin cannot ship a custom agent. An `agents`
  array in a marketplace entry is passed through as fallback JSON in a test fixture but never
  loaded as roles
  ([marketplace_tests.rs#L554](https://github.com/openai/codex/blob/rust-v0.155.1/codex-rs/core-plugins/src/marketplace_tests.rs#L554)).
  The [plugin build docs](https://developers.openai.com/codex/plugins/build) name no agent
  component either.

## 5. Follow-up message to a spawned agent

**Claude Code.** _Documented:_ "Claude uses the `SendMessage` tool with the agent's ID or name as
the `to` field to resume it", and agent teams need not be enabled. A completed sub-agent resumes in
the background with its full history. So does one stopped with `TaskStop`, once its stopped run
has exited
([sub-agents#resume-subagents](https://code.claude.com/docs/en/sub-agents#resume-subagents)).
Exceptions:

- Explore and Plan "are one-shot and return no agent ID".
- A sub-agent the *user* stopped (`x` in `/tasks`) refuses messages.
- A name re-taken by a newer agent is refused (2.1.199+).

Since 2.1.77 the Agent tool's `resume` parameter has been gone in favour of
`SendMessage({to: agentId})` ([changelog](https://code.claude.com/docs/en/changelog)). A sub-agent
treats its launcher's messages as task direction (2.1.198+).
_Observed:_ `SendMessage` (`to`, `message`, `summary`, `notify_when_idle`) is a deferred tool in
this session and is listed in the `-p` probe.

**Codex CLI.** _In source:_

- **V1** `send_input` takes `target`, `message` or `items`, and `interrupt`; it queues the
  message, or with `interrupt=true` handles it immediately.
- **V2** `send_message` takes `target` and `message`; it "Does not trigger a new turn".
- **V2** `followup_task` takes the same and "trigger[s] a turn if it is idle"
  ([multi_agents_spec.rs#L143-L240](https://github.com/openai/codex/blob/rust-v0.155.1/codex-rs/core/src/tools/handlers/multi_agents_spec.rs#L143-L240)).

Both V2 tools reload a child that was unloaded (`ensure_v2_agent_loaded`). From 0.158.0,
`features.multi_agent_v2.disable_direct_message = true` (default `false`) drops both. Spawning
and automatic child results remain, and the option requires an agent message board
([feature_configs.rs#L302 @0.159.3](https://github.com/openai/codex/blob/rust-v0.159.3/codex-rs/features/src/feature_configs.rs#L302),
[spec_plan.rs#L499-L515 @0.159.3](https://github.com/openai/codex/blob/rust-v0.159.3/codex-rs/core/src/tools/spec_plan.rs#L499-L515)).
_Observed:_ the 2026-09-19 session that ADR 0005 records (rollout `01a0b8f6-3af7…`, 0.155.1,
`gpt-6-astra`, V2) made these calls, all in the `collaboration` namespace, and the child reported
back across the follow-up: `spawn_agent` with `fork_turns: "none"`, `wait_agent`,
`followup_task` to `/root/token_memory`, `wait_agent`, and `interrupt_agent`.

## 6. Close, stop, or release

**Claude Code.** _Documented:_ there is no close tool. `TaskStop` "Stops a running background task
by ID. It also accepts … a named background agent by agent ID or name" (2.1.198+)
([tools-reference](https://code.claude.com/docs/en/tools-reference)). It stops, it does not
release: a later `SendMessage` resumes the agent. Nothing needs releasing either, since the
concurrency cap counts *running* sub-agents and a finished one leaves `/tasks` after 30 s on its
own ([sub-agents#concurrent-subagent-limit](https://code.claude.com/docs/en/sub-agents#concurrent-subagent-limit)).
_Observed:_ `TaskStop` (`task_id`) is deferred in this session.

**Codex CLI.** _In source:_

- **V1** has `close_agent`. It closes the agent and its descendants and returns the previous
  status, and it is what frees a completed child's slot. `resume_agent` reopens a closed one
  ([multi_agents_spec.rs#L242-L262, #L313-L333](https://github.com/openai/codex/blob/rust-v0.155.1/codex-rs/core/src/tools/handlers/multi_agents_spec.rs#L313-L333)).
- **V2** has no close by design. `close_agent` was renamed `interrupt_agent` in 0.139.0 (#26994).
  The child "remains available for messages and follow-up tasks", and finished children are
  unloaded when a slot is needed ([§2](#2-parallel-fan-out)).

_Documented:_ users can ask Codex to "steer a running subagent, stop it, or close completed agent
threads", and `/agent` switches threads in the TUI
([Subagents](https://developers.openai.com/codex/subagents)). Those are user controls, not tools.

## 7. Typed output channel

**Claude Code.**

- _Documented:_ the `Agent` tool returns the sub-agent's final prose report, scanned and placed
  under a header ([sub-agents#subagent-output-scanning](https://code.claude.com/docs/en/sub-agents#subagent-output-scanning)).
  `SubagentHandback` (auto mode only) delivers that same report and carries no schema.
- _Documented:_ the one schema-validated sub-agent channel is the Workflow runtime's
  `agent(prompt, { schema })`. "that subagent returns JSON matching the shape instead of prose",
  it is retried up to 5 times (`MAX_STRUCTURED_OUTPUT_RETRIES`), and a self-contradictory schema
  is refused before the agent starts
  ([workflows#what-the-saved-script-looks-like](https://code.claude.com/docs/en/workflows#what-the-saved-script-looks-like)).
  Dynamic workflows arrived in 2.1.154. They are on for paid plans and opt-in on Pro, and a plugin
  can ship them in `workflows/`
  ([workflows#distribute-a-workflow-in-a-plugin](https://code.claude.com/docs/en/workflows#distribute-a-workflow-in-a-plugin)).
  The orchestration runs as a JavaScript script, not as turn-by-turn agent calls.
- _Documented:_ `ReportFindings` "Reports code-review findings as a structured list" (2.1.196+),
  with an optional `category` from 2.1.199. Claude Code renders those findings in the main
  conversation; it is no sub-agent→parent channel, and background sub-agents do not keep it
  ([tools-reference](https://code.claude.com/docs/en/tools-reference),
  [sub-agents#available-tools](https://code.claude.com/docs/en/sub-agents#available-tools)).
  _Observed:_ it is loaded in the `-p` main session and absent from this sub-agent session.

**Codex CLI.** _In source:_ no sub-agent tool takes an output schema. A child's result is the
string in its `completed` status, or in a `FINAL_ANSWER` message under V2
([multi_agents_spec.rs#L355-L384](https://github.com/openai/codex/blob/rust-v0.155.1/codex-rs/core/src/tools/handlers/multi_agents_spec.rs#L355-L384)).
`codex exec --output-schema FILE` constrains a whole non-interactive session's final message
([exec/src/cli.rs#L48 @0.159.3](https://github.com/openai/codex/blob/rust-v0.159.3/codex-rs/exec/src/cli.rs#L48)).

## ADR 0005 against the sources

- **"both harnesses proved able to message a spawned sub-agent, verified on 2026-09-19"**:
  confirmed. The Codex half is the rollout above, the V2 `followup_task`. The Claude Code half is
  documented `SendMessage` behaviour. One refinement: Codex has made messaging a configurable
  property of the V2 surface since 0.158.0 (`disable_direct_message`), though it is off by
  default.
- **"the Codex session tested exposed no close tool and a toolset other than the one its feature
  list implied"**: confirmed, and both halves are now explained.
  - The model catalog assigned `gpt-6-astra` to V2, and that assignment outranks
    `multi_agent_v2 = false` in `codex features list`.
  - V2 has had no close tool since 0.139.0, by design: `interrupt_agent` replaced it, and finished
    children are unloaded automatically.

  A V1 session, as on `gpt-5.6-luna`, does get `close_agent`, so "where the harness has a close
  step" is a per-model fact on Codex, not a per-harness one.

## Mapping onto the plugin's current wording

Line references are to `HEAD` (`dffc8e1`); the working tree had uncommitted edits to several of
these files while this note was written.

- **"in parallel where the harness supports it, sequentially otherwise"**
  (`skills/simplify/SKILL.md:39`, `skills/codebase-design/DESIGN-IT-TWICE.md:21`)
  - Both harnesses support parallel dispatch, so the "sequentially otherwise" branch has no
    capability trigger left.
  - The wording misses a partial case: under Codex V2 defaults only 3 children run at once, and
    the 4th spawn fails with `AgentLimitReached` until a finished child can be unloaded. Under V1,
    6 threads are allowed, and completed children keep their slots until `close_agent`.
  - `/simplify`'s three fixers fit V2 exactly. Design-it-twice's "3+" and `/review-gate`'s finders
    (6 at `medium`, 11 at `high`, plus verifiers and the arbiter) exceed it.
  - Leaves open: the fallback can go as a capability hedge, but needs replacing by
    concurrency-cap handling rather than deleting outright.
- **"in the background where the harness supports it"** (every dispatching skill; AGENTS.md rule 5)
  - Supports deleting the hedge: both harnesses dispatch without blocking.
  - The parenthetical "(Claude Code: do not use `run_in_background: false`)" is moot in
    interactive Claude Code, where fork mode removes the parameter. It still applies to `-p`, the
    SDK, and `CLAUDE_CODE_FORK_SUBAGENT=0`, where the parameter exists and Claude may choose the
    foreground.
  - Codex has no such parameter. Its blocking risk is a reflexive `wait_agent`, which nothing in
    the wording names.
- **"where the harness cannot message a sub-agent it spawned"** (`skills/review-gate/ARBITER.md:11`,
  `skills/spec/SKILL.md:61`)
  - Contradicts any reading that a supported harness lacks the capability: both message spawned
    agents by default.
  - The fallback is reachable only through configuration or choice of agent:
    - Claude Code's one-shot Explore and Plan agents, which return no ID.
    - A Claude Code agent the user stopped by hand.
    - Codex V2 with `disable_direct_message = true`.
  - A dispatch through `general-purpose`, a custom agent, or Codex's default surface can always be
    messaged.
- **"close it when the run ends, where the harness has a close step"**
  (`skills/review-gate/ARBITER.md:10`)
  - Supports the hedge as worded.
  - Claude Code has no close step and needs none; `TaskStop` only stops, and the agent stays
    resumable.
  - Codex V1 has `close_agent`, and it matters there because completed agents hold slots.
  - Codex V2, the default surface for the catalog's default model on 2026-09-19, has none.
- **The "Model selection" paragraph's Codex clause** (`skills/simplify/SKILL.md:56`,
  `skills/review-gate/SKILL.md:115`, `skills/review-gate/ARBITER.md:13`, `skills/spec/SKILL.md:58`)
  - Supports it as a guard, and it is not stale: both Codex surfaces expose `model` and
    `reasoning_effort` by default, so the selector is usually there. It is still not guaranteed,
    since V2 config can hide it and the catalog can rewrite V2 tool schemas.
  - "Task wording alone does not select a different model" holds in source.
  - Skill instructions count as authority to override, per the V2 hint.
  - Leaves open what the clause does not say:
    - Under V2 an override needs `fork_turns: "none"` or a turn count, because the default
      full-history fork does not accept one.
    - The model must be a catalog slug, and no Codex source names "balanced mid-tier" or "most
      capable" tiers.
    - The custom-agent selector (`agent_type`) appears only once the user has defined a role.
- **"Where Codex has no sub-agents"** (`WHY.md:54` at `HEAD`; deleted in the uncommitted working
  tree)
  - Contradicted. Codex has had sub-agents on by default in 0.155.1 and 0.159.3, and its
    documentation says so.
- **IDEAS.md "Dispatched roles as agent definitions"**
  - Claude Code: yes. A plugin ships `agents/*.md` (YAML frontmatter + Markdown body), namespaced
    `cantrips:<name>`. It can pin `model`, `effort`, `tools` or `disallowedTools`, `maxTurns`,
    `skills`, `background` and `omitClaudeMd`, but not `hooks`, `mcpServers` or `permissionMode`.
    A dispatch selects one with `subagent_type`.
  - Codex: **no**. The plugin manifest has no agents component, and roles load only from the
    user's or project's config layers: TOML in `~/.codex/agents/` or `.codex/agents/`, or
    `[agents.<name>]`.
  - Even a user-installed Codex role pins only the model, reasoning, instructions and a few
    feature switch-offs. Its `sandbox_mode` is not applied, so a read-only role cannot be expressed
    beyond turning the shell tool off.
  - The entry's "Packaging per harness" cost understates this: on Codex the role cannot be
    packaged at all. The premise that the model-selection paragraphs "already allow for Codex's
    custom-agent selector" holds only once the user hand-installs roles.

## Possible harness bugs and documentation errors

- **Codex docs vs source, custom agent fields.** The [Subagents](https://developers.openai.com/codex/subagents)
  page says a custom agent file may set `sandbox_mode` and `mcp_servers`. At 0.155.1, 0.159.3 and
  `main@6b4daaf` the role loader applies only a bounded set of overrides, and neither of those keys
  is in it ([agent/role.rs](https://github.com/openai/codex/blob/rust-v0.159.3/codex-rs/core/src/agent/role.rs)).
  The restriction is deliberate: #39299 (0.149.0) says it preserves "parent-owned permissions …
  MCP servers". So the docs are stale. Already reported upstream as openai/codex#40130 and #45482,
  both open.
- **Codex feature list misreports the active multi-agent surface.** `codex features list` shows
  `multi_agent_v2 false`, while the model catalog silently puts default models on V2. Setting
  `features.multi_agent = false` also does not disable sub-agents for a model whose catalog entry
  sets a version; only `[agents] enabled = false` does
  ([config/mod.rs#L1552-L1579](https://github.com/openai/codex/blob/rust-v0.155.1/codex-rs/core/src/config/mod.rs#L1552-L1579)).
  This may be intentional, but it is undocumented, and it is what misled the ADR 0005 test.
- **Codex built-in roles unreachable by default.** The docs present `default`, `worker` and
  `explorer` as built-in agents, but `spawn_agent` exposes `agent_type` only when a user-defined
  role exists (`expose_agent_type: !config.agent_roles.is_empty()`, where `agent_roles` excludes
  built-ins). With no custom role the model cannot pick `explorer`. This is deliberate (#33572,
  which added tests for it) and costs nothing: the built-in roles carry no configuration, since
  `explorer.toml` is empty and `worker` has no file. Open issue openai/codex#33244 mentions it.
- **Claude Code `name` parameter.** The docs say Claude can pass `name` on the Agent tool. The
  schema seen in this background sub-agent session and the one in the `-p` probe have no such
  parameter. Observed only in those two contexts, so this may be mode-dependent rather than a doc
  error.

## Not established

- The current Codex model catalog's per-model `multi_agent_version`: the local cache dates from
  2026-09-19.
- Whether Codex V2 rejects or silently drops a `model` override on a full-history fork, and whether
  a role's `model` beats an explicit spawn `model`. The role layer is applied after the requested
  override in
  [multi_agents_v2/spawn.rs#L128-L143](https://github.com/openai/codex/blob/rust-v0.155.1/codex-rs/core/src/tools/handlers/multi_agents_v2/spawn.rs#L128-L143),
  but the merge was not traced.
- Whether an idle Codex parent is woken by a child's completion. The source delivers it with
  `trigger_turn = false`, which says no; not run live.
- The Codex release that made `multi_agent` stable and on by default: release notes searched back
  to 0.85.0.
- Claude Code's main interactive session's exact `Agent` schema: only a background sub-agent and
  `-p` were observed.
