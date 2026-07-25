import agnostic from '@toverux/blanc-hopital/oxlint/agnostic';
import all from '@toverux/blanc-hopital/oxlint/all';
import { defineConfig } from 'oxlint';

// The keys of the machine-parsed `ward:` YAML header an executable scroll opens with. They are
// lowercase because they are YAML keys, not prose, so those lines alone are exempt from
// capitalized-comments; every other comment in a scroll answers to the rule.
const wardHeaderKeys =
  'ward|kind|description|version|applicability|scope|event|' +
  'provenance|source|path|ref|commit|notes';

// oxlint-disable-next-line import/no-default-export - oxlint interface
export default defineConfig({
  extends: [all, agnostic],
  rules: {
    // Everything JS/TS here runs under node/bun (scripts, the wards hook), so
    // Node builtins are fine.
    'import/no-nodejs-modules': 'off'
  },
  overrides: [
    {
      // An ambient module declaration (e.g. the local bun:test typings) is a script file with no
      // import or export, which this rule cannot tell from a stray non-module.
      files: ['**/*.d.ts'],
      rules: {
        'import/unambiguous': 'off'
      }
    },
    {
      files: ['example-scrolls/**', '.agents/hooks/**'],
      rules: {
        // Options replace the shared config's wholesale, so its own exemptions are restated here.
        'capitalized-comments': [
          'warn',
          'always',
          {
            ignoreConsecutiveComments: true,
            ignoreInlineComments: true,
            ignorePattern: `^(?:noinspection|\\s*(?:${wardHeaderKeys}):)`
          }
        ]
      }
    }
  ]
});
