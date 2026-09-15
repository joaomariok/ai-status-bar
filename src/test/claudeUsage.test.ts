import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeClaudeUsage } from '../agents/claudeUsage';

test('maps Claude usage windows and plan from a complete payload', () => {
  const usage = normalizeClaudeUsage(
    {
      five_hour: { utilization: 25, resets_at: '2026-09-13T01:00:00Z' },
      seven_day: { utilization: 60, resets_at: '2026-09-18T01:00:00Z' },
    },
    'pro (tier_2)',
  );

  assert.deepEqual(usage, {
    plan: 'pro (tier_2)',
    fiveHour: {
      usedPercent: 25,
      resetsAt: '2026-09-13T01:00:00Z',
    },
    weekly: {
      usedPercent: 60,
      resetsAt: '2026-09-18T01:00:00Z',
    },
    credits: undefined,
  });
});

test('maps enabled Claude extra usage and applies display defaults', () => {
  const usage = normalizeClaudeUsage(
    {
      extra_usage: {
        is_enabled: true,
        monthly_limit: 100,
      },
    },
    undefined,
  );

  assert.deepEqual(usage, {
    plan: undefined,
    fiveHour: undefined,
    weekly: undefined,
    credits: {
      usedPercent: 0,
      used: 0,
      limit: 100,
      currency: 'USD',
      decimals: 2,
    },
    statusBarFallback: {
      kind: 'gauge',
      label: 'Cr',
      usedPercent: 0,
    },
  });
});

test('uses a label-only fallback for credit-only Claude usage without a usable percentage', () => {
  const usage = normalizeClaudeUsage(
    {
      five_hour: { resets_at: '2026-09-13T01:00:00Z' },
      seven_day: {},
      extra_usage: { is_enabled: false, monthly_limit: 100 },
    },
    undefined,
  );

  assert.deepEqual(usage, {
    plan: undefined,
    fiveHour: undefined,
    weekly: undefined,
    credits: undefined,
    statusBarFallback: { kind: 'labelOnly' },
  });
});

test('uses a red credits fallback when a Claude usage window is exhausted', () => {
  const usage = normalizeClaudeUsage(
    {
      five_hour: { utilization: 100 },
      seven_day: { utilization: 20 },
      extra_usage: {
        is_enabled: true,
        utilization: 35,
        monthly_limit: 100,
      },
    },
    undefined,
  );

  assert.deepEqual(usage.statusBarFallback, {
    kind: 'gauge',
    label: 'Cr',
    usedPercent: 35,
    severityOverride: 'warn',
  });
});

test('uses a red credits fallback when Claude weekly usage is exhausted', () => {
  const usage = normalizeClaudeUsage(
    {
      five_hour: { utilization: 20 },
      seven_day: { utilization: 100 },
      extra_usage: {
        is_enabled: true,
        utilization: 35,
        monthly_limit: 100,
      },
    },
    undefined,
  );

  assert.deepEqual(usage.statusBarFallback, {
    kind: 'gauge',
    label: 'Cr',
    usedPercent: 35,
    severityOverride: 'warn',
  });
});

test('keeps Claude windows when credits are available but no window is exhausted', () => {
  const usage = normalizeClaudeUsage(
    {
      five_hour: { utilization: 25 },
      seven_day: { utilization: 60 },
      extra_usage: {
        is_enabled: true,
        utilization: 35,
        monthly_limit: 100,
      },
    },
    undefined,
  );

  assert.equal(usage.statusBarFallback, undefined);
});

test('does not trigger the Claude credit fallback below the exhausted threshold', () => {
  const usage = normalizeClaudeUsage(
    {
      five_hour: { utilization: 99.99 },
      extra_usage: {
        is_enabled: true,
        utilization: 35,
        monthly_limit: 100,
      },
    },
    undefined,
  );

  assert.equal(usage.statusBarFallback, undefined);
});

for (const [name, utilization] of [
  ['NaN', Number.NaN],
  ['Infinity', Infinity],
  ['negative Infinity', -Infinity],
] as const) {
  test(`uses a label-only fallback for credit-only Claude usage with ${name} credits`, () => {
    const usage = normalizeClaudeUsage(
      {
        extra_usage: {
          is_enabled: true,
          utilization,
          monthly_limit: 100,
        },
      },
      undefined,
    );

    assert.deepEqual(usage.statusBarFallback, { kind: 'labelOnly' });
  });
}
