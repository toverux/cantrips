# The loop panel mod

The plugin's one hooks module: a pane beside the chat that shows the loop, a band chip that opens it, and the loop tool the model reports to.

## Layout

- `mod/hooks/hooks.json`: what the Claude Code manifest's `hooks` field names, an empty `hooks` object beside the `modules` entry, so a Claude Code older than mods validates the file and loads the skills.
- `mod/types/index.d.ts`: the `$.state` contract, which the manifest's `types` field names.
- `mod/core/`: the pure core — state functions and text, importing only its own files and types, no Node built-ins, enums or JSX — tested from `tests/mod/` under `node --test`.
- `mod/hooks/register.tsx`: wires the core to the engine; a function that takes `$` is declared at the file's top level, never inside `register`, since the engine refuses to load a module that passes `$` anywhere else, so per-activation state it needs travels as an argument.
- `mod/*.test.tsx`: the mounted scenarios `claude plugin test mod` runs; `mod/.claude-plugin/plugin.json` is that runner's manifest, there so the plugin under test is named `cantrips` and may write its own state.
- `tests/mod/`: the pure core's tests, outside `mod/` because `claude plugin test` runs every test file under the folder it is given and admits only files that import its own kit.

## Reach

The mod's reach is a stated boundary: it reads files, listens to events, draws, and acts on the session only in answer to a press, but for the keep list it adds to a compaction's instructions; it writes only its own store, registers no permission-deciding hook, fetches nothing, answers no tool call but its own tool's without passing it on, and writes no file in the user's tree.
The keep list (`mod/core/compact.ts`) rides every compaction of the main conversation while a feature is selected, after any instructions typed, since an auto-compaction takes no argument: the feature's paths, its stage, the gate run with every parked finding and, until a `--loop` run is green, the command that continues it, the deputy's mode, and an ask for what only the chat holds.
`claude plugin validate .` lists every engine call the module makes, which is how a reviewer checks the boundary; every hook but the Pane render, which returns its tree, and the `/cantrips` command and the loop tool, which answer their own runs and calls, passes its event on, and a guard that trips passes it on too, since the engine unloads every user-installed mod after repeated worker crashes.
The mod API is early access and moves between releases: README states the Claude Code version the mod needs, and a move that breaks the module is a `fix` release.

## Style

Colors are the Nord palette (the `NORD` table in `register.tsx`) on strategic elements only, the rest plain or dim — frost cyan for what is live now, aurora green for what is done (a visited stage, a resolved ticket's tick), frost blue for the feature's name, aurora orange for what blocks or failed, aurora purple for what waits on the user, aurora yellow for an agent on call; a skipped stage and a resolved ticket's title are struck through, but for the lit ticket's while the stage is `/implement`, `/simplify` or `/review-gate`, whose tick is then a cyan ◐, a coming stage is dim with no stroke, and counts and durations are dim, but for an agent's time while it works, which is cyan.
A new section takes its colors from that table and adds a shade only for a meaning the table lacks.

## Tests and type-checking

`mise run test` runs the core's tests under `node --test`, then the mounted scenarios under `claude plugin test mod`, which loads the module in the headless engine and needs the `claude` binary on PATH; without it the script says the scenarios were skipped.
The mod loads as TypeScript with no build step; `tsc -p .` type-checks it against the declarations the engine lays under `.claude-plugin/types/` (gitignored) once a session has loaded the mod from the tree, which the root `tsconfig.json` extends.

## The preview session

`mise run dev:mod-preview` starts a detached tmux session (`cantrips-mod`) that runs Claude Code on the working tree with the mod loaded and the project setting source only, so the installed cantrips stays out and the engine reloads the mod after each save; it runs on Haiku, and a session driving it keeps it there.
An agent editing the mod starts that session before its first edit, where none runs, so the maintainer can follow by attaching, and checks each save in it: `tmux capture-pane -p -t cantrips-mod` reads the pane as text; `tmux send-keys -t cantrips-mod -l '<text>'` then, after a pause, `tmux send-keys -t cantrips-mod Enter` submits a command, since text and Enter in one call land in the typeahead; the ctrl+x chords are out of its reach, and an SGR mouse sequence on the pane's ✕, a button or the chip stands in, its press and its release sent as two calls.
`mise run dev:mod-shot <out.png>` renders the pane to a PNG as the terminal draws it, through uv: the text capture drops color, dim and weight, so the agent reads each render back to judge a change to what the pane draws, and sends the user every render that shows one, through the harness's file-send tool.
Once the work on the mod is implemented, and before `/review-gate` runs on it, the agent drives the pane in that session as a user would — prompts and commands typed, buttons pressed, features switched, `/clear` and Resume — hunting behaviour the tests and the spec did not anticipate, and fixes each surprise red first or records it in the ticket's close.
Work the pane only draws is simulated, not run: the preview's model dispatches the role a section shows with a prompt that sleeps and answers one word, never a real `/review-gate` or other loop run, whose tokens and edits prove nothing the drawing needs.
Every dispatch the preview makes names Haiku as its model, over any model a definition pins or a skill recommends, since the pane draws the role and never the model it runs on.
A finders or verifiers row counts every agent the engine still lists, so stop the earlier dispatches before the batch that should read N/N.
A hot reload keeps the loop tool registered as the session first registered it, so a change to the tool's description or input reaches the model only in a new session: `tmux respawn-pane -k -t cantrips-mod` starts one in place, the maintainer's attached client staying on it.
