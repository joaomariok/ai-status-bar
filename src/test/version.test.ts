import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { test } from 'node:test';
import { getExtensionVersion } from '../shared/version';

test('getExtensionVersion reads the version from the extension manifest', () => {
  const manifestPath = path.join(__dirname, '..', '..', 'package.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { version: string };

  const version = getExtensionVersion();

  assert.equal(version, manifest.version);
  assert.notEqual(version, '0.0.0');
});
