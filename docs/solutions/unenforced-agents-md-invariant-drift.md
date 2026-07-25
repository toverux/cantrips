---
date: 2026-07-22
area: plugin-sync
symptoms:
  - 'three skills shipped with no agents/openai.yaml sidecar, violating the AGENTS.md "every skill carries a sidecar" rule, with no check failing'
tags: [agents-md, invariants, sidecars, check-plugin-sync, codex]
updated: 2026-07-25
---

# Unenforced AGENTS.md invariant drifted silently

## Problem

AGENTS.md stated "every skill carries an `agents/openai.yaml` sidecar" as an authoring rule, and three skills shipped without one — undetected until a review sub-agent happened to look.
The sidecar is what stops Codex CLI from auto-firing user-invoked skills, so the drift was semantically load-bearing, not cosmetic.

## What didn't work

Manual discipline as the only guard: the rule was written down, every skill author (human and agent) was expected to follow it, and the repo's check suite was green the whole time the violation existed.

## Root cause

An every-X-has-Y invariant stated in prose had no mechanical counterpart: `scripts/check-plugin-sync.ts` covered manifests, catalogs, and versions, but never opened a skill directory.

## Fix

`checkSkillSidecars()` in `scripts/check-plugin-sync.ts`: every skill directory must contain the sidecar, and its `allow_implicit_invocation` must be the logical inverse of the SKILL.md `disable-model-invocation` frontmatter.

## Prevention

When AGENTS.md gains a cross-file invariant ("every X has Y", "A must match B"), extend `check-plugin-sync.ts` in the same change; a rule the suite cannot fail on will drift.
The AGENTS.md enforcement list now names the sidecar check, keeping the doc and the script in lockstep.

The pattern to carry forward: the moment a document states that two files must agree, the agreement needs an assertion in the same change, and that assertion needs to be watched failing before it is believed.
