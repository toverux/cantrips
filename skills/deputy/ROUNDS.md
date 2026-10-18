# The deputy

A session-wide stand-in: one sub-agent, engaged through `/deputy`, that answers in the user's place every round, gate and closing a skill would otherwise put to them, or in advisor mode recommends on each while the user answers.
The user is the CEO, who reads the transcript later; the deputy is the CTO deciding for them; the session is the tech lead putting the questions.

## Dispatch

One deputy serves the whole session, dispatched at the first round, gate or closing that needs the user: dispatch `cantrips:deputy`, labelled `Deputy`, that word alone, where the dispatch primitive takes a label, keep what the dispatch returned to address it by, send every later gate as a follow-up message to that same agent, and close it on `/deputy off`, where the harness has a close step.
Where the harness loads no plugin agent definitions, read [`deputy.md`](../../agents/deputy.md), skip its frontmatter, paste its body into a general-purpose dispatch run in the background, and apply the model its frontmatter names where the dispatch primitive exposes a selector.
A deputy dispatched after rounds were answered is onboarded with them, so one message serves a first engagement, a re-engagement after `off`, and a session that no longer holds its deputy's handle — after a context summary — which dispatches afresh at the next gate and says so in one line.
`/deputy <orders>` reaches a dispatched deputy as a follow-up message, and joins the held orders before one.

The dispatch message carries, and only carries:

- the mode, deciding or advisor, and the standing orders — whatever followed `/deputy` on invocation, free text — or none;
- every round this session has put so far: each question as it was asked, options and recommendation included, with its answer under it, labelled `User:` or `Deputy:` by who gave it;
- the loop config's content — `docs/agents/cantrips-loop.md`, or [defaults.md](../setup-cantrips-loop/defaults.md) where the repo has none;
- the repo's root, read-only;
- the round, gate or closing that dispatched it, as At a gate says.

Not the transcript, not skill bodies, not exploration reports or working notes.

## At a gate

Send the deputy what the skill would have put to the user, as the skill would have put it — a closing's choice with each step's condition and what the session knows of it — and nothing the skill would not have put to the user.
Where the user answered a round themselves since the last message, open with their answers, labelled `User:`: they stand for that round, and the delegation holds.

Print the reply verbatim under a one-line header, `**Deputy** — <the round or gate>`, then act on it:

- `Qn — <answer>` is the answer, as the user's would have been; a closing's reply names the step to render.
- `Qn — your call` is resolved with your own recommendation.
- `Changed: Qk — <new answer>, <why>` replaces the earlier answer; carry the change into whatever was built on it.
- `Qn — CEO: <recommendation>` is a hand-back: stop at once — nothing else of the round or the skill proceeds — notify the user where the harness has a tool for it, and put that one question to the user in the skill's own format, labelled as the deputy's hand-back with the deputy's recommendation attached, ending the message there; inside a `--loop` run it parks as a `user` item instead and the loop works on.
  Once the user answers, the rest proceeds.

In advisor mode the user gives every final answer: print the header line, then each question in the skill's format with the deputy's line for it verbatim under the question's recommendation — a `your call` or `Changed:` line the same way, a closing's chosen step the same way — and wait for the user, notified where the harness has a tool for it.
Advisor mode changes who gives the final answer and not what `--loop` or `--fsd` waits on: under `--fsd` the deputy's reply still reaches `answers`, as in deciding mode.
