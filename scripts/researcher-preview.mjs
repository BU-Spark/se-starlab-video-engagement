import { spawn } from 'node:child_process';
import process from 'node:process';
import { createResearcherWorkspace } from './researcher-workspace.mjs';

const workspace = createResearcherWorkspace();
const port = process.env.RESEARCHER_TEST_PORT || '3102';
const child = spawn(process.execPath, [workspace.nextCli, 'dev', '--hostname', '127.0.0.1', '--port', port], {
  cwd: workspace.root,
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
  stdio: 'inherit',
});
child.on('error', (error) => {
  process.stderr.write(error.message + '\n');
  process.exitCode = 1;
});
child.on('close', (code) => {
  workspace.cleanup();
  process.exitCode = code ?? 1;
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    child.kill(signal);
  });
}
