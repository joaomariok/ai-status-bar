import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeCodexUsage } from '../agents/codexUsage';
import {
  buildStatusBarParts,
  StatusBarPartsInput,
} from '../shared/statusBarParts';

const statusSettings: StatusBarPartsInput['settings'] = {
  cells: 3,
  showWeekly: true,
  replacePrimaryWithWeeklyOnLimit: true,
  cautionAt: 70,
  warnAt: 90,
  statusBarStyle: 'full',
};

test('uses a red truncated credit fallback after a Codex limit is reached', () => {
  assert.deepEqual(
    normalizeCodexUsage({
      limitId: null,
      limitName: null,
      primary: {
        usedPercent: 100,
        windowDurationMins: 300,
        resetsAt: 1_789_000_000,
      },
      secondary: {
        usedPercent: 20,
        windowDurationMins: 10_080,
        resetsAt: 1_789_500_000,
      },
      credits: { hasCredits: true, unlimited: false, balance: '$12.3456' },
      planType: 'pro',
      rateLimitReachedType: 'primary',
    }),
    {
      plan: 'pro',
      fiveHour: { usedPercent: 100, resetsAt: 1_789_000_000 },
      weekly: { usedPercent: 20, resetsAt: 1_789_500_000 },
      credits: { text: '$12.3456' },
      limitReached: true,
      statusBarFallback: {
        kind: 'text',
        label: 'Cr',
        text: '$12.34',
        severityOverride: 'warn',
      },
    },
  );
});

for (const [name, credits, text] of [
  [
    'available',
    { hasCredits: true, unlimited: false, balance: null },
    'available',
  ],
  [
    'unlimited',
    { hasCredits: false, unlimited: true, balance: null },
    'unlimited',
  ],
] as const) {
  test(`uses a neutral ${name} fallback for credit-only Codex usage`, () => {
    assert.deepEqual(
      normalizeCodexUsage({
        limitId: null,
        limitName: null,
        primary: null,
        secondary: null,
        credits,
        planType: null,
        rateLimitReachedType: null,
      }),
      {
        plan: undefined,
        fiveHour: undefined,
        weekly: undefined,
        credits: { text },
        limitReached: false,
        statusBarFallback: { kind: 'text', label: 'Cr', text },
      },
    );
  });
}

test('uses a neutral numeric balance fallback for credit-only Codex usage', () => {
  const usage = normalizeCodexUsage({
    limitId: null,
    limitName: null,
    primary: null,
    secondary: null,
    credits: { hasCredits: true, unlimited: false, balance: '$12.50' },
    planType: null,
    rateLimitReachedType: null,
  });

  assert.deepEqual(usage.statusBarFallback, {
    kind: 'text',
    label: 'Cr',
    text: '$12.50',
  });
});

for (const [name, credits, text] of [
  [
    'available',
    { hasCredits: true, unlimited: false, balance: null },
    'available',
  ],
  [
    'unlimited',
    { hasCredits: false, unlimited: true, balance: null },
    'unlimited',
  ],
] as const) {
  test(`uses a red ${name} fallback after a Codex limit is reached`, () => {
    const usage = normalizeCodexUsage({
      limitId: null,
      limitName: null,
      primary: { usedPercent: 100, windowDurationMins: 300, resetsAt: null },
      secondary: null,
      credits,
      planType: null,
      rateLimitReachedType: 'primary',
    });

    assert.deepEqual(usage.statusBarFallback, {
      kind: 'text',
      label: 'Cr',
      text,
      severityOverride: 'warn',
    });
  });
}

for (const [name, credits, text] of [
  ['none', { hasCredits: false, unlimited: false, balance: null }, 'none'],
  ['empty', { hasCredits: true, unlimited: false, balance: '' }, ''],
] as const) {
  test(`does not create a Codex credit fallback for ${name} credit text`, () => {
    assert.deepEqual(
      normalizeCodexUsage({
        limitId: null,
        limitName: null,
        primary: null,
        secondary: null,
        credits,
        planType: null,
        rateLimitReachedType: null,
      }),
      {
        plan: undefined,
        fiveHour: undefined,
        weekly: undefined,
        credits: { text },
        limitReached: false,
      },
    );
  });
}

test('keeps Codex windows when usable credits are not a fallback condition', () => {
  assert.deepEqual(
    normalizeCodexUsage({
      limitId: null,
      limitName: null,
      primary: { usedPercent: 25, windowDurationMins: 300, resetsAt: null },
      secondary: null,
      credits: { hasCredits: true, unlimited: false, balance: '$2.50' },
      planType: null,
      rateLimitReachedType: null,
    }),
    {
      plan: undefined,
      fiveHour: { usedPercent: 25, resetsAt: null },
      weekly: undefined,
      credits: { text: '$2.50' },
      limitReached: false,
    },
  );
});

for (const [name, credits] of [
  ['none', { hasCredits: false, unlimited: false, balance: null }],
  ['empty', { hasCredits: true, unlimited: false, balance: '' }],
  ['whitespace', { hasCredits: true, unlimited: false, balance: '  ' }],
  [
    'case-insensitive none',
    { hasCredits: true, unlimited: false, balance: 'NONE' },
  ],
  ['absent', null],
] as const) {
  test(`keeps Codex windows after a reached limit with ${name} credits`, () => {
    const usage = normalizeCodexUsage({
      limitId: null,
      limitName: null,
      primary: { usedPercent: 25, windowDurationMins: 300, resetsAt: null },
      secondary: {
        usedPercent: 60,
        windowDurationMins: 10_080,
        resetsAt: null,
      },
      credits,
      planType: null,
      rateLimitReachedType: 'primary',
    });

    assert.equal(usage.statusBarFallback, undefined);
    assert.deepEqual(
      buildStatusBarParts({
        usage,
        mode: 'remaining',
        settings: statusSettings,
      }),
      ['🟢 5h ▰▰▱ 75%', '🟢 7d ▰▱▱ 40%'],
    );
  });
}
