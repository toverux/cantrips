---
name: afk
description: Keep the session's prompt cache warm while you step away.
disable-model-invocation: true
version: 1.0.0
---

**Claude Code only.** If you do not have a `ScheduleWakeup` tool, **say so and stop** — a shell sleep or an external scheduler runs outside this session and warms nothing.

Keep this session warm across a break.
Schedule the next wakeup with `ScheduleWakeup`:

- `prompt` — `/afk` verbatim, so the wakeup re-enters this skill and chains the next one.
- `delaySeconds` — 3000.
- `reason` — name cache warming, so the user reads why the session woke.

On each wake, reply with just "ping X" (number them), schedule the next wakeup, and leave the user's work untouched.

Stop the loop when the user returns, or when you reach ten pings (failure mode).
Call `ScheduleWakeup` with `stop: true` so a pending wakeup cannot fire once the loop has ended.
