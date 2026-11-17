// The Stop hook's entry: loads mirror.ts only on a node that strips types (22.18 or later), so an older node stays silent.
const [major, minor] = process.versions.node.split('.').map(Number);
if (major > 22 || (major === 22 && minor >= 18)) await import('./mirror.ts');
