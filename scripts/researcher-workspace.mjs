import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));

export function createResearcherWorkspace() {
  // Same-drive source files avoid Windows/SWC path issues. The existing .next
  // ignore rules keep these isolated copies out of Git, ESLint and Jest.
  const parent = path.join(projectRoot, '.next', 'researcher-ci-workspaces');
  mkdirSync(parent, { recursive: true });
  const root = mkdtempSync(path.join(parent, 'starlab-researcher-ci-'));
  const cleanup = () => {
    if (path.dirname(root) === parent && path.basename(root).startsWith('starlab-researcher-ci-')) {
      rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
  };
  try {
    for (const entry of [
      'app/researcher',
      'app/layout.tsx',
      'app/globals.css',
      'app/components/ErrorBoundary',
      'package.json',
      'package-lock.json',
      'tsconfig.json',
      'eslint.config.mjs',
      '.prettierrc',
    ]) {
      cpSync(path.join(projectRoot, entry), path.join(root, entry), { recursive: true });
    }
    symlinkSync(
      path.join(projectRoot, 'node_modules'),
      path.join(root, 'node_modules'),
      process.platform === 'win32' ? 'junction' : 'dir'
    );
    writeFileSync(
      path.join(root, 'next.config.mjs'),
      'export default { devIndicators: false, outputFileTracingRoot: ' +
        JSON.stringify(projectRoot) +
        ', eslint: { dirs: ["app/researcher"] } };\n'
    );
    return { root, nextCli: path.join(projectRoot, 'node_modules/next/dist/bin/next'), cleanup };
  } catch (error) {
    cleanup();
    throw error;
  }
}
