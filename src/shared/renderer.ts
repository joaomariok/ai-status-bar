import * as vscode from 'vscode';
import {
  agentPrefix,
  dot,
  escapeMarkdown,
  formatReset,
  meter,
  money,
  pctShort,
  presentationPercent,
  statusPart,
} from './format';
import {
  AgentProvider,
  AgentSettings,
  AgentUsage,
  PresentationMode,
  UsageWindow,
} from './types';
import { resolveWindowLabel } from './windowLabels';

export interface RenderInput {
  provider: AgentProvider;
  settings: AgentSettings;
  usage: AgentUsage | undefined;
  updatedAt: Date | undefined;
  note: string | undefined;
}

export function resolvePresentationMode(
  provider: AgentProvider,
  settings: AgentSettings,
): PresentationMode {
  return settings.presentationMode === 'agentDefault'
    ? provider.defaultPresentationMode
    : settings.presentationMode;
}

export function renderStatus(input: RenderInput): {
  text: string;
  tooltip: string | vscode.MarkdownString;
} {
  const { provider, settings, usage, note } = input;

  if (!usage) {
    return {
      text: note
        ? `$(warning) ${provider.label}`
        : `$(pulse) ${provider.label} ...`,
      tooltip: note ?? `Fetching ${provider.label} usage...`,
    };
  }

  const mode = resolvePresentationMode(provider, settings);
  const windowLabels = usage.windowLabels ?? provider.windowLabels;
  const parts: string[] = [];
  const replacePrimaryWithWeekly =
    settings.replacePrimaryWithWeeklyOnLimit &&
    isWindowLimitReached(usage.weekly);

  if (replacePrimaryWithWeekly) {
    parts.push(
      renderBarPart(
        resolveWindowLabel(windowLabels, 'weekly'),
        usage.weekly,
        mode,
        settings,
      ),
    );
  } else {
    parts.push(
      renderBarPart(
        resolveWindowLabel(windowLabels, 'fiveHour'),
        usage.fiveHour,
        mode,
        settings,
      ),
    );
    if (settings.showWeekly) {
      parts.push(
        renderBarPart(
          resolveWindowLabel(windowLabels, 'weekly'),
          usage.weekly,
          mode,
          settings,
        ),
      );
    }
  }

  const prefix = agentPrefix(
    provider.label,
    provider.icon,
    settings.agentNameStyle,
  );
  const text =
    (parts.length ? `${prefix}${parts.join(' · ')}` : provider.label) +
    (note ? ' $(warning)' : '');

  return {
    text,
    tooltip: renderTooltip(input, mode),
  };
}

function isWindowLimitReached(win: UsageWindow | undefined): boolean {
  return win?.usedPercent !== undefined && win.usedPercent >= 100;
}

function renderBarPart(
  label: string,
  win: UsageWindow | undefined,
  mode: PresentationMode,
  settings: AgentSettings,
): string {
  return statusPart(label, win?.usedPercent, {
    style: settings.statusBarStyle,
    mode,
    cells: settings.cells,
    cautionAt: settings.cautionAt,
    warnAt: settings.warnAt,
  });
}

function renderTooltip(
  input: RenderInput,
  mode: PresentationMode,
): vscode.MarkdownString {
  const { provider, settings, usage, updatedAt, note } = input;
  const md = new vscode.MarkdownString(undefined, true);
  const windowLabels = usage?.windowLabels ?? provider.windowLabels;
  md.supportThemeIcons = true;

  md.appendMarkdown(`${formatTooltipHeader(provider, mode)}\n\n`);

  if (usage?.limitReached) {
    md.appendMarkdown(
      '&nbsp;$(error) **Rate limit reached** - usage paused until reset\n\n',
    );
  }

  const heading = mode === 'remaining' ? 'Remaining' : 'Used';
  md.appendMarkdown(
    `| &nbsp;&nbsp;Window&nbsp;&nbsp;&nbsp; | &nbsp;&nbsp;${heading}&nbsp;&nbsp;&nbsp;&nbsp; | &nbsp;&nbsp;&nbsp;Resets&nbsp;&nbsp; |\n`,
  );
  md.appendMarkdown('|:--|:--|:--|\n');
  appendWindowRow(
    md,
    windowLabels?.fiveHourTooltip ?? '5-hour',
    usage?.fiveHour,
    windowLabels?.fiveHourResetWithDate ?? false,
    mode,
    settings,
  );
  appendWindowRow(
    md,
    windowLabels?.weeklyTooltip ?? 'Weekly',
    usage?.weekly,
    windowLabels?.weeklyResetWithDate ?? true,
    mode,
    settings,
  );
  md.appendMarkdown('\n');

  appendCredits(md, usage, mode, settings);
  appendPlan(md, usage);

  md.appendMarkdown('---\n\n');
  const time = updatedAt
    ? updatedAt.toLocaleTimeString(settings.locale, {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '?';
  md.appendMarkdown(
    note
      ? `&nbsp;$(warning) ${escapeMarkdown(note)}&nbsp;&nbsp;·&nbsp;&nbsp;data from ${time}`
      : `&nbsp;$(sync) Updated ${time}`,
  );

  return md;
}

function appendWindowRow(
  md: vscode.MarkdownString,
  label: string,
  win: UsageWindow | undefined,
  withDate: boolean,
  mode: PresentationMode,
  settings: AgentSettings,
): void {
  const used = win?.usedPercent;
  const display = presentationPercent(used, mode);
  const gauge = `${meter(display, 12, '█', '░')}`;
  const reset = formatReset(win?.resetsAt, settings.locale, withDate);

  md.appendMarkdown(
    `| &nbsp;${dot(used, settings.cautionAt, settings.warnAt)}&nbsp; ${label}&nbsp;&nbsp;&nbsp; | &nbsp;&nbsp;${pctShort(display)}&nbsp;&nbsp;&nbsp;&nbsp;${gauge}&nbsp;&nbsp;&nbsp; | &nbsp;&nbsp;&nbsp;${reset || '&mdash;'}&nbsp;&nbsp; |\n`,
  );
}

function formatTooltipHeader(
  provider: AgentProvider,
  mode: PresentationMode,
): string {
  return `&nbsp;$(zap) **${provider.tooltipTitle}** · ${usageLabel(mode)}`;
}

function usageLabel(mode: PresentationMode): string {
  return mode === 'remaining' ? 'remaining usage' : 'usage';
}

function appendCredits(
  md: vscode.MarkdownString,
  usage: AgentUsage | undefined,
  mode: PresentationMode,
  settings: AgentSettings,
): void {
  const credits = usage?.credits;
  if (!credits) return;

  if (credits.text) {
    md.appendMarkdown(
      `&nbsp;$(credit-card) Credits&nbsp;&nbsp;**${escapeMarkdown(credits.text)}**\n\n`,
    );
    return;
  }

  if (
    credits.used === undefined ||
    credits.limit === undefined ||
    credits.currency === undefined ||
    credits.decimals === undefined
  ) {
    return;
  }

  const usedPercent = credits.usedPercent;
  const display = presentationPercent(usedPercent, mode);
  const gauge = `&nbsp;&nbsp;&nbsp;&nbsp;${meter(display, 12, '█', '░')}&nbsp;&nbsp;&nbsp;`;

  md.appendMarkdown(
    `&nbsp;$(credit-card) Credits&nbsp;&nbsp;&nbsp;${dot(usedPercent, settings.cautionAt, settings.warnAt)}${gauge} **${pctShort(display)}**` +
      `&nbsp;&nbsp;&nbsp;·&nbsp;&nbsp;${money(credits.used, credits.currency, credits.decimals)} / ${money(credits.limit, credits.currency, credits.decimals)}\n\n`,
  );
}

function appendPlan(
  md: vscode.MarkdownString,
  usage: AgentUsage | undefined,
): void {
  if (!usage?.plan) return;
  md.appendMarkdown(
    `&nbsp;$(account) Plan&nbsp;&nbsp;**${escapeMarkdown(usage.plan)}**\n\n`,
  );
}
