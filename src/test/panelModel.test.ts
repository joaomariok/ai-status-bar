import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPanelModel } from '../shared/panelModel';
import { AgentSettings, AgentSnapshot } from '../shared/types';

function settings(overrides: Partial<AgentSettings> = {}): AgentSettings {
  return {
    pollMs: 120_000,
    cells: 3,
    showWeekly: true,
    replacePrimaryWithWeeklyOnLimit: true,
    cautionAt: 70,
    warnAt: 90,
    locale: 'en-US',
    presentationMode: 'agentDefault',
    statusBarStyle: 'full',
    agentNameStyle: 'both',
    ...overrides,
  };
}

function snapshot(overrides: Partial<AgentSnapshot> = {}): AgentSnapshot {
  return {
    providerId: 'claude',
    label: 'Claude',
    tooltipTitle: 'Claude Code',
    icon: 'ai-status-bar-claude',
    defaultPresentationMode: 'used',
    state: 'ok',
    ...overrides,
  };
}

test('a disabled snapshot renders no windows and a disabled message', () => {
  const model = buildPanelModel([snapshot({ state: 'disabled' })], settings());
  const [entry] = model.agents;
  assert.equal(entry.windows.length, 0);
  assert.equal(entry.credits, undefined);
  assert.equal(entry.message, 'Disabled');
});

test('an unavailable snapshot surfaces the detection reason as the message', () => {
  const model = buildPanelModel(
    [snapshot({ state: 'unavailable', note: 'no Claude credentials found' })],
    settings(),
  );
  assert.equal(model.agents[0].message, 'no Claude credentials found');
});

test('an ok snapshot with no usage yet shows a fetching message', () => {
  const model = buildPanelModel(
    [snapshot({ state: 'ok', usage: undefined })],
    settings(),
  );
  assert.equal(model.agents[0].message, 'Fetching Claude usage...');
});

test('an ok snapshot with a note but no usage yet surfaces the note as the message', () => {
  const model = buildPanelModel(
    [
      snapshot({
        state: 'ok',
        usage: undefined,
        note: 'fetch failed (timeout)',
      }),
    ],
    settings(),
  );
  assert.equal(model.agents[0].message, 'fetch failed (timeout)');
});

test('renders both windows with used percentages in the agent default (used) mode', () => {
  const model = buildPanelModel(
    [
      snapshot({
        usage: {
          fiveHour: { usedPercent: 42, resetsAt: '2024-03-15T14:30:00.000Z' },
          weekly: { usedPercent: 67, resetsAt: '2024-03-18T09:00:00.000Z' },
        },
        updatedAt: new Date('2024-03-15T10:00:00.000Z'),
      }),
    ],
    settings(),
  );
  const [entry] = model.agents;
  assert.equal(entry.windows.length, 2);
  assert.equal(entry.windows[0].label, '5-hour');
  assert.equal(entry.windows[0].pctText, '42%');
  assert.equal(entry.windows[0].displayPercent, 42);
  assert.equal(entry.windows[0].severityLevel, 'ok');
  assert.equal(entry.windows[1].label, 'Weekly');
  assert.equal(entry.windows[1].pctText, '67%');
});

test('inverts percentages to remaining when the setting forces remaining mode', () => {
  const model = buildPanelModel(
    [snapshot({ usage: { fiveHour: { usedPercent: 30 } } })],
    settings({ presentationMode: 'remaining' }),
  );
  assert.equal(model.agents[0].windows[0].pctText, '70%');
  assert.equal(model.agents[0].windows[0].displayPercent, 70);
});

test('agentDefault presentation mode falls back to the snapshot default', () => {
  const model = buildPanelModel(
    [
      snapshot({
        defaultPresentationMode: 'remaining',
        usage: { fiveHour: { usedPercent: 30 } },
      }),
    ],
    settings({ presentationMode: 'agentDefault' }),
  );
  assert.equal(model.agents[0].windows[0].pctText, '70%');
});

test('window severity reflects the caution/warn thresholds', () => {
  const model = buildPanelModel(
    [snapshot({ usage: { fiveHour: { usedPercent: 95 } } })],
    settings({ cautionAt: 70, warnAt: 90 }),
  );
  assert.equal(model.agents[0].windows[0].severityLevel, 'warn');
});

test('an undefined resetsAt renders an empty reset text', () => {
  const model = buildPanelModel(
    [snapshot({ usage: { fiveHour: { usedPercent: 10 } } })],
    settings(),
  );
  assert.equal(model.agents[0].windows[0].resetText, '');
});

test('window labels and reset-with-date overrides from the provider are honored', () => {
  const model = buildPanelModel(
    [
      snapshot({
        windowLabels: {
          fiveHourTooltip: 'Daily',
          weeklyTooltip: 'Monthly',
          fiveHourResetWithDate: true,
        },
        usage: {
          fiveHour: { usedPercent: 10, resetsAt: '2024-03-15T14:30:00.000Z' },
          weekly: { usedPercent: 20 },
        },
      }),
    ],
    settings(),
  );
  assert.equal(model.agents[0].windows[0].label, 'Daily');
  assert.equal(model.agents[0].windows[1].label, 'Monthly');
  assert.match(model.agents[0].windows[0].resetText, /Mar/);
});

test('limitReached is surfaced from usage', () => {
  const model = buildPanelModel(
    [
      snapshot({
        usage: { fiveHour: { usedPercent: 100 }, limitReached: true },
      }),
    ],
    settings(),
  );
  assert.equal(model.agents[0].limitReached, true);
});

test('plan is surfaced from usage', () => {
  const model = buildPanelModel(
    [snapshot({ usage: { fiveHour: { usedPercent: 10 }, plan: 'Max 20x' } })],
    settings(),
  );
  assert.equal(model.agents[0].plan, 'Max 20x');
});

test('credits with a text field render as a text credits entry', () => {
  const model = buildPanelModel(
    [
      snapshot({
        usage: {
          fiveHour: { usedPercent: 10 },
          credits: { text: 'available' },
        },
      }),
    ],
    settings(),
  );
  assert.deepEqual(model.agents[0].credits, {
    kind: 'text',
    text: 'available',
  });
});

test('credits with used/limit/currency/decimals render as a gauge credits entry', () => {
  const model = buildPanelModel(
    [
      snapshot({
        usage: {
          fiveHour: { usedPercent: 10 },
          credits: {
            used: 1240,
            limit: 5000,
            currency: 'USD',
            decimals: 2,
            usedPercent: 24.8,
          },
        },
      }),
    ],
    settings(),
  );
  assert.deepEqual(model.agents[0].credits, {
    kind: 'gauge',
    pctText: '25%',
    displayPercent: 24.8,
    severityLevel: 'ok',
    amountText: '$12.40 / $50.00',
  });
});

test('credits missing required gauge fields and no text render as no credits', () => {
  const model = buildPanelModel(
    [
      snapshot({
        usage: { fiveHour: { usedPercent: 10 }, credits: { used: 100 } },
      }),
    ],
    settings(),
  );
  assert.equal(model.agents[0].credits, undefined);
});

test('footer is an "updated" kind when there is no note', () => {
  const model = buildPanelModel(
    [
      snapshot({
        usage: { fiveHour: { usedPercent: 10 } },
        updatedAt: new Date('2024-03-15T14:02:00.000Z'),
      }),
    ],
    settings(),
  );
  assert.equal(model.agents[0].footer?.kind, 'updated');
});

test('footer is a "note" kind carrying the note text when a note is present', () => {
  const model = buildPanelModel(
    [
      snapshot({
        usage: { fiveHour: { usedPercent: 10 } },
        updatedAt: new Date('2024-03-15T14:02:00.000Z'),
        note: 'rate limited (HTTP 429)',
      }),
    ],
    settings(),
  );
  const footer = model.agents[0].footer;
  assert.equal(footer?.kind, 'note');
  if (footer?.kind === 'note') {
    assert.equal(footer.noteText, 'rate limited (HTTP 429)');
    // Time text is locale/timezone-dependent; just confirm it looks like a clock time.
    assert.match(footer.timeText, /\d{1,2}:\d{2}/);
  }
});

test('the provider icon id is carried onto the entry for an ok agent', () => {
  const model = buildPanelModel(
    [
      snapshot({
        icon: 'ai-status-bar-claude',
        usage: { fiveHour: { usedPercent: 10 } },
      }),
    ],
    settings(),
  );
  assert.equal(model.agents[0].icon, 'ai-status-bar-claude');
});

test('the provider icon id is carried onto the entry even for a disabled agent', () => {
  const model = buildPanelModel(
    [snapshot({ icon: 'ai-status-bar-codex', state: 'disabled' })],
    settings(),
  );
  assert.equal(model.agents[0].icon, 'ai-status-bar-codex');
});

test('agent order in the model matches the order of the input snapshots', () => {
  const model = buildPanelModel(
    [
      snapshot({ providerId: 'codex', label: 'Codex' }),
      snapshot({ providerId: 'claude', label: 'Claude' }),
    ],
    settings(),
  );
  assert.deepEqual(
    model.agents.map((a) => a.providerId),
    ['codex', 'claude'],
  );
});
