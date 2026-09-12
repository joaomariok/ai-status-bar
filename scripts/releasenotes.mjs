#!/usr/bin/env node
// CLI wrapper around the compiled src/shared/releaseNotes.ts, used by the
// release workflow to build a GitHub Release's notes from CHANGELOG.md.
// Requires `npm run compile` to have run first (out/shared/releaseNotes.js
// must exist) — the same precondition every other `out/`-dependent script
// in this repo has.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractReleaseNotes } from '../out/shared/releaseNotes.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function main() {
  const version = process.argv[2];
  if (!version) {
    console.error('Usage: node scripts/releasenotes.mjs <version>');
    process.exit(1);
  }

  const changelog = readFileSync(join(repoRoot, 'CHANGELOG.md'), 'utf8');
  try {
    console.log(extractReleaseNotes(changelog, version));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
