#!/usr/bin/env node
// Local pre-submit validation: the closest equivalent to CI in this
// repository (there is no CI workflow). Runs typecheck -> tests -> a
// packaging dry-run, stopping at the first failure.
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
// npm/npx ship as .cmd shims on Windows, which node's spawn cannot exec
// directly without a shell (EINVAL) — shell: true is required here. The
// commands and arguments below are fixed by this script, not user input.
const useShell = process.platform === 'win32';
const npmCmd = 'npm';
const npxCmd = 'npx';

const steps = [
  { name: 'typecheck', command: npmCmd, args: ['run', 'typecheck'] },
  { name: 'test', command: npmCmd, args: ['test'] },
  { name: 'package dry-run', command: npxCmd, args: ['vsce', 'ls'] },
];

console.log('Running gate...\n');

for (const step of steps) {
  console.log(`> ${step.name}`);
  // Passing a single pre-joined string (rather than shell:true + an args
  // array) avoids Node's shell-argument-escaping deprecation warning; safe
  // here since every argument is a fixed literal, never user input.
  const result = useShell
    ? spawnSync([step.command, ...step.args].join(' '), { cwd: repoRoot, stdio: 'inherit', shell: true })
    : spawnSync(step.command, step.args, { cwd: repoRoot, stdio: 'inherit' });

  if (result.error || result.status !== 0) {
    console.error(`\nGate failed at step: ${step.name}`);
    process.exit(result.status ?? 1);
  }

  console.log(`✓ ${step.name}\n`);
}

console.log('Gate passed.');
