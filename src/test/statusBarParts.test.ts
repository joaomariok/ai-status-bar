import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildStatusBarParts,
  StatusBarPartsInput,
} from '../shared/statusBarParts';
import { AgentUsage } from '../shared/types';

const settings: StatusBarPartsInput['settings'] = {
  cells: 3,
  showWeekly: true,
  replacePrimaryWithWeeklyOnLimit: true,
  cautionAt: 70,
  warnAt: 90,
  statusBarStyle: 'full' as const,
};

function parts(
  usage: AgentUsage,
  mode: 'used' | 'remaining' = 'used',
  settingsOverrides: Partial<StatusBarPartsInput['settings']> = {},
) {
  return buildStatusBarParts({
    usage,
    mode,
    settings: { ...settings, ...settingsOverrides },
  });
}

test('renders a supplied numeric-gauge fallback generically', () => {
  assert.deepEqual(
    parts({
      fiveHour: { usedPercent: 100 },
      weekly: { usedPercent: 100 },
      statusBarFallback: {
        kind: 'gauge',
        label: 'Credits',
        usedPercent: 35,
        severityOverride: 'warn',
      },
    } as AgentUsage),
    ['🔴 Credits ▰▱▱ 35%'],
  );
});

test('renders a supplied textual fallback generically', () => {
  assert.deepEqual(
    parts(
      {
        fiveHour: { usedPercent: 100 },
        weekly: { usedPercent: 100 },
        statusBarFallback: {
          kind: 'text',
          label: 'Cr',
          text: '$12.34',
        },
      },
      'remaining',
    ),
    ['○ Cr: $12.34'],
  );
});

test('suppresses empty-window placeholders for a label-only fallback', () => {
  assert.deepEqual(
    parts({
      fiveHour: { usedPercent: 100 },
      weekly: { usedPercent: 100 },
      statusBarFallback: { kind: 'labelOnly' },
    }),
    [],
  );
});

test('renders a gauge fallback in compact remaining mode', () => {
  assert.deepEqual(
    parts(
      {
        statusBarFallback: {
          kind: 'gauge',
          label: 'Credits',
          usedPercent: 35,
          severityOverride: 'warn',
        },
      },
      'remaining',
      { statusBarStyle: 'compact' },
    ),
    ['🔴 Credits: 65%'],
  );
});

test('renders a forced warning for a textual fallback', () => {
  assert.deepEqual(
    parts({
      statusBarFallback: {
        kind: 'text',
        label: 'Cr',
        text: 'available',
        severityOverride: 'warn',
      },
    }),
    ['🔴 Cr: available'],
  );
});

test('renders normal windows when no fallback descriptor is supplied', () => {
  assert.deepEqual(
    parts({
      fiveHour: { usedPercent: 25 },
      weekly: { usedPercent: 60 },
      credits: { usedPercent: 35 },
    }),
    ['🟢 5h ▰▱▱ 25%', '🟢 7d ▰▰▱ 60%'],
  );
});

test('keeps weekly replacement behavior when no fallback descriptor is supplied', () => {
  assert.deepEqual(
    parts({
      fiveHour: { usedPercent: 100 },
      weekly: { usedPercent: 100 },
    }),
    ['🔴 7d ▰▰▰ 100%'],
  );
});

test('omits the weekly window when it is disabled', () => {
  assert.deepEqual(
    parts(
      {
        fiveHour: { usedPercent: 25 },
        weekly: { usedPercent: 60 },
      },
      'used',
      { showWeekly: false },
    ),
    ['🟢 5h ▰▱▱ 25%'],
  );
});

test('replaces the primary window with an exhausted weekly window even when weekly display is disabled', () => {
  assert.deepEqual(
    parts(
      {
        fiveHour: { usedPercent: 25 },
        weekly: { usedPercent: 100 },
      },
      'used',
      { showWeekly: false },
    ),
    ['🔴 7d ▰▰▰ 100%'],
  );
});

test('keeps both windows when weekly replacement is disabled', () => {
  assert.deepEqual(
    parts(
      {
        fiveHour: { usedPercent: 25 },
        weekly: { usedPercent: 100 },
      },
      'used',
      { replacePrimaryWithWeeklyOnLimit: false },
    ),
    ['🟢 5h ▰▱▱ 25%', '🔴 7d ▰▰▰ 100%'],
  );
});
