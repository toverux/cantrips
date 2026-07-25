// The single shared home for the ward-header grammar: the comment-token table, the enumerations,
// and a description of every field. The CLI parser validates against these constants, and the
// scroll-authoring docs are meant to render from the same data, so a new token or field is added
// here once and both consumers follow.

// Line-comment tokens the parser recognizes at the head of an executable scroll. Block comments
// are unsupported by design; these four line tokens cover every target language with one parser.
export const commentTokens = ['//', '#', '--', ';'] as const;

export type CommentToken = (typeof commentTokens)[number];

// The three scroll kinds. A scroll's file shape follows its kind: rules and templates are Markdown
// with YAML frontmatter, hooks are executables with a line-comment header.
export const wardKinds = ['rule', 'hook', 'template'] as const;

export type WardKind = (typeof wardKinds)[number];

// Where a scroll is recommended to live. Scope is a root-path parameter downstream, so these names
// map to a project's `.agents/` versus the user's `~/.agents/`.
export const wardScopes = ['project', 'user'] as const;

export type WardScope = (typeof wardScopes)[number];

// Neutral hook wiring events. A hook declares when it fires in harness-agnostic terms; each harness
// integration translates the event to its own mechanism.
export const wardEvents = ['fires-after-file-edit'] as const;

export type WardEvent = (typeof wardEvents)[number];

// The top-level key that marks a file as a scroll. A file carries ward metadata only when this key
// is present at the head of its frontmatter or comment header; everything else is left untouched.
export const wardMarkerKey = 'ward';

// Where an install puts things, relative to a scope root. `status` scans these and the dogfood
// check verifies them, so both read one definition: a path that exists in only one of the two is a
// path whose drift nothing reports.
export const scopeSubdirectories = ['rules', 'hooks'] as const;

// A template never lands in `.agents/`: it describes a file the project already owns, so its
// provenance rides in that file's own ward block. These are the only two files that may carry it.
export const templateCarriers = ['AGENTS.md', '.codex/AGENTS.md'] as const;

export type WardFieldType = 'string' | 'semver' | 'enum' | 'string-list';

export interface WardFieldDoc {
  name: string;
  type: WardFieldType;
  required: boolean;
  values?: readonly string[];
  appliesTo?: readonly WardKind[];
  summary: string;
}

// The source-side fields a scroll author writes, described as data so the authoring docs can render
// this table without duplicating it. The installed-side provenance list is documented separately
// because the installer writes it, not the author.
export const wardSourceFields: readonly WardFieldDoc[] = [
  {
    name: 'kind',
    type: 'enum',
    required: true,
    values: wardKinds,
    summary: `The scroll kind, which fixes its file shape and integration.`
  },
  {
    name: 'description',
    type: 'string',
    required: true,
    summary: `A one-line human summary shown in a source offering.`
  },
  {
    name: 'version',
    type: 'semver',
    required: true,
    summary: `The per-scroll semver, hand-bumped on every content change.`
  },
  {
    name: 'applicability',
    type: 'string-list',
    required: false,
    summary: `Neutral globs the scroll applies to; omit for an always-loaded scroll.`
  },
  {
    name: 'scope',
    type: 'enum',
    required: false,
    values: wardScopes,
    summary: `The recommended install scope, overridable at install time.`
  },
  {
    name: 'event',
    type: 'enum',
    required: false,
    values: wardEvents,
    appliesTo: ['hook'],
    summary: `For hooks, the neutral event that triggers the hook.`
  }
];
