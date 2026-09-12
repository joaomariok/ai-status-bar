#!/usr/bin/env node
// Compiles, packages a .vsix into a temp directory, and installs it into the
// local `code` CLI so the extension can be dogfooded in a normal VS Code
// window instead of only the --disable-extensions Extension Development
// Host. The .vsix is removed afterward regardless of outcome.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));

// npm/npx/code ship as .cmd shims on Windows, which node's spawn cannot exec
// directly without a shell (EINVAL) — shell: true is required here, mirroring
// scripts/gate.mjs. Passing a single pre-joined string (rather than
// shell:true + an args array) avoids Node's shell-argument-escaping
// deprecation warning; safe here since every argument is either a fixed
// literal or a path we constructed ourselves, never user input.
const useShell = process.platform === 'win32';

function run(name, command, args) {
  console.log(`> ${name}`);
  const result = useShell
    ? spawnSync([command, ...args].join(' '), {
        cwd: repoRoot,
        stdio: 'inherit',
        shell: true,
      })
    : spawnSync(command, args, { cwd: repoRoot, stdio: 'inherit' });
  return result;
}

console.log('Installing extension into local VS Code...\n');

let tmpDir;
try {
  const compileResult = run('compile', 'npm', ['run', 'compile']);
  if (compileResult.error || compileResult.status !== 0) {
    console.error('\nFailed at step: compile');
    process.exit(compileResult.status ?? 1);
  }
  console.log('✓ compile\n');

  tmpDir = mkdtempSync(join(tmpdir(), 'ai-status-bar-vsix-'));
  const vsixPath = join(tmpDir, `ai-status-bar-${pkg.version}.vsix`);

  const packageResult = run('package', 'npx', [
    'vsce',
    'package',
    '--out',
    vsixPath,
  ]);
  if (packageResult.error || packageResult.status !== 0) {
    console.error('\nFailed at step: package');
    process.exit(packageResult.status ?? 1);
  }
  console.log('✓ package\n');

  const installResult = run('install', 'code', [
    '--install-extension',
    vsixPath,
    '--force',
  ]);
  if (installResult.error || installResult.status !== 0) {
    console.error(
      '\nFailed at step: install\n' +
        "Could not run 'code'. Make sure the VS Code 'code' CLI is on your PATH: " +
        'open the command palette in VS Code and run ' +
        '"Shell Command: Install \'code\' command in PATH", then try again.',
    );
    process.exit(installResult.status ?? 1);
  }
  console.log('✓ install\n');

  console.log(`Installed ${pkg.publisher}.${pkg.name}@${pkg.version}.`);
  console.log(
    'Reload your VS Code window ("Developer: Reload Window") to pick up the new build.',
  );
} finally {
  if (tmpDir) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}
