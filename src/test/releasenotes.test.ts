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

test('extractReleaseNotes matches a version containing regex metacharacters', () => {
  const changelog = `## 1.0.0+build[1] - 2026-01-01\n\n- Tagged build.\n\n## 0.9.0 - 2025-12-01\n\n- Earlier.\n`;
  const notes = extractReleaseNotes(changelog, '1.0.0+build[1]');
  assert.equal(notes, '- Tagged build.');
});

test('extractReleaseNotes does not treat a version with metacharacters as a pattern', () => {
  assert.throws(
    () => extractReleaseNotes(CHANGELOG, '1.1.0.*'),
    /No CHANGELOG\.md section found for version 1\.1\.0\.\*/,
  );
  assert.throws(() => extractReleaseNotes(CHANGELOG, '.*'), /No CHANGELOG\.md section found for version \.\*/);
});

test('extractReleaseNotes distinguishes a version from a longer near-miss heading', () => {
  const changelog = `## 1.1.01 - 2026-09-13\n\n- Different version.\n\n## 1.1.0 - 2026-09-12\n\n- Added a thing.\n`;
  const notes = extractReleaseNotes(changelog, '1.1.0');
  assert.equal(notes, '- Added a thing.');
});

test('extractReleaseNotes strips CRLF line endings from the section body', () => {
  const changelog = CHANGELOG.replace(/\n/g, '\r\n');
  const notes = extractReleaseNotes(changelog, '1.1.0');
  assert.equal(notes, '- Added a thing.\r\n- Added another thing.');
});
