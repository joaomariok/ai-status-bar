import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { after, afterEach, before, test } from 'node:test';
import { readCache, writeCache } from '../shared/cache';

interface Sample {
  greeting: string;
}

let dir: string;

before(async () => {
  dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ai-status-bar-cache-test-'));
});

after(async () => {
  await fs.promises.rm(dir, { recursive: true, force: true });
});

afterEach(async () => {
  for (const entry of await fs.promises.readdir(dir)) {
    await fs.promises.rm(path.join(dir, entry), { recursive: true, force: true });
  }
});

test('writeCache then readCache round-trips the value and stamp', async () => {
  const file = path.join(dir, 'roundtrip.json');
  await writeCache<Sample>(file, { stamp: 1234, value: { greeting: 'hi' } });

  const result = await readCache<Sample>(file);
  assert.ok(result);
  assert.equal(result?.stamp, 1234);
  assert.deepEqual(result?.value, { greeting: 'hi' });
});

test('writeCache creates missing parent directories', async () => {
  const file = path.join(dir, 'nested', 'deeper', 'cache.json');
  await writeCache<Sample>(file, { stamp: 1, value: { greeting: 'nested' } });

  const result = await readCache<Sample>(file);
  assert.deepEqual(result?.value, { greeting: 'nested' });
});

test('readCache returns undefined when the cache version does not match', async () => {
  const file = path.join(dir, 'stale-version.json');
  // Write a cache entry stamped with a future/incompatible version directly,
  // bypassing writeCache's own version stamping.
  await fs.promises.writeFile(
    file,
    JSON.stringify({ version: 999, stamp: 1, value: { greeting: 'stale' } }),
  );

  const result = await readCache<Sample>(file);
  assert.equal(result, undefined);
});

test('readCache returns undefined for malformed JSON', async () => {
  const file = path.join(dir, 'malformed.json');
  await fs.promises.writeFile(file, '{ not valid json');

  const result = await readCache<Sample>(file);
  assert.equal(result, undefined);
});

test('readCache returns undefined when the file does not exist', async () => {
  const result = await readCache<Sample>(path.join(dir, 'missing.json'));
  assert.equal(result, undefined);
});

test('writeCache does not throw when the target path is unwritable', async () => {
  // Use a path whose "directory" is actually a file, so mkdir/rename must fail.
  const blocker = path.join(dir, 'blocker');
  await fs.promises.writeFile(blocker, 'not a directory');
  const file = path.join(blocker, 'cache.json');

  await assert.doesNotReject(writeCache<Sample>(file, { stamp: 1, value: { greeting: 'x' } }));
});
