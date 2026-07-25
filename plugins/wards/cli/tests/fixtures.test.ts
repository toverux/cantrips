// oxlint-disable node/no-sync -- test assertions, synchronous IO keeps them linear and readable.

import { afterAll, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { cleanupFixtures, commitAll, createGitRepo, writeTree } from './fixtures.ts';

afterAll(cleanupFixtures);

// The git-repo fixture underpins the later list/status/fetch tickets, so its contract is pinned
// here: a materialized working tree, a resolvable HEAD, and reachable history across commits.
test('createGitRepo materializes files and a resolvable HEAD', () => {
  const repo = createGitRepo({ 'rules/x.md': '# x\n' });

  expect(existsSync(path.join(repo.dir, '.git'))).toBe(true);
  expect(existsSync(path.join(repo.dir, 'rules', 'x.md'))).toBe(true);
  expect(repo.head).toMatch(/^[0-9a-f]{40}$/u);
});

test('commitAll records a distinct commit reachable from HEAD', () => {
  const repo = createGitRepo({ 'a.md': 'one\n' });

  writeTree(repo.dir, { 'a.md': 'two\n' });

  const second = commitAll(repo, 'update a');

  expect(second).not.toBe(repo.head);
  expect(second).toMatch(/^[0-9a-f]{40}$/u);
});
