import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { test } from 'node:test';
import { findCommandOnPath } from '../agents/codexCommand';
import { detectCodexAvailability } from '../agents/codexDetection';

test('reports a resolved Codex executable as available', () => {
  assert.deepEqual(detectCodexAvailability('C:/tools/codex.exe'), {
    available: true,
  });
});

test('reports a missing Codex executable as unavailable', () => {
  assert.deepEqual(detectCodexAvailability(undefined), {
    available: false,
    reason: 'Codex executable not found',
  });
});

test('rejects Windows command shims during Codex detection', () => {
  assert.deepEqual(detectCodexAvailability('C:/tools/codex.cmd', 'win32'), {
    available: false,
    reason: 'codex.command must point to codex.exe, not a .cmd/.bat shim',
  });
});

test('finds the default Codex command on PATH and ignores an absent command', async () => {
  const directory = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), 'ai-status-bar-codex-'),
  );
  const executable = path.join(
    directory,
    process.platform === 'win32' ? 'codex.exe' : 'codex',
  );
  await fs.promises.writeFile(executable, '');
  if (process.platform !== 'win32') {
    await fs.promises.chmod(executable, 0o755);
  }

  try {
    assert.equal(await findCommandOnPath('codex', directory), executable);
    assert.equal(await findCommandOnPath('not-codex', directory), undefined);
  } finally {
    await fs.promises.rm(directory, { recursive: true, force: true });
  }
});

test('does not resolve a Windows command shim from PATH', async () => {
  const directory = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), 'ai-status-bar-codex-'),
  );
  const shim = path.join(directory, 'codex.cmd');
  await fs.promises.writeFile(shim, '');

  try {
    assert.equal(
      await findCommandOnPath('codex.cmd', directory, 'win32'),
      undefined,
    );
  } finally {
    await fs.promises.rm(directory, { recursive: true, force: true });
  }
});

test('does not resolve a directory from PATH', async () => {
  const directory = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), 'ai-status-bar-codex-'),
  );
  await fs.promises.mkdir(path.join(directory, 'codex'));

  try {
    assert.equal(
      await findCommandOnPath('codex', directory, 'linux'),
      undefined,
    );
  } finally {
    await fs.promises.rm(directory, { recursive: true, force: true });
  }
});
