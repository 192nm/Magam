import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const windows = process.platform === 'win32';
const child = spawn(
  windows ? 'gradlew.bat' : './gradlew',
  ['bootRun', '--no-daemon', '-PmagamBuildDir=build-dev'],
  {
    cwd: fileURLToPath(new URL('../backend', import.meta.url)),
    stdio: 'inherit',
    shell: windows,
    windowsHide: true,
  },
);
child.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
