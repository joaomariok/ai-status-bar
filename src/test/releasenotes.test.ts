import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractReleaseNotes } from '../shared/releaseNotes';

const CHANGELOG = `# Changelog

## 1.1.0 - 2026-09-12

- Added a thing.
- Added another thing.

## 1.0.0 - 2026-06-20

- Renamed the extension.
- Added initial monitoring.
`;

test('extractReleaseNotes returns a middle section up to the next heading', () => {
  const notes = extractReleaseNotes(CHANGELOG, '1.1.0');
  assert.equal(notes, '- Added a thing.\n- Added another thing.');
});

test('extractReleaseNotes returns the last section through EOF', () => {
  const notes = extractReleaseNotes(CHANGELOG, '1.0.0');
  assert.equal(notes, '- Renamed the extension.\n- Added initial monitoring.');
});

test('extractReleaseNotes throws for an unknown version', () => {
  assert.throws(() => extractReleaseNotes(CHANGELOG, '9.9.9'), /No CHANGELOG\.md section found for version 9\.9\.9/);
});
