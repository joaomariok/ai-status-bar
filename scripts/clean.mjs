#!/usr/bin/env node
// Cross-platform replacement for `rm -rf out *.vsix` that works on Windows
// PowerShell without extra dependencies (no rimraf).
import { readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const targets = [join(repoRoot, 'out')];
for (const entry of readdirSync(repoRoot)) {
  if (entry.endsWith('.vsix')) targets.push(join(repoRoot, entry));
}

for (const target of targets) {
  rmSync(target, { recursive: true, force: true });
  console.log(`removed ${target}`);
}
