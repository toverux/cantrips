// A minimal local typing for the `bun:test` runner API the wards tests use, so tsc and oxlint
// resolve it without pulling in the full bun type package. Extend this as the tests reach for more
// of the runner's surface.

declare module 'bun:test' {
  export interface Matchers {
    toBe: (expected: unknown) => void;
    toEqual: (expected: unknown) => void;
    toContain: (expected: unknown) => void;
    toHaveLength: (expected: number) => void;
    toMatch: (expected: RegExp | string) => void;
    not: Matchers;
  }

  export function expect(value: unknown): Matchers;
  export function test(name: string, fn: () => void | Promise<void>): void;
  export function describe(name: string, fn: () => void): void;
  export function afterAll(fn: () => void | Promise<void>): void;
}
