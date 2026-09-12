import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  agentPrefix,
  clampPercent,
  dot,
  escapeMarkdown,
  formatReset,
  meter,
  money,
  pctShort,
  presentationPercent,
  remaining,
  statusPart,
} from '../shared/format';

test('clampPercent clamps to [0, 100]', () => {
  assert.equal(clampPercent(-5), 0);
  assert.equal(clampPercent(150), 100);
  assert.equal(clampPercent(42), 42);
});

test('pctShort formats or falls back to a dash', () => {
  assert.equal(pctShort(undefined), '-');
  assert.equal(pctShort(12.4), '12%');
  assert.equal(pctShort(12.6), '13%');
});

test('meter renders undefined as fully empty', () => {
  assert.equal(meter(undefined, 5), '▱▱▱▱▱');
});

test('meter rounds filled cells to the nearest integer', () => {
  assert.equal(meter(0, 4), '▱▱▱▱');
  assert.equal(meter(100, 4), '▰▰▰▰');
  assert.equal(meter(50, 4), '▰▰▱▱');
  // 60% of 3 cells = 1.8, rounds to 2 filled.
  assert.equal(meter(60, 3), '▰▰▱');
});

test('meter clamps out-of-range values before computing fill', () => {
  assert.equal(meter(-20, 4), '▱▱▱▱');
  assert.equal(meter(140, 4), '▰▰▰▰');
});

test('meter supports custom fill/empty glyphs', () => {
  assert.equal(meter(50, 4, '#', '.'), '##..');
});

test('remaining inverts used percent, undefined stays undefined', () => {
  assert.equal(remaining(undefined), undefined);
  assert.equal(remaining(30), 70);
  assert.equal(remaining(120), 0);
});

test('presentationPercent switches between used and remaining', () => {
  assert.equal(presentationPercent(30, 'used'), 30);
  assert.equal(presentationPercent(30, 'remaining'), 70);
  assert.equal(presentationPercent(undefined, 'remaining'), undefined);
});

test('dot reflects caution/warn thresholds', () => {
  assert.equal(dot(undefined), '○');
  assert.equal(dot(10, 70, 90), '🟢');
  assert.equal(dot(70, 70, 90), '🟡');
  assert.equal(dot(89.9, 70, 90), '🟡');
  assert.equal(dot(90, 70, 90), '🔴');
  assert.equal(dot(100, 70, 90), '🔴');
});

test('formatReset returns empty string for null/undefined/empty/invalid input', () => {
  assert.equal(formatReset(undefined, undefined, false), '');
  assert.equal(formatReset(null, undefined, false), '');
  assert.equal(formatReset('', undefined, false), '');
  assert.equal(formatReset('not-a-date', undefined, false), '');
});

test('formatReset treats a numeric value as epoch seconds, not milliseconds', () => {
  // 1700000000 seconds -> a date in 2023; as milliseconds it would be in 1970.
  const withoutDate = formatReset(1700000000, 'en-US', false);
  const withDate = formatReset(1700000000, 'en-US', true);
  assert.match(withoutDate, /\d{1,2}:\d{2}\s?(AM|PM)/i);
  assert.match(withDate, /[A-Za-z]{3}\s+\d{1,2}/);
});

test('formatReset formats an ISO string with the date flag', () => {
  const result = formatReset('2024-03-15T10:00:00.000Z', 'en-US', true);
  assert.match(result, /Mar/);
});

test('money converts minor units using the given decimals and known currency symbols', () => {
  assert.equal(money(1234, 'USD', 2), '$12.34');
  assert.equal(money(500, 'EUR', 2), '€5.00');
  assert.equal(money(100, 'GBP', 2), '£1.00');
});

test('money falls back to the currency code with a trailing space when unknown', () => {
  assert.equal(money(1000, 'JPY', 0), 'JPY 1000');
});

test('statusPart renders a gauge and percentage in full style', () => {
  assert.equal(
    statusPart('5h', 34, { style: 'full', mode: 'used', cells: 3, cautionAt: 70, warnAt: 90 }),
    '🟢 5h ▰▱▱ 34%',
  );
});

test('statusPart renders label and percentage without a gauge in compact style', () => {
  assert.equal(
    statusPart('5h', 34, { style: 'compact', mode: 'used', cells: 3, cautionAt: 70, warnAt: 90 }),
    '🟢 5h: 34%',
  );
});

test('statusPart compact style ignores the cells count', () => {
  const withFewCells = statusPart('5h', 34, { style: 'compact', mode: 'used', cells: 3, cautionAt: 70, warnAt: 90 });
  const withManyCells = statusPart('5h', 34, { style: 'compact', mode: 'used', cells: 10, cautionAt: 70, warnAt: 90 });
  assert.equal(withFewCells, withManyCells);
});

test('statusPart handles an undefined used percent in both styles', () => {
  assert.equal(
    statusPart('5h', undefined, { style: 'full', mode: 'used', cells: 3, cautionAt: 70, warnAt: 90 }),
    '○ 5h ▱▱▱ -',
  );
  assert.equal(
    statusPart('5h', undefined, { style: 'compact', mode: 'used', cells: 3, cautionAt: 70, warnAt: 90 }),
    '○ 5h: -',
  );
});

test('statusPart inverts the percentage in remaining mode for both styles', () => {
  assert.equal(
    statusPart('5h', 34, { style: 'full', mode: 'remaining', cells: 3, cautionAt: 70, warnAt: 90 }),
    '🟢 5h ▰▰▱ 66%',
  );
  assert.equal(
    statusPart('5h', 34, { style: 'compact', mode: 'remaining', cells: 3, cautionAt: 70, warnAt: 90 }),
    '🟢 5h: 66%',
  );
});

test('statusPart applies warn threshold dot in compact style', () => {
  assert.equal(
    statusPart('5h', 95, { style: 'compact', mode: 'used', cells: 3, cautionAt: 70, warnAt: 90 }),
    '🔴 5h: 95%',
  );
});

test('agentPrefix renders the name alone in text style', () => {
  assert.equal(agentPrefix('Claude', 'ai-status-bar-claude', 'text'), 'Claude: ');
});

test('agentPrefix renders the icon alone in icon style, dot-separated like the usage windows', () => {
  assert.equal(agentPrefix('Claude', 'ai-status-bar-claude', 'icon'), '$(ai-status-bar-claude) · ');
});

test('agentPrefix renders the icon and the name in both style', () => {
  assert.equal(agentPrefix('Claude', 'ai-status-bar-claude', 'both'), '$(ai-status-bar-claude) Claude: ');
});

test('escapeMarkdown escapes markdown-significant characters', () => {
  assert.equal(escapeMarkdown(undefined), '');
  assert.equal(escapeMarkdown(''), '');
  assert.equal(escapeMarkdown('plain text'), 'plain text');
  assert.equal(escapeMarkdown('*bold* and _italic_'), '\\*bold\\* and \\_italic\\_');
  assert.equal(escapeMarkdown('[link](url)'), '\\[link\\]\\(url\\)');
});
