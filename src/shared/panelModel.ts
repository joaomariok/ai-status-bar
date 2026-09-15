import {
  formatReset,
  money,
  pctShort,
  presentationPercent,
  severity,
  Severity,
} from './format';
import {
  AgentSettings,
  AgentSnapshot,
  AgentSnapshotState,
  AgentUsage,
  PresentationMode,
  UsageWindow,
} from './types';

export interface PanelWindowRow {
  label: string;
  pctText: string;
  displayPercent: number | undefined;
  severityLevel: Severity;
  resetText: string;
}

export type PanelCredits =
  | { kind: 'text'; text: string }
  | {
      kind: 'gauge';
      pctText: string;
      displayPercent: number | undefined;
      severityLevel: Severity;
      amountText: string;
    };

export type PanelFooter =
  | { kind: 'updated'; timeText: string }
  | { kind: 'note'; noteText: string; timeText: string };

export interface AgentPanelEntry {
  providerId: string;
  label: string;
  tooltipTitle: string;
  icon: string;
  state: AgentSnapshotState;
  message?: string;
  plan?: string;
  limitReached: boolean;
  windows: PanelWindowRow[];
  credits?: PanelCredits;
  footer?: PanelFooter;
}

export interface PanelModel {
  agents: AgentPanelEntry[];
}

/**
 * Pure transform from raw snapshots to presentation-ready rows. Mirrors the
 * tooltip's content (renderer.ts renderTooltip) but produces data instead of
 * a vscode.MarkdownString, so it can be rendered as HTML and unit-tested
 * without importing `vscode`.
 */
export function buildPanelModel(
  snapshots: AgentSnapshot[],
  settings: AgentSettings,
  now = Date.now(),
): PanelModel {
  return {
    agents: snapshots.map((snapshot) => buildEntry(snapshot, settings, now)),
  };
}

function buildEntry(
  snapshot: AgentSnapshot,
  settings: AgentSettings,
  now: number,
): AgentPanelEntry {
  const base = {
    providerId: snapshot.providerId,
    label: snapshot.label,
    tooltipTitle: snapshot.tooltipTitle,
    icon: snapshot.icon,
    state: snapshot.state,
    limitReached: false,
    windows: [] as PanelWindowRow[],
  };

  if (snapshot.state !== 'ok') {
    return {
      ...base,
      message:
        snapshot.state === 'disabled'
          ? 'Disabled'
          : (snapshot.note ?? 'Unavailable'),
    };
  }

  if (!snapshot.usage) {
    return {
      ...base,
      message: snapshot.note ?? `Fetching ${snapshot.label} usage...`,
    };
  }

  const usage = snapshot.usage;
  const mode = resolveMode(snapshot, settings);
  const windowLabels = usage.windowLabels ?? snapshot.windowLabels;

  return {
    ...base,
    plan: usage.plan,
    limitReached: usage.limitReached ?? false,
    windows: [
      buildWindowRow(
        windowLabels?.fiveHourTooltip ?? '5-hour',
        usage.fiveHour,
        windowLabels?.fiveHourResetWithDate ?? false,
        mode,
        settings,
        now,
      ),
      buildWindowRow(
        windowLabels?.weeklyTooltip ?? 'Weekly',
        usage.weekly,
        windowLabels?.weeklyResetWithDate ?? true,
        mode,
        settings,
        now,
      ),
    ],
    credits: buildCredits(usage, mode, settings),
    footer: buildFooter(snapshot.updatedAt, snapshot.note, settings),
  };
}

function resolveMode(
  snapshot: AgentSnapshot,
  settings: AgentSettings,
): PresentationMode {
  return settings.presentationMode === 'agentDefault'
    ? snapshot.defaultPresentationMode
    : settings.presentationMode;
}

function buildWindowRow(
  label: string,
  win: UsageWindow | undefined,
  withDate: boolean,
  mode: PresentationMode,
  settings: AgentSettings,
  now: number,
): PanelWindowRow {
  const display = presentationPercent(win?.usedPercent, mode);
  return {
    label,
    pctText: pctShort(display),
    displayPercent: display,
    severityLevel: severity(
      win?.usedPercent,
      settings.cautionAt,
      settings.warnAt,
    ),
    resetText: formatReset(win?.resetsAt, settings.locale, withDate, {
      format: settings.resetTimeFormat,
      now,
    }),
  };
}

function buildCredits(
  usage: AgentUsage,
  mode: PresentationMode,
  settings: AgentSettings,
): PanelCredits | undefined {
  const credits = usage.credits;
  if (!credits) return undefined;

  if (credits.text) {
    return { kind: 'text', text: credits.text };
  }

  if (
    credits.used === undefined ||
    credits.limit === undefined ||
    credits.currency === undefined ||
    credits.decimals === undefined
  ) {
    return undefined;
  }

  const display = presentationPercent(credits.usedPercent, mode);
  return {
    kind: 'gauge',
    pctText: pctShort(display),
    displayPercent: display,
    severityLevel: severity(
      credits.usedPercent,
      settings.cautionAt,
      settings.warnAt,
    ),
    amountText: `${money(credits.used, credits.currency, credits.decimals)} / ${money(credits.limit, credits.currency, credits.decimals)}`,
  };
}

function buildFooter(
  updatedAt: Date | undefined,
  note: string | undefined,
  settings: AgentSettings,
): PanelFooter | undefined {
  if (!updatedAt) return undefined;
  const timeText = updatedAt.toLocaleTimeString(settings.locale, {
    hour: '2-digit',
    minute: '2-digit',
  });
  return note
    ? { kind: 'note', noteText: note, timeText }
    : { kind: 'updated', timeText };
}
