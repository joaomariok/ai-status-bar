import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { UsageStore } from '../shared/usageStore';
import { AgentSnapshot } from '../shared/types';

function snapshot(
  providerId: string,
  overrides: Partial<AgentSnapshot> = {},
): AgentSnapshot {
  return {
    providerId,
    label: providerId,
    tooltipTitle: providerId,
    icon: providerId,
    defaultPresentationMode: 'used',
    state: 'ok',
    ...overrides,
  };
}

test('snapshots returns an empty array before anything is set', () => {
  const store = new UsageStore();
  assert.deepEqual(store.snapshots(), []);
});

test('set stores a snapshot retrievable via snapshots', () => {
  const store = new UsageStore();
  store.set(snapshot('codex'));
  assert.deepEqual(store.snapshots(), [snapshot('codex')]);
});

test('set overwrites a prior snapshot for the same providerId', () => {
  const store = new UsageStore();
  store.set(snapshot('codex', { label: 'Codex' }));
  store.set(snapshot('codex', { label: 'Codex Updated' }));
  const result = store.snapshots();
  assert.equal(result.length, 1);
  assert.equal(result[0].label, 'Codex Updated');
});

test('snapshots preserves first-insertion order across providers', () => {
  const store = new UsageStore();
  store.set(snapshot('codex'));
  store.set(snapshot('claude'));
  store.set(snapshot('codex', { label: 'Codex Updated' }));
  assert.deepEqual(
    store.snapshots().map((s) => s.providerId),
    ['codex', 'claude'],
  );
});

test('onChange listeners are called with the full snapshot list after a set', () => {
  const store = new UsageStore();
  const seen: AgentSnapshot[][] = [];
  store.onChange((snapshots) => seen.push(snapshots));

  store.set(snapshot('codex'));

  assert.equal(seen.length, 1);
  assert.deepEqual(
    seen[0].map((s) => s.providerId),
    ['codex'],
  );
});

test('onChange returns an unsubscribe function that stops further notifications', () => {
  const store = new UsageStore();
  let calls = 0;
  const unsubscribe = store.onChange(() => {
    calls += 1;
  });

  store.set(snapshot('codex'));
  unsubscribe();
  store.set(snapshot('claude'));

  assert.equal(calls, 1);
});

test('multiple listeners are all notified independently', () => {
  const store = new UsageStore();
  let a = 0;
  let b = 0;
  store.onChange(() => {
    a += 1;
  });
  store.onChange(() => {
    b += 1;
  });

  store.set(snapshot('codex'));

  assert.equal(a, 1);
  assert.equal(b, 1);
});
