// Wards versions are exactly three numeric components. The ward parser validates that shape before
// drift comparison reaches this module.
const coreComponentCount = 3;

export function compareSemver(a: string, b: string): number {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);

  for (let index = 0; index < coreComponentCount; index++) {
    const delta = (left[index] ?? 0) - (right[index] ?? 0);

    if (delta != 0) {
      return delta < 0 ? -1 : 1;
    }
  }

  return 0;
}
