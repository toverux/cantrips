# Mid-turn assistant messages in Codex CLI: when the user sees them

Research date: 2026-10-01. Findings apply to **Codex CLI 0.159.3** (installed; latest stable,
2026-09-30). Sources: openai/codex at tag
[`rust-v0.159.3`](https://github.com/openai/codex/tree/rust-v0.159.3) (`01fc69f`), including the
model catalog it bundles (`codex-rs/models-manager/models.json`); the OpenAI docs at
developers.openai.com/codex, which redirect to learn.chatgpt.com (fetched as Markdown the same
day); OpenAI's [Codex Prompting Guide](https://developers.openai.com/cookbook/examples/gpt-5/codex_prompting_guide);
and the local install (`codex features list`, `~/.codex/models_cache.json` fetched 2026-10-01, and
the 29 session rollouts under `~/.codex/sessions`, all of them `codex exec` runs).

Each claim is labelled by evidence: **documented** (vendor docs), **in source** (code or bundled
prompt at the cited tag), **observed** (this machine). No interactive session was started, so
every TUI claim is _in source_ and none is _observed_; anything marked _not established_ was looked
for and not settled.

Context: `/review-gate` needs a block of findings to reach the user before the agent's first file
edit. On Claude Code the skill's Stop hooks split that over two turns. On Codex the agent sends the
block as a message and starts editing in the same turn, which works only if Codex shows that
message before, or while, the edits run.

## Answer

**The TUI shows a mid-turn message as it is produced, in full, and before the tool call that
follows it is displayed.** The text streams into the transcript as deltas arrive; when the message
item completes, whatever has not yet been drawn is committed at once. Core emits that completion
before it dispatches the next tool call, so the message is on its way to the screen before the
edit starts. Nothing waits for the turn to end.

- **Kinds.** Assistant messages carry a `phase`: `commentary` (mid-turn) or `final_answer`. The TUI
  renders both through the same path. It does not collapse, truncate or hide commentary, during the
  turn or after it.
- **Settings.** No config key hides or defers assistant messages. Three situations do: a voice
  (realtime) handoff turn, the built-in `/review` sub-thread, and Plan mode's `<proposed_plan>`
  blocks. None applies to a skill running in a normal turn.
- **Steering.** Every bundled model prompt tells the model to keep commentary concise, and tells it
  that commentary is "collapsed after the final answer is shown to users". This works against
  pasting a long block mid-turn. The nine commentary messages in the local rollouts run 22 to 332
  characters.
- **`codex exec`.** Each assistant message is printed whole when its item completes, mid-turn: to
  `stderr` in the default mode, as an `item.completed` JSONL event with `--json`. Only the last
  message goes to `stdout`.

Two limits on the guarantee:

- It is ordering, not a handshake. The edit is not held until the message is drawn, and the user
  gets no chance to react between the two.
- Whether a model told by a skill to paste a long block mid-turn does so, against its system
  prompt, was not tested.

## 1. Is a mid-turn message rendered immediately?

_In source._ Yes, in three steps.

**Core streams the text and completes the item before the tool runs.** Each `OutputTextDelta` from
the Responses stream becomes an `AgentMessageContentDelta` event
([session/turn.rs#L2961-L2992](https://github.com/openai/codex/blob/rust-v0.159.3/codex-rs/core/src/session/turn.rs#L2961-L2992),
[#L2231-L2263](https://github.com/openai/codex/blob/rust-v0.159.3/codex-rs/core/src/session/turn.rs#L2231-L2263)),
which the app-server maps to `item/agentMessage/delta`
([event_mapping.rs#L362-L371](https://github.com/openai/codex/blob/rust-v0.159.3/codex-rs/app-server-protocol/src/protocol/event_mapping.rs#L362-L371)).
Output items are handled one at a time, in stream order. A message item that is done is emitted as
`item/completed`; a tool-call item that is done is spawned onto its own task
([stream_events_utils.rs#L315-L388](https://github.com/openai/codex/blob/rust-v0.159.3/codex-rs/core/src/stream_events_utils.rs#L315-L388),
[tools/parallel.rs#L196](https://github.com/openai/codex/blob/rust-v0.159.3/codex-rs/core/src/tools/parallel.rs#L196)).
A message written ahead of a tool call is therefore complete, and sent to the client, before that
call is dispatched. The dispatch does not wait for the response to finish, and it does not wait for
the client either.

**The TUI draws deltas as they arrive.** `AgentMessageDelta` feeds a stream controller with no
check on phase
([chatwidget/protocol.rs#L104-L115](https://github.com/openai/codex/blob/rust-v0.159.3/codex-rs/tui/src/chatwidget/protocol.rs#L104-L115),
[chatwidget/streaming.rs#L573-L612](https://github.com/openai/codex/blob/rust-v0.159.3/codex-rs/tui/src/chatwidget/streaming.rs#L573-L612)).
Completed lines are queued and committed to the transcript on an animation tick: one line per
frame, or the whole backlog once 8 lines are queued or the oldest has waited 120 ms
([streaming/chunking.rs#L1-L45, #L85-L116](https://github.com/openai/codex/blob/rust-v0.159.3/codex-rs/tui/src/streaming/chunking.rs#L85-L116)).
The unfinished tail shows in a live cell under the transcript.

**Item completion flushes the rest.** On `item/completed` the TUI finalizes the stream, which
commits every line not yet emitted in one step, and re-renders the message from the completed
item's text: "Item completion is authoritative. Use it for consolidation so any deltas dropped by a
saturated transport cannot truncate the transcript"
([chatwidget/streaming.rs#L187-L199, #L86-L149](https://github.com/openai/codex/blob/rust-v0.159.3/codex-rs/tui/src/chatwidget/streaming.rs#L187-L199),
[streaming/controller.rs#L210-L222](https://github.com/openai/codex/blob/rust-v0.159.3/codex-rs/tui/src/streaming/controller.rs#L210-L222)).
Tool events that arrive while a message is still streaming are queued behind it, so the transcript
keeps the order message, then tool
([chatwidget/streaming.rs#L546-L561](https://github.com/openai/codex/blob/rust-v0.159.3/codex-rs/tui/src/chatwidget/streaming.rs#L546-L561)).
A regression test states the intended sequence: "a preamble line is committed to history before
any exec/tool event"
([tests/exec_flow.rs#L647-L672](https://github.com/openai/codex/blob/rust-v0.159.3/codex-rs/tui/src/chatwidget/tests/exec_flow.rs#L647-L672)).

One path skips the deltas: when an extension registers a turn-item contributor, core withholds
them and sends the message only at item completion
([session/turn.rs#L2581-L2582, #L2803](https://github.com/openai/codex/blob/rust-v0.159.3/codex-rs/core/src/session/turn.rs#L2581-L2582)).
That is still mid-turn and still ahead of the tool call, and no extension in the tree registers
one outside tests.

_Documented._ The app-server docs list `item/agentMessage/delta` ("appends streamed text for the
agent message") and say of `item/completed`: "treat this as the authoritative state"
([App Server](https://learn.chatgpt.com/docs/app-server.md)). No official page describes what the
TUI draws when.

_Observed._ In the rollout of 2026-10-01 12:11 (`gpt-6-astra`, `codex exec`, 0.155.1), each of four
commentary messages is recorded 0.3 to 2.1 s ahead of the tool call that follows it. This shows
the model emits message then call, in that order; it does not show the screen.

## 2. Message kinds, and whether a long block is shown in full

**Phase.** _In source:_ `MessagePhase` is `Commentary` ("Mid-turn assistant text (for example
preamble/progress narration)") or `FinalAnswer`, and optional: "Providers do not emit this
consistently, so callers must treat `None` as 'phase unknown'"
([protocol/models.rs#L940-L952](https://github.com/openai/codex/blob/rust-v0.159.3/codex-rs/protocol/src/models.rs#L940-L952)).
_Documented:_ `agentMessage` is "`{id, text, phase?}` … When present, `phase` uses Responses API
wire values (`commentary`, `final_answer`)"
([App Server](https://learn.chatgpt.com/docs/app-server.md)). The model sets it: "You’ll receive
`phase` on assistant output items", and "Preambles are messages sent along with tool calls that
provide user updates while working"
([Codex Prompting Guide](https://developers.openai.com/cookbook/examples/gpt-5/codex_prompting_guide)).

**What the TUI does with phase.** _In source:_ four things, none of which changes what is drawn.

- After a commentary message it restores the "Working" status row, where a final answer leaves it
  hidden
  ([chatwidget/streaming.rs#L473-L481](https://github.com/openai/codex/blob/rust-v0.159.3/codex-rs/tui/src/chatwidget/streaming.rs#L473-L481)).
- It picks the turn's last non-commentary message as the final one, for the completion notice
  ([chatwidget/protocol.rs#L416-L435](https://github.com/openai/codex/blob/rust-v0.159.3/codex-rs/tui/src/chatwidget/protocol.rs#L416-L435)).
- It skips commentary when naming a thread (`app/thread_title.rs#L331`).
- It hides commentary in voice handoff turns ([§3](#3-settings-and-modes-that-hide-or-defer)).

**Full length.** _In source:_ both message cells render every line of the Markdown source; neither
has a line cap, a fold or a disclosure control
([history_cell/messages.rs#L448-L471, #L576-L646](https://github.com/openai/codex/blob/rust-v0.159.3/codex-rs/tui/src/history_cell/messages.rs#L576-L646)).
The compact-with-disclosure rendering belongs to tool activity: a message cell has no activity
identity and its compact form is its full form
([history_cell/mod.rs#L232-L252](https://github.com/openai/codex/blob/rust-v0.159.3/codex-rs/tui/src/history_cell/mod.rs#L232-L252)),
and the only cells an activity group absorbs are hidden reasoning and terminal input
([chatwidget/activity_groups.rs](https://github.com/openai/codex/blob/rust-v0.159.3/codex-rs/tui/src/chatwidget/activity_groups.rs)).
A Markdown table is held in the live tail, visible but still reflowing, until the message
completes
([streaming/controller.rs#L12-L20](https://github.com/openai/codex/blob/rust-v0.159.3/codex-rs/tui/src/streaming/controller.rs#L12-L20)).
Citation markup is stripped before display, and so is a `<proposed_plan>` block in Plan mode
([stream_events_utils.rs#L37-L44](https://github.com/openai/codex/blob/rust-v0.159.3/codex-rs/core/src/stream_events_utils.rs#L37-L44)).

**Tool-delivered messages.** _In source:_ two tools emit an assistant message item from inside a
turn, marked `delivery: async`. `request_user_input_async` posts non-blocking questions and is
exposed on root sessions of the `gpt-6*` catalog models
([tools/spec_plan.rs#L1178-L1203](https://github.com/openai/codex/blob/rust-v0.159.3/codex-rs/core/src/tools/spec_plan.rs#L1178-L1203)).
`send_message_to_user_async` sends "a concise message that needs the user's attention during
ongoing work", and sits behind a feature that is under development and off
([handlers/send_message_to_user_async.rs](https://github.com/openai/codex/blob/rust-v0.159.3/codex-rs/core/src/tools/handlers/send_message_to_user_async.rs),
[features/lib.rs#L1632-L1637](https://github.com/openai/codex/blob/rust-v0.159.3/codex-rs/features/src/lib.rs#L1632-L1637)).
_Observed:_ `codex features list` reports `send_message_to_user_async under development false`.
Neither is needed for a mid-turn message to show.

## 3. Settings and modes that hide or defer

_In source and documented._ No config key acts on assistant messages. The two that suppress output
act on reasoning: `hide_agent_reasoning` ("Suppress reasoning events in both the TUI and `codex
exec` output") and `show_raw_agent_reasoning`
([config_toml.rs#L384-L389](https://github.com/openai/codex/blob/rust-v0.159.3/codex-rs/config/src/config_toml.rs#L384-L389),
[Config reference](https://learn.chatgpt.com/docs/config-file/config-reference.md)). The `[tui]`
keys that touch the transcript (`animations`, `alternate_screen`, `fullscreen_transcript`,
`raw_output_mode`) change how it is drawn, not what is in it
([config/types.rs#L803-L882](https://github.com/openai/codex/blob/rust-v0.159.3/codex-rs/config/src/types.rs#L803-L882)).

_In source._ Situations that do hide or defer assistant text:

- **Voice handoff.** In a turn delegated from a realtime voice conversation, commentary-phase
  messages are private to the handoff and never drawn
  ([chatwidget/realtime.rs#L221-L232](https://github.com/openai/codex/blob/rust-v0.159.3/codex-rs/tui/src/chatwidget/realtime.rs#L221-L232)).
- **Built-in `/review`.** The review sub-thread's assistant messages and deltas are dropped in
  favour of its structured output
  ([tasks/review.rs#L152-L166](https://github.com/openai/codex/blob/rust-v0.159.3/codex-rs/core/src/tasks/review.rs#L152-L166)).
  This is Codex's own review task, not a skill.
- **Plan mode.** Text inside `<proposed_plan>` is routed to a plan item, and a message item is
  announced only once it has visible text
  ([session/turn.rs#L2168-L2228](https://github.com/openai/codex/blob/rust-v0.159.3/codex-rs/core/src/session/turn.rs#L2168-L2228)).
- **Safety buffering.** The service can put a response into "transient safety buffering"
  ([App Server](https://learn.chatgpt.com/docs/app-server.md)); the TUI then shows "Giving this
  request a little extra thought" until the first message text arrives
  ([chatwidget/safety_buffering.rs#L11, #L61-L77](https://github.com/openai/codex/blob/rust-v0.159.3/codex-rs/tui/src/chatwidget/safety_buffering.rs#L61-L77)).
  This happens server-side. Whether a buffered response can release its tool call ahead of its
  text is _not established_.

## 4. Is the model steered to keep mid-turn messages short?

_In source._ Yes, by every instruction template in the bundled catalog
([models-manager/models.json](https://github.com/openai/codex/blob/rust-v0.159.3/codex-rs/models-manager/models.json),
one `instructions_template` per model). _Observed:_ the catalog fetched from the service on
2026-10-01 carries the same templates, byte for byte, for every model it shares with the bundled
one.

`gpt-6.1-sol` and `gpt-6-astra` (lines 251 and 76), under "## Intermediate commentary":

> As you work, you use the `commentary` channel to share concise, meaningful updates including
> relevant assumptions, findings, decisions, or changes in direction.

> Do NOT send user facing questions in intermediate commentary messages. Do NOT put a final
> response in the commentary channel. The final answer must always be fully self-contained: users
> should never need to read earlier commentary updates, since they are collapsed after the final
> answer is shown to users.

`gpt-6-sol` and `gpt-6-luna` carry the same two passages with small wording differences. The
`gpt-5.6-*` template (line 771) reads:

> These messages should be concise and quickly scannable.

> Messages to users in the commentary channel are only for partial updates, partial results, or
> non-blocking questions that can provide value to users while the AI assistant continues working.

and ends on the same "collapsed after the final answer" sentence. `gpt-5.5` (line 1417) is the
strictest, under "## Intermediary updates":

> - User updates are short updates while you are working, they are NOT final answers.
> - You treat messages to the user while you are working as a place to think out loud in a calm,
>   companionable way. You casually explain what you are doing and why in one or two sentences.
> - Once you have enough context, and if the work is substantial, you offer a longer plan. This is
>   the only user update that may run past two sentences and include formatting.
> - Before performing file edits of any kind, you provide updates explaining what edits you are
>   making.

Every model the catalog lists also defaults the API's `verbosity` to `low` (`default_verbosity` in
the same file).

Two things follow for a skill that wants a long block mid-turn:

- The model is told the block's channel is for short updates, and that the user will not see it
  once the final answer is up. A model that believes this has reason to shorten the block, or to
  repeat it in the final answer.
- The "collapsed" claim does not hold in the TUI
  ([§2](#2-message-kinds-and-whether-a-long-block-is-shown-in-full)). Which Codex surface does
  collapse commentary is _not established_.

_Observed._ Across the local rollouts (`codex exec`, `gpt-6-astra`), four sessions hold nine
commentary messages of 22 to 332 characters and at most four lines. None was asked for a long one.

## `codex exec`

_Documented._ "While `codex exec` runs, Codex streams progress to `stderr` and prints only the
final agent message to `stdout`." With `--json`, "`stdout` becomes a JSON Lines (JSONL) stream so
you can capture every event Codex emits while it's running", `item.*` among them; the sample
stream shows `{"type":"item.completed","item":{"id":"item_3","type":"agent_message","text":"…"}}`
([Non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode.md)).

_In source._ Both processors act on `item/completed` and ignore deltas, so a message appears whole
when its item completes, mid-turn, whatever its phase.

- Default mode prints it to `stderr` under a `codex` header
  ([event_processor_with_human_output.rs#L98-L108](https://github.com/openai/codex/blob/rust-v0.159.3/codex-rs/exec/src/event_processor_with_human_output.rs#L98-L108)).
  At the end it prints the last message to `stdout`, unless both streams are terminals
  ([#L385-L425, #L516-L531](https://github.com/openai/codex/blob/rust-v0.159.3/codex-rs/exec/src/event_processor_with_human_output.rs#L385-L425)).
- `--json` emits an `item.completed` event for it on `stdout`
  ([event_processor_with_jsonl_output.rs#L483-L492](https://github.com/openai/codex/blob/rust-v0.159.3/codex-rs/exec/src/event_processor_with_jsonl_output.rs#L483-L492)).
  The event carries `text` and no `phase`.

A caller that reads only `stdout` or `--output-last-message` therefore never sees a mid-turn
block.

## What this means for `/review-gate`

- The display half of the guarantee holds on the TUI, by source: a findings block sent as a
  message ahead of the first edit is committed to the transcript when that message completes,
  which core signals before it dispatches the edit.
- It is weaker than the Claude Code split. The user sees the block as the edits begin, with no
  turn boundary between them.
- The risk is the model, not the renderer: the system prompt pulls a mid-turn block toward a
  short update.
- The premise that Codex has no such hook is true of skills and false of plugins. A Codex
  `SKILL.md` reads only `name`, `description` and `metadata.short-description`
  ([skills/parser.rs#L7-L20](https://github.com/openai/codex/blob/rust-v0.159.3/codex-rs/skills/src/parser.rs#L7-L20)),
  so the skill's frontmatter `hooks:` is ignored there. But Codex has a `Stop` hook whose
  `decision: "block"` "tells Codex to continue and automatically creates a new continuation
  prompt", and a plugin can bundle hooks in `hooks/hooks.json`; they are skipped "until you review
  and trust the current hook definition" ([Hooks](https://learn.chatgpt.com/docs/hooks.md)).
  _Observed:_ `codex features list` reports `hooks stable true`. Whether that route fits the gate
  was not examined.

## Possible harness bugs and documentation errors

- **Prompt vs TUI, collapsed commentary.** Every bundled template tells the model commentary
  updates "are collapsed after the final answer is shown to users". The TUI at 0.159.3 has no code
  that collapses, folds or removes a commentary message at turn end. Either the sentence describes
  another surface, or the TUI lags it. Not searched for in the upstream tracker.

## Not established

- The TUI's behaviour on screen: no interactive session was run, so the rendering claims rest on
  source and tests.
- Whether a model follows a skill's instruction to paste a long block mid-turn, and whether it
  then repeats the block in its final answer. No probe was run.
- Which Codex surface collapses commentary after the final answer.
- Whether server-side safety buffering can delay a message's text relative to the tool call that
  follows it.
- How the persistent-mode instructions' `functions.send_user_message_async` maps onto the tools
  0.159.3 registers (`request_user_input_async`, and the feature-gated
  `send_message_to_user_async`). Persistent mode applies only at the `persistent` reasoning
  effort; not traced further.
- `rust-v0.161.0-alpha.*` pre-releases were not read.
