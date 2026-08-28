---
name: handoff
description: Compact the current conversation into a handoff document for another agent to pick up.
argument-hint: "What will the next session be used for?"
disable-model-invocation: true
version: 1.1.2
source: mattpocock/skills@1.2.0 (handoff)
---

Write a handoff document summarising the current conversation so a fresh agent can continue the work. Save to the temporary directory of the user's OS - not the current workspace.

A handoff is compaction for resuming work, never a substitute for a spec: decisions that should outlive the session belong in the feature's spec — land them there first (a dated annotation, the annotate-spec verb), then reference the spec.
When the work has no spec, name those decisions in the handoff and flag them for `/compound`, so a durable store carries them instead of the temp file.
The loop config translates the storage verbs: it is `docs/agents/cantrips-loop.md`, and when that doc is absent the plugin defaults ([defaults.md](../setup-cantrips-loop/defaults.md)) govern.

Include a "suggested skills" section in the document, which suggests skills that the agent should invoke.

Reference artifacts already captured elsewhere (specs, plans, ADRs, issues, commits, diffs) by path or URL rather than duplicating their content.

Redact any sensitive information, such as API keys, passwords, or personally identifiable information.

If the user passed arguments, treat them as a description of what the next session will focus on and tailor the doc accordingly.

End by reporting the document's path so the user can point the fresh session at it.
