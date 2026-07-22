import config from '@toverux/blanc-hopital/oxfmt';
import { defineConfig } from 'oxfmt';

// oxlint-disable-next-line import/no-default-export - oxfmt interface
export default defineConfig({
  ...config,
  // Local keys stay after the spread so a future shared-config key cannot override them.
  ignorePatterns: [
    // "release-please" generates CHANGELOG.md files; reformatting them makes CI fail on release PRs
    // (dirty tree after the format check).
    '**/CHANGELOG.md',
    // "release-please" bumps the version in these plugin.json manifests via its "extra-files" JSON
    // updater, which re-serializes the whole file with expanded arrays (e.g. "keywords" one entry
    // per line), a shape oxfmt collapses inline.
    // The two are irreconcilable, so exempt the manifests to keep release PRs green;
    // check-plugin-sync.ts still guards their structure.
    '**/.claude-plugin/plugin.json',
    '**/.codex-plugin/plugin.json'
  ]
});
