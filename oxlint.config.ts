import agnostic from '@toverux/blanc-hopital/oxlint/agnostic';
import all from '@toverux/blanc-hopital/oxlint/all';
import { defineConfig } from 'oxlint';

// oxlint-disable-next-line import/no-default-export - oxlint interface
export default defineConfig({
  extends: [all, agnostic],
  rules: {
    // Everything JS/TS here runs under node/bun (scripts, the wards hook), so
    // Node builtins are fine.
    'import/no-nodejs-modules': 'off'
  }
});
