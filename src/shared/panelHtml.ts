import { escapeHtml } from './format';
import { AgentPanelEntry, PanelModel } from './panelModel';

export interface PanelHtmlOptions {
  cspSource: string;
  /** Raw `<svg>...</svg>` markup keyed by provider icon id (e.g. `ai-status-bar-claude`). */
  icons: Record<string, string>;
}

/**
 * Pure HTML rendering for the sidebar webview. No `vscode` import — the
 * webview host (usageViewProvider.ts) is the only place that touches the
 * vscode API, so this stays independently unit-testable.
 */
export function renderPanelHtml(model: PanelModel, opts: PanelHtmlOptions): string {
  const { cspSource, icons } = opts;
  // style-src is 'unsafe-inline' rather than nonce-scoped: nonces only ever
  // cover <style>/<link> elements, never a per-element `style="..."`
  // attribute, and each window/credits bar sets its width that way. Mixing a
  // nonce into this directive would also make browsers ignore 'unsafe-inline'
  // outright (nonce-source present => 'unsafe-inline' ignored), so don't add
  // one back in. This is safe here because no untrusted string ever reaches a
  // style attribute — only numbers this module computes and clamps itself.
  const csp = [
    "default-src 'none'",
    `img-src ${cspSource}`,
    "style-src 'unsafe-inline'",
    "script-src 'none'",
  ].join('; ');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<style>${STYLE}</style>
</head>
<body>
${model.agents.map((entry) => renderAgent(entry, icons)).join('\n')}
</body>
</html>`;
}

function renderAgent(entry: AgentPanelEntry, icons: Record<string, string>): string {
  const icon = icons[entry.icon];
  const iconMarkup = icon ? `<span class="brand-icon">${icon}</span>` : '';
  const plan = entry.plan ? `<span class="plan">${escapeHtml(entry.plan)}</span>` : '';

  return `<section class="agent">
  <header>${iconMarkup}<span class="name">${escapeHtml(entry.label)}</span>${plan}</header>
  ${entry.message !== undefined ? renderMessage(entry.message) : renderUsage(entry)}
</section>`;
}

function renderMessage(message: string): string {
  return `<p class="message">${escapeHtml(message)}</p>`;
}

function renderUsage(entry: AgentPanelEntry): string {
  const banner = entry.limitReached
    ? '<div class="banner">Rate limit reached &mdash; usage paused until reset</div>'
    : '';
  const windows = entry.windows.map(renderWindowRow).join('\n');
  const credits = entry.credits ? renderCredits(entry.credits) : '';
  const footer = entry.footer ? renderFooter(entry.footer) : '';

  return `${banner}
  ${windows}
  ${credits}
  ${footer}`;
}

function clampWidth(value: number | undefined): number {
  if (value === undefined) return 0;
  return Math.max(0, Math.min(100, value));
}

function renderWindowRow(row: AgentPanelEntry['windows'][number]): string {
  const width = clampWidth(row.displayPercent);
  return `<div class="row">
    <div class="row-head"><span>${escapeHtml(row.label)}</span><span class="pct">${escapeHtml(row.pctText)}</span></div>
    <div class="track"><div class="fill level-${row.severityLevel}" style="width: ${width}%"></div></div>
    ${row.resetText ? `<div class="meta">resets ${escapeHtml(row.resetText)}</div>` : ''}
  </div>`;
}

function renderCredits(credits: NonNullable<AgentPanelEntry['credits']>): string {
  if (credits.kind === 'text') {
    return `<div class="credits"><span class="label">Credits:</span> <span class="value">${escapeHtml(credits.text)}</span></div>`;
  }

  const width = clampWidth(credits.displayPercent);
  return `<div class="credits">
    <div class="row-head"><span class="label">Credits</span><span class="pct">${escapeHtml(credits.pctText)}</span></div>
    <div class="track"><div class="fill level-${credits.severityLevel}" style="width: ${width}%"></div></div>
    <div class="meta">${escapeHtml(credits.amountText)}</div>
  </div>`;
}

function renderFooter(footer: NonNullable<AgentPanelEntry['footer']>): string {
  return footer.kind === 'note'
    ? `<footer class="note">${escapeHtml(footer.noteText)} &middot; data from ${escapeHtml(footer.timeText)}</footer>`
    : `<footer>Updated ${escapeHtml(footer.timeText)}</footer>`;
}

const STYLE = `
  body { margin: 0; padding: 12px 16px; font-family: var(--vscode-font-family); color: var(--vscode-foreground); }
  .agent:not(:last-child) { padding-bottom: 12px; margin-bottom: 12px; border-bottom: 1px solid var(--vscode-widget-border, rgba(128, 128, 128, 0.35)); }
  .agent header { display: flex; align-items: baseline; gap: 6px; font-weight: 600; }
  .agent header .name { margin-right: auto; }
  .brand-icon svg { width: 14px; height: 14px; fill: currentColor; position: relative; top: 1px; }
  .plan { font-weight: normal; color: var(--vscode-descriptionForeground); }
  .message { color: var(--vscode-descriptionForeground); }
  .banner { color: var(--vscode-errorForeground); margin: 4px 0; }
  .row-head { display: flex; justify-content: space-between; margin-top: 6px; }
  .track { height: 6px; margin: 4px 0; border-radius: 3px; background: var(--vscode-editorWidget-background); overflow: hidden; }
  .fill { height: 100%; }
  .fill.level-ok { background: var(--vscode-charts-green); }
  .fill.level-caution { background: var(--vscode-charts-yellow); }
  .fill.level-warn { background: var(--vscode-charts-red); }
  .fill.level-none { background: var(--vscode-descriptionForeground); }
  .meta { font-size: 0.9em; color: var(--vscode-descriptionForeground); }
  .credits { margin-top: 8px; }
  footer { margin-top: 8px; font-size: 0.9em; color: var(--vscode-descriptionForeground); }
  footer.note { color: var(--vscode-editorWarning-foreground); }
`;
