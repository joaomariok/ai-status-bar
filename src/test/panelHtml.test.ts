import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderPanelHtml } from '../shared/panelHtml';
import { AgentPanelEntry, PanelModel } from '../shared/panelModel';

function entry(overrides: Partial<AgentPanelEntry> = {}): AgentPanelEntry {
  return {
    providerId: 'claude',
    label: 'Claude',
    tooltipTitle: 'Claude Code',
    icon: 'ai-status-bar-claude',
    state: 'ok',
    limitReached: false,
    windows: [],
    ...overrides,
  };
}

function model(entries: AgentPanelEntry[]): PanelModel {
  return { agents: entries };
}

const opts = {
  cspSource: 'vscode-webview://xyz',
  icons: { 'ai-status-bar-claude': '<svg class="stub-claude-icon"></svg>' },
};

test('includes a CSP meta tag disallowing scripts', () => {
  const html = renderPanelHtml(model([]), opts);
  assert.match(html, /http-equiv="Content-Security-Policy"/);
  assert.match(html, /script-src 'none'/);
});

test('style-src allows inline styles without a nonce, so per-row width styles are not silently dropped', () => {
  // A nonce on style-src would only cover the <style> block, not per-row
  // `style="width: X%"` attributes (nonces never apply to style attributes) —
  // combining a nonce with 'unsafe-inline' in the same directive also makes
  // browsers ignore 'unsafe-inline' entirely, so the two must never mix here.
  const html = renderPanelHtml(model([]), opts);
  const csp = /content="([^"]*)"/.exec(html)?.[1] ?? '';
  const styleSrc = /style-src ([^;]+)/.exec(csp)?.[1] ?? '';
  assert.match(styleSrc, /'unsafe-inline'/);
  assert.doesNotMatch(styleSrc, /nonce-/);
});

test('a disabled agent renders its message and no window rows', () => {
  const html = renderPanelHtml(
    model([entry({ state: 'disabled', message: 'Disabled' })]),
    opts,
  );
  assert.match(html, /Disabled/);
  assert.doesNotMatch(html, /class="track"/);
});

test('an unavailable agent renders its reason as the message', () => {
  const html = renderPanelHtml(
    model([
      entry({ state: 'unavailable', message: 'no Claude credentials found' }),
    ]),
    opts,
  );
  assert.match(html, /no Claude credentials found/);
});

test('window rows render label, percent text, and reset text', () => {
  const html = renderPanelHtml(
    model([
      entry({
        windows: [
          {
            label: '5-hour',
            pctText: '42%',
            displayPercent: 42,
            severityLevel: 'ok',
            resetText: '14:30',
          },
        ],
      }),
    ]),
    opts,
  );
  assert.match(html, />5-hour</);
  assert.match(html, />42%</);
  assert.match(html, /14:30/);
});

test('bar width clamps to 100% when displayPercent exceeds 100', () => {
  const html = renderPanelHtml(
    model([
      entry({
        windows: [
          {
            label: '5-hour',
            pctText: '120%',
            displayPercent: 120,
            severityLevel: 'warn',
            resetText: '',
          },
        ],
      }),
    ]),
    opts,
  );
  assert.match(html, /width:\s*100%/);
});

test('bar width clamps to 0% when displayPercent is negative', () => {
  const html = renderPanelHtml(
    model([
      entry({
        windows: [
          {
            label: '5-hour',
            pctText: '0%',
            displayPercent: -20,
            severityLevel: 'ok',
            resetText: '',
          },
        ],
      }),
    ]),
    opts,
  );
  assert.match(html, /width:\s*0%/);
});

test('bar width is 0% when displayPercent is undefined', () => {
  const html = renderPanelHtml(
    model([
      entry({
        windows: [
          {
            label: '5-hour',
            pctText: '-',
            displayPercent: undefined,
            severityLevel: 'none',
            resetText: '',
          },
        ],
      }),
    ]),
    opts,
  );
  assert.match(html, /width:\s*0%/);
});

test('plan, credits text, and note are HTML-escaped', () => {
  const html = renderPanelHtml(
    model([
      entry({
        plan: '<b>Evil</b>',
        credits: { kind: 'text', text: '<script>bad()</script>' },
        footer: { kind: 'note', noteText: '<img src=x>', timeText: '14:02' },
      }),
    ]),
    opts,
  );
  assert.doesNotMatch(html, /<b>Evil<\/b>/);
  assert.match(html, /&lt;b&gt;Evil&lt;\/b&gt;/);
  assert.doesNotMatch(html, /<script>bad\(\)<\/script>/);
  assert.match(html, /&lt;script&gt;bad\(\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<img src=x>/);
  assert.match(html, /&lt;img src=x&gt;/);
});

test('credits gauge renders the percent and amount text', () => {
  const html = renderPanelHtml(
    model([
      entry({
        credits: {
          kind: 'gauge',
          pctText: '25%',
          displayPercent: 25,
          severityLevel: 'ok',
          amountText: '$12.40 / $50.00',
        },
      }),
    ]),
    opts,
  );
  assert.match(html, /25%/);
  assert.match(html, /\$12\.40 \/ \$50\.00/);
});

test('a rate-limit banner appears only when limitReached is true', () => {
  const reached = renderPanelHtml(model([entry({ limitReached: true })]), opts);
  const notReached = renderPanelHtml(
    model([entry({ limitReached: false })]),
    opts,
  );
  assert.match(reached, /Rate limit reached/);
  assert.doesNotMatch(notReached, /Rate limit reached/);
});

test('an ok agent with a pending message and no usage shows the message, not a stale footer', () => {
  const html = renderPanelHtml(
    model([entry({ message: 'Fetching Claude usage...' })]),
    opts,
  );
  assert.match(html, /Fetching Claude usage\.\.\./);
});

test('the updated footer renders the time text', () => {
  const html = renderPanelHtml(
    model([entry({ footer: { kind: 'updated', timeText: '14:02' } })]),
    opts,
  );
  assert.match(html, /14:02/);
});

test('rendering with no agents produces valid html without throwing', () => {
  assert.doesNotThrow(() => renderPanelHtml(model([]), opts));
});

test('a separator rule applies to every agent block except the last, automatically', () => {
  // Not per-instance markup: a single :not(:last-child) rule in the stylesheet,
  // so it applies correctly whether 1, 2, or N agents are rendered.
  const html = renderPanelHtml(
    model([entry(), entry({ providerId: 'codex' })]),
    opts,
  );
  assert.match(html, /\.agent:not\(:last-child\)/);
});

test('a known agent icon id renders a brand icon before the agent name', () => {
  const html = renderPanelHtml(
    model([entry({ icon: 'ai-status-bar-claude' })]),
    opts,
  );
  const header = /<header>.*?<\/header>/s.exec(html)?.[0] ?? '';
  assert.match(header, /class="brand-icon"/);
  assert.match(header, /<svg/);
  assert.ok(
    header.indexOf('brand-icon') < header.indexOf('class="name"'),
    'icon should render before the name in header markup',
  );
});

test('an unrecognized icon id renders no brand icon markup', () => {
  const html = renderPanelHtml(
    model([entry({ icon: 'something-unknown' })]),
    opts,
  );
  const header = /<header>.*?<\/header>/s.exec(html)?.[0] ?? '';
  assert.doesNotMatch(header, /class="brand-icon"/);
});

test('text-form credits render a colon between the label and the value', () => {
  const html = renderPanelHtml(
    model([entry({ credits: { kind: 'text', text: 'available' } })]),
    opts,
  );
  assert.match(html, /Credits:\s*<\/span>\s*<span class="value">available/);
});
