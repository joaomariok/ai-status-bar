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
  });
});

test('omits unavailable Claude usage windows and disabled credits', () => {
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
  });
});
