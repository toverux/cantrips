# Changelog

## [2.4.0](https://github.com/toverux/cantrips/compare/v2.3.0...v2.4.0) (2026-08-07)


### Features

* **compound:** carry an ADR's status in frontmatter alongside its date and area ([bc659c8](https://github.com/toverux/cantrips/commit/bc659c84228615832fc8e161a8aa39a8c5d581a3))

## [2.3.0](https://github.com/toverux/cantrips/compare/v2.2.0...v2.3.0) (2026-08-07)


### Features

* **skills:** add /afk to keep an idle session's prompt cache warm ([2f79e57](https://github.com/toverux/cantrips/commit/2f79e57348f5399b3ec97160a83e823333d321f6))
* **skills:** add /questionnaire for decisions only another person can settle ([881d016](https://github.com/toverux/cantrips/commit/881d016c2875b65a0162e2ef6f0dd10c8d1f46a1))
* **skills:** add /setup-git-guardrails across Claude Code and Codex CLI ([a38dad0](https://github.com/toverux/cantrips/commit/a38dad0fe94a3ec8093ad243604947dffe237a88))
* **skills:** fork /wait-what so a message that missed can be re-pitched ([46a33cf](https://github.com/toverux/cantrips/commit/46a33cf465ee867039cfc8f22889f5800b93c987))
* **skills:** reconcile the forks with upstream and widen the authoring standard past skills ([4d36b87](https://github.com/toverux/cantrips/commit/4d36b8749fe836d3130f06e3933cb8215917f590))

## [2.2.0](https://github.com/toverux/cantrips/compare/v2.1.0...v2.2.0) (2026-08-04)


### Features

* **skills:** drive the review gate to green with /review-gate --loop ([ce25390](https://github.com/toverux/cantrips/commit/ce2539074c994b0e8d64d3f5af8407b74f71cc3c))
* **skills:** name the two ways agent-facing prose fails without going stale ([099e8d1](https://github.com/toverux/cantrips/commit/099e8d19966eae48323c6419d79fea012bc8e2de))


### Bug Fixes

* **skills:** keep every sub-agent dispatch backgrounded ([f4a419d](https://github.com/toverux/cantrips/commit/f4a419d910b9a91e679562dbe5bb41a102c19a86))

## [2.1.0](https://github.com/toverux/cantrips/compare/v2.0.0...v2.1.0) (2026-08-02)


### Features

* **skills:** review what git does not track, and stop gating what an agent can judge ([395cf46](https://github.com/toverux/cantrips/commit/395cf46e64c4bc6bc474ed0fc5776fa8cd465566))
* **skills:** unify the two quality taxonomies and open /simplify to agent-facing prose ([0c434e7](https://github.com/toverux/cantrips/commit/0c434e77ac9ea57b7d13d360f2596c54d926fb08))


### Bug Fixes

* **skills:** word the flow-pointer reference so agents load the format instead of inventing one ([635b9d9](https://github.com/toverux/cantrips/commit/635b9d9bf90fde00aca4e31b07848a1a3f16bf09))

## [2.0.0](https://github.com/toverux/cantrips/compare/v1.0.0...v2.0.0) (2026-07-30)


### ⚠ BREAKING CHANGES

* docs/solutions/ is opt-in. A repo that has not run /setup-cantrips-loop neither reads nor writes it, and the same holds for the new docs/adr/ store.

### Features

* put the loop's storage behind a verb contract and add an opt-in ADR store ([3a6ebea](https://github.com/toverux/cantrips/commit/3a6ebea6240bedf175ad31ff8625fdeb7d249576))


### Bug Fixes

* **commit:** bound the message body and keep session process out of it ([8589dec](https://github.com/toverux/cantrips/commit/8589decdb7e69e80884b7a5307022ac9b7885b5a))
* **commit:** gate compound's written prose on a diff review before it enters a commit ([cca2730](https://github.com/toverux/cantrips/commit/cca27301bb0fff0b4b0488ed2c2123e6d3d22be7))
* **skills:** carry upstream deltas byte-identical and adopt the model-selection paragraph ([8c68726](https://github.com/toverux/cantrips/commit/8c68726464e94f36d455ac56b9d94835f66b0f12))
* **skills:** restore byte-identical upstream carriage across eleven forks ([5e4d4f6](https://github.com/toverux/cantrips/commit/5e4d4f67f3c0c571da7b345f97ebbb0a5be59b81))
* **skills:** sync compound-engineering forks with upstream v3.20.0 ([84745ba](https://github.com/toverux/cantrips/commit/84745ba2a5371144171749dff54d2ccc9351662f))

## 1.0.0 (2026-07-25)


### ⚠ BREAKING CHANGES

* the wards plugin is removed, and cantrips moves. Install it with `/plugin marketplace add toverux/cantrips` followed by `/plugin install cantrips@cantrips`.

### Features

* rebuild the repository as cantrips, a content-only skills plugin ([11877c1](https://github.com/toverux/grimoire/commit/11877c18e1d6066044f2b62d3ef160591afee2be))

## Changelog
