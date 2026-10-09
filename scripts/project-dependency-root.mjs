import { createRequire } from 'node:module';
import path from 'node:path';

export function resolveProjectDependencyRoot(sourceUrl) {
  const requireFromSource = createRequire(sourceUrl);
  const nextPackagePath = requireFromSource.resolve('next/package.json');
  const dependencyRoot = path.dirname(path.dirname(nextPackagePath));
  if (path.basename(dependencyRoot).toLowerCase() !== 'node_modules') {
    throw new Error('Next.js dependency must resolve from a node_modules directory.');
  }
  return dependencyRoot;
}
