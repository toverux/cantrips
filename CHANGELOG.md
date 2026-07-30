# Changelog

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
