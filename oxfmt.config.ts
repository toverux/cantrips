import config from '@toverux/blanc-hopital/oxfmt';
import { defineConfig } from 'oxfmt';

// oxlint-disable-next-line import/no-default-export - oxfmt interface
export default defineConfig({
  ...config,
  // Local keys stay after the spread so a future shared-config key cannot override them.
  ignorePatterns: [
    // "release-please" generates CHANGELOG.md files; reformatting them makes CI
    // fail on release PRs (dirty tree after the format check).
    '**/CHANGELOG.md'
  ]
});
