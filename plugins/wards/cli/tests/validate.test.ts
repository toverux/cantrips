import { afterAll, describe, expect, test } from 'bun:test';
// The payload type comes from the module under test, so a change to the reported shape shows up
// here as a type error rather than as a green assertion against a payload that no longer exists.
import type { ValidateResult } from '../validate.ts';
import { wardSourceFields } from '../ward-grammar.ts';
import {
  type FileTree,
  cleanupFixtures,
  createTempTree,
  hookScroll,
  ruleScroll,
  runCli
} from './fixtures.ts';

afterAll(cleanupFixtures);

function validate(files: FileTree): { output: ValidateResult; exitCode: number } {
  const dir = createTempTree(files);
  const result = runCli(['validate', dir]);

  return { output: result.json() as ValidateResult, exitCode: result.exitCode };
}

const styleRule = ruleScroll({
  version: '2.1.0',
  description: 'General code style.',
  applicability: ['**/*.{ts,tsx}'],
  scope: 'project',
  body: '# General Code Style\n'
});

const checkHook = hookScroll({
  version: '2.1.0',
  description: 'Flag overlong lines after an edit.',
  scope: 'project',
  event: 'fires-after-file-edit',
  body: "import process from 'node:process';\n"
});

describe('valid ward metadata', () => {
  test('parses YAML frontmatter in a Markdown rule', () => {
    const { output, exitCode } = validate({ 'rule.md': styleRule });

    expect(exitCode).toBe(0);
    expect(output.ok).toBe(true);
    expect(output.diagnostics).toEqual([]);
    expect(output.scrolls).toHaveLength(1);
    expect(output.scrolls[0]?.ward).toEqual({
      kind: 'rule',
      description: 'General code style.',
      version: '2.1.0',
      applicability: ['**/*.{ts,tsx}'],
      scope: 'project'
    });
  });

  test('parses a line-comment header in an executable hook', () => {
    const { output, exitCode } = validate({ 'hook.ts': checkHook });

    expect(exitCode).toBe(0);
    expect(output.scrolls[0]?.ward).toEqual({
      kind: 'hook',
      description: 'Flag overlong lines after an edit.',
      version: '2.1.0',
      scope: 'project',
      event: 'fires-after-file-edit'
    });
  });

  test('auto-detects the #, --, and ; comment tokens, skipping a shebang', () => {
    const shellHook = [
      '#!/usr/bin/env bash',
      '# ward:',
      '#   kind: hook',
      '#   description: A shell hook.',
      '#   version: 0.1.0',
      '#   event: fires-after-file-edit',
      'echo hi',
      ''
    ].join('\n');

    const luaHook = [
      '-- ward:',
      '--   kind: hook',
      '--   description: A dash-commented hook.',
      '--   version: 1.0.0',
      ''
    ].join('\n');

    const lispHook = [
      '; ward:',
      ';   kind: hook',
      ';   description: A semicolon-commented hook.',
      ';   version: 3.2.1',
      ''
    ].join('\n');

    const { output, exitCode } = validate({
      'a.sh': shellHook,
      'b.lua': luaHook,
      'c.el': lispHook
    });

    expect(exitCode).toBe(0);
    expect(output.scrolls.map(scroll => scroll.ward.description)).toEqual([
      'A shell hook.',
      'A dash-commented hook.',
      'A semicolon-commented hook.'
    ]);
  });

  test('parses a multi-entry installed provenance list', () => {
    const installed = [
      '---',
      'ward:',
      '  kind: rule',
      '  description: Installed rule.',
      '  version: 2.1.0',
      '  provenance:',
      '    - source: owner/repo',
      '      path: rules/x.md',
      '      version: 2.0.0',
      '      notes: relaxed the line limit',
      '    - source: other/repo',
      '      path: y.md',
      '      commit: abc1234',
      '---',
      ''
    ].join('\n');

    const { output, exitCode } = validate({ 'installed.md': installed });

    expect(exitCode).toBe(0);
    expect(output.scrolls[0]?.ward.provenance).toEqual([
      {
        source: 'owner/repo',
        path: 'rules/x.md',
        version: '2.0.0',
        notes: 'relaxed the line limit'
      },
      { source: 'other/repo', path: 'y.md', commit: 'abc1234' }
    ]);
  });

  test('skips files without a ward marker', () => {
    const skillLike = [
      '---',
      'name: something',
      'description: not a scroll',
      'version: 1.0.0',
      '---',
      '# Title',
      ''
    ].join('\n');

    const { output, exitCode } = validate({
      'SKILL.md': skillLike,
      'README.md': '# Hello\n\nPlain prose.\n',
      'script.ts': "console.log('no ward here');\n"
    });

    expect(exitCode).toBe(0);
    expect(output.scrolls).toEqual([]);
    expect(output.diagnostics).toEqual([]);
  });
});

describe('invalid ward metadata', () => {
  test('rejects an unknown kind', () => {
    const { output, exitCode } = validate({
      'bad.md': '---\nward:\n  kind: spell\n  description: x.\n  version: 1.0.0\n---\n'
    });

    expect(exitCode).toBe(1);
    expect(output.ok).toBe(false);
    expect(output.diagnostics[0]?.path).toBe('bad.md');
    expect(output.diagnostics[0]?.message).toContain('kind');
  });

  test('rejects a missing required field', () => {
    const { output, exitCode } = validate({
      'bad.md': '---\nward:\n  kind: rule\n  version: 1.0.0\n---\n'
    });

    expect(exitCode).toBe(1);
    expect(output.diagnostics[0]?.message).toContain('description');
  });

  test('rejects a non-semver version', () => {
    const { output, exitCode } = validate({
      'bad.md': '---\nward:\n  kind: rule\n  description: x.\n  version: 2.1\n---\n'
    });

    expect(exitCode).toBe(1);
    expect(output.diagnostics[0]?.message).toContain('X.Y.Z');
  });

  test('rejects a prerelease version', () => {
    const { output, exitCode } = validate({
      'bad.md': '---\nward:\n  kind: rule\n  description: x.\n  version: 1.0.0-rc.1\n---\n'
    });

    expect(exitCode).toBe(1);
    expect(output.diagnostics[0]?.message).toContain('X.Y.Z');
  });

  test('rejects a version with build metadata', () => {
    const { output, exitCode } = validate({
      'bad.md': '---\nward:\n  kind: rule\n  description: x.\n  version: 1.0.0+build.1\n---\n'
    });

    expect(exitCode).toBe(1);
    expect(output.diagnostics[0]?.message).toContain('X.Y.Z');
  });

  test('rejects duplicate YAML keys', () => {
    const { output, exitCode } = validate({
      'bad.md': [
        '---',
        'ward:',
        '  kind: rule',
        '  description: First.',
        '  description: Second.',
        '  version: 1.0.0',
        '---',
        ''
      ].join('\n')
    });

    expect(exitCode).toBe(1);
    expect(output.diagnostics[0]?.message).toContain('Duplicate mapping key "description"');
  });

  test('rejects malformed YAML under a ward marker', () => {
    const broken = ['---', 'ward:', '  kind: rule', '   description: bad indent', '---', ''].join(
      '\n'
    );
    const { output, exitCode } = validate({ 'bad.md': broken });

    expect(exitCode).toBe(1);
    expect(output.diagnostics[0]?.message).toContain('Malformed YAML frontmatter');
  });

  test('rejects a malformed comment header', () => {
    const broken = ['// ward:', '//   kind: hook', '//   this line has no colon', ''].join('\n');
    const { output, exitCode } = validate({ 'bad.ts': broken });

    expect(exitCode).toBe(1);
    expect(output.diagnostics[0]?.message).toContain('Malformed comment header');
  });

  test('rejects a wiring event on a non-hook scroll', () => {
    const broken = [
      '---',
      'ward:',
      '  kind: rule',
      '  description: x.',
      '  version: 1.0.0',
      '  event: fires-after-file-edit',
      '---',
      ''
    ].join('\n');
    const { output, exitCode } = validate({ 'bad.md': broken });

    expect(exitCode).toBe(1);
    expect(output.diagnostics[0]?.message).toContain('event');
  });

  test('exits non-zero when any scroll in a tree is invalid', () => {
    const { output, exitCode } = validate({
      'good.md': styleRule,
      'bad.md': '---\nward:\n  kind: spell\n  description: x.\n  version: 1.0.0\n---\n'
    });

    expect(exitCode).toBe(1);
    expect(output.ok).toBe(false);
    expect(output.scrolls).toHaveLength(1);
    expect(output.diagnostics).toHaveLength(1);
  });
});

describe('cli argument handling', () => {
  test('exits 2 with usage when no command is given', () => {
    const result = runCli([]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('Usage');
  });

  test('exits 2 on an unknown command', () => {
    const result = runCli(['conjure']);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('Unknown command');
  });

  test('exits 2 when the validate target is not a directory', () => {
    const result = runCli(['validate', 'does/not/exist']);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('Not a directory');
  });
});

// The grammar table in ward-grammar.ts is what the README renders and what the validator must
// honor. These tests drive off it, so a field added there fails here until the validator and the
// sample below cover it.
const sampleLines: Record<string, string[]> = {
  kind: ['  kind: hook'],
  description: ['  description: A documented scroll.'],
  version: ['  version: 1.0.0'],
  applicability: ['  applicability:', "    - '**/*.ts'"],
  scope: ['  scope: project'],
  event: ['  event: fires-after-file-edit']
};

function headerFor(fields: readonly string[], overrides: Record<string, string[]> = {}): string {
  const body = fields.flatMap(name => overrides[name] ?? sampleLines[name] ?? []);

  return ['---', 'ward:', ...body, '---', '# Scroll', ''].join('\n');
}

describe('the documented ward grammar', () => {
  const documented = wardSourceFields.map(field => field.name);
  const required = wardSourceFields.filter(field => field.required).map(field => field.name);

  test('has a sample for every documented field', () => {
    expect(Object.keys(sampleLines)).toEqual(documented);
  });

  test('accepts a scroll carrying every documented field', () => {
    const { output, exitCode } = validate({ 'scroll.md': headerFor(documented) });

    expect(exitCode).toBe(0);
    expect(Object.keys(output.scrolls[0]?.ward ?? {})).toEqual(documented);
  });

  test('accepts a scroll carrying only the required fields', () => {
    const { output, exitCode } = validate({ 'scroll.md': headerFor(required) });

    expect(exitCode).toBe(0);
    expect(output.scrolls).toHaveLength(1);
  });

  for (const field of wardSourceFields.filter(entry => entry.required)) {
    test(`rejects a scroll missing the required field "${field.name}"`, () => {
      const kept = documented.filter(name => name != field.name);
      const { output, exitCode } = validate({ 'scroll.md': headerFor(kept) });

      expect(exitCode).toBe(1);
      expect(output.diagnostics.some(entry => entry.message.includes(field.name))).toBe(true);
    });
  }

  for (const field of wardSourceFields.filter(entry => entry.values != null)) {
    test(`rejects a value outside the documented set for "${field.name}"`, () => {
      const override = { [field.name]: [`  ${field.name}: not-a-documented-value`] };
      const { output, exitCode } = validate({ 'scroll.md': headerFor(documented, override) });
      const message = output.diagnostics.map(entry => entry.message).join(' ');

      expect(exitCode).toBe(1);

      for (const value of field.values ?? []) {
        expect(message).toContain(value);
      }
    });
  }
});

describe('hostile and awkward ward headers', () => {
  test('treats a __proto__ key as an ordinary field instead of injecting metadata', () => {
    const injected = [
      '---',
      'ward:',
      '  __proto__:',
      '    kind: rule',
      '    description: Metadata the file never declares.',
      '    version: 9.9.9',
      '---',
      ''
    ].join('\n');

    const { output, exitCode } = validate({ 'sneaky.md': injected });

    expect(exitCode).toBe(1);
    expect(output.scrolls).toEqual([]);
    expect(output.diagnostics.some(entry => entry.message.includes('kind'))).toBe(true);
  });

  test('rejects a duplicate __proto__ key like any other duplicate', () => {
    const duplicated = [
      '---',
      'ward:',
      '  kind: rule',
      '  description: A rule.',
      '  version: 1.0.0',
      '  __proto__: a',
      '  __proto__: b',
      '---',
      ''
    ].join('\n');

    const { output } = validate({ 'duplicate.md': duplicated });

    expect(output.diagnostics[0]?.message).toContain('Duplicate mapping key "__proto__"');
  });

  // Whole-line comments are the only comment form the grammar takes: mid-line a `#` is content, so
  // hand-written prose keeps it instead of being truncated where a full YAML parser would stop.
  test('skips a whole-line comment and keeps a mid-line # as content', () => {
    const commented = [
      '---',
      'ward:',
      '  # the kind fixes the file shape',
      '  kind: rule',
      '  description: Prefer # over slashes.',
      '  version: 1.0.0',
      '---',
      ''
    ].join('\n');

    const { output, exitCode } = validate({ 'commented.md': commented });

    expect(exitCode).toBe(0);
    expect(output.scrolls[0]?.ward).toEqual({
      kind: 'rule',
      description: 'Prefer # over slashes.',
      version: '1.0.0'
    });
  });

  test('keeps a # that is part of a value', () => {
    const fragment = [
      '---',
      'ward:',
      '  kind: rule',
      '  description: Uses the owner/repo#ref form.',
      '  version: 1.0.0',
      '  provenance:',
      '    - source: owner/repo',
      '      path: rules/x.md',
      '      version: 1.0.0',
      '      notes: pinned via owner/repo#legacy',
      '---',
      ''
    ].join('\n');

    const { output, exitCode } = validate({ 'fragment.md': fragment });

    expect(exitCode).toBe(0);
    expect(output.scrolls[0]?.ward.provenance).toEqual([
      {
        source: 'owner/repo',
        path: 'rules/x.md',
        version: '1.0.0',
        notes: 'pinned via owner/repo#legacy'
      }
    ]);
  });

  test('accepts a provenance entry pinned to a ref', () => {
    const pinned = [
      '---',
      'ward:',
      '  kind: rule',
      '  description: A pinned rule.',
      '  version: 1.0.0',
      '  provenance:',
      '    - source: owner/repo',
      '      path: rules/x.md',
      '      ref: legacy',
      '      version: 1.0.0',
      '---',
      ''
    ].join('\n');

    const { output, exitCode } = validate({ 'pinned.md': pinned });

    expect(exitCode).toBe(0);
    expect(output.scrolls[0]?.ward.provenance).toEqual([
      { source: 'owner/repo', path: 'rules/x.md', ref: 'legacy', version: '1.0.0' }
    ]);
  });
});

describe('ward header boundaries and unknown fields', () => {
  test('rejects a misspelled field instead of dropping it', () => {
    const typo = [
      '---',
      'ward:',
      '  kind: rule',
      '  description: A typo-laden rule.',
      '  version: 1.0.0',
      '  applicabilty:',
      '    - "**/*.ts"',
      '---',
      ''
    ].join('\n');

    const { output, exitCode } = validate({ 'typo.md': typo });

    expect(exitCode).toBe(1);
    expect(output.diagnostics[0]?.message).toContain('Unknown field "applicabilty"');
  });

  // The header is the ward mapping, not every comment that follows it: prose sitting directly
  // beneath the block would otherwise be fed to the YAML parser and invalidate the whole scroll.
  test('ends a comment header at the first line back in column 0', () => {
    const hook = [
      '// ward:',
      '//   kind: hook',
      '//   description: A hook with a licence notice.',
      '//   version: 1.0.0',
      '// Copyright (c) 2026 Someone.',
      '',
      "console.log('hi');",
      ''
    ].join('\n');

    const { output, exitCode } = validate({ 'hook.ts': hook });

    expect(exitCode).toBe(0);
    expect(output.scrolls[0]?.ward).toEqual({
      kind: 'hook',
      description: 'A hook with a licence notice.',
      version: '1.0.0'
    });
  });

  // A bare comment line is a separator an author writes for legibility. Reading it as the end of
  // the header drops every field below it, and the scroll still validates clean.
  test('keeps a blank comment line inside a header instead of truncating there', () => {
    const hook = [
      '// ward:',
      '//   kind: hook',
      '//   description: A hook whose header breathes.',
      '//   version: 1.0.0',
      '//',
      '//   scope: project',
      '//   event: fires-after-file-edit',
      '',
      "console.log('hi');",
      ''
    ].join('\n');

    const { output, exitCode } = validate({ 'hook.ts': hook });

    expect(exitCode).toBe(0);
    expect(output.scrolls[0]?.ward).toEqual({
      kind: 'hook',
      description: 'A hook whose header breathes.',
      version: '1.0.0',
      scope: 'project',
      event: 'fires-after-file-edit'
    });
  });

  // An editor that writes a BOM would otherwise hide an executable scroll from every command: the
  // comment token no longer sits at the head of the file.
  test('reads a comment header behind a UTF-8 byte order mark', () => {
    const { output, exitCode } = validate({ 'hook.ts': `\uFEFF${checkHook}` });

    expect(exitCode).toBe(0);
    expect(output.scrolls[0]?.ward.description).toBe('Flag overlong lines after an edit.');
  });

  test('rejects a misspelled provenance field instead of dropping it', () => {
    const typo = [
      '---',
      'ward:',
      '  kind: rule',
      '  description: An installed rule.',
      '  version: 1.0.0',
      '  provenance:',
      '    - source: owner/repo',
      '      path: rules/x.md',
      '      version: 1.0.0',
      '      note: relaxed the line limit',
      '---',
      ''
    ].join('\n');

    const { output, exitCode } = validate({ 'typo.md': typo });

    expect(exitCode).toBe(1);
    expect(output.diagnostics[0]?.message).toContain('Unknown field "provenance[0].note"');
  });

  // Version and commit are alternative pins on the same install, so an entry claiming both leaves
  // the comparison to pick one and ignore the other in silence.
  test('rejects a provenance entry recording both a version and a commit', () => {
    const both = [
      '---',
      'ward:',
      '  kind: rule',
      '  description: An installed rule.',
      '  version: 1.0.0',
      '  provenance:',
      '    - source: owner/repo',
      '      path: rules/x.md',
      '      version: 1.0.0',
      '      commit: abc1234',
      '---',
      ''
    ].join('\n');

    const { output, exitCode } = validate({ 'both.md': both });

    expect(exitCode).toBe(1);
    expect(output.diagnostics[0]?.message).toContain('not both');
  });
});
