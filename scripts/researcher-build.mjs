import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

import { createResearcherWorkspace } from './researcher-workspace.mjs';

const workspace = createResearcherWorkspace();
const buildRoot = workspace.root;

// An isolated snapshot keeps unrelated routes, .env files and the running
// preview's .next output out of this build. Shared layout imports must be
// included here (and in the workflow path filters) when that layout changes.
let exitCode = 1;
try {
  process.stdout.write('Building /researcher/studies/new in an isolated Next.js workspace.\n');
  const result = spawnSync(process.execPath, [workspace.nextCli, 'build'], {
    cwd: buildRoot,
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  exitCode = result.status ?? 1;
  if (exitCode === 0) {
    const manifest = JSON.parse(readFileSync(path.join(buildRoot, '.next/prerender-manifest.json'), 'utf8'));
    if (
      !manifest.routes['/researcher/studies/new'] ||
      !existsSync(path.join(buildRoot, '.next/server/app/researcher/studies/new.html'))
    ) {
      throw new Error('The build did not generate the researcher route.');
    }
    process.stdout.write('Researcher route built successfully with lint and TypeScript checks enabled.\n');
  }
} catch (error) {
  process.stderr.write('Researcher build failed: ' + (error instanceof Error ? error.message : String(error)) + '\n');
  exitCode = 1;
} finally {
  workspace.cleanup();
}
process.exitCode = exitCode;
