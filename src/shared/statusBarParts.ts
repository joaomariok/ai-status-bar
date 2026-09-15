import { statusPart, statusTextPart } from './format';
import {
  AgentProvider,
  AgentSettings,
  AgentUsage,
  PresentationMode,
  StatusBarFallback,
  UsageWindow,
} from './types';
import { resolveWindowLabel } from './windowLabels';

export interface StatusBarPartsInput {
  usage: AgentUsage;
  mode: PresentationMode;
  settings: Pick<
    AgentSettings,
    | 'cells'
    | 'showWeekly'
    | 'replacePrimaryWithWeeklyOnLimit'
    | 'cautionAt'
    | 'warnAt'
    | 'statusBarStyle'
  >;
  windowLabels?: AgentProvider['windowLabels'];
}

export function buildStatusBarParts(input: StatusBarPartsInput): string[] {
  const { usage, mode, settings, windowLabels } = input;
  if (usage.statusBarFallback) {
    return renderFallback(usage.statusBarFallback, mode, settings);
  }

  const weeklyExhausted = isWindowLimitReached(usage.weekly);

  if (settings.replacePrimaryWithWeeklyOnLimit && weeklyExhausted) {
    return [
      renderWindowPart('weekly', usage.weekly, mode, settings, windowLabels),
    ];
  }

  const parts = [
    renderWindowPart('fiveHour', usage.fiveHour, mode, settings, windowLabels),
  ];
  if (settings.showWeekly) {
    parts.push(
      renderWindowPart('weekly', usage.weekly, mode, settings, windowLabels),
    );
  }
  return parts;
}

function renderFallback(
  fallback: StatusBarFallback,
  mode: PresentationMode,
  settings: StatusBarPartsInput['settings'],
): string[] {
  switch (fallback.kind) {
    case 'gauge':
      return [
        statusPart(fallback.label, fallback.usedPercent, {
          ...statusOptions(mode, settings),
          severityOverride: fallback.severityOverride,
        }),
      ];
    case 'text':
      return [
        statusTextPart(fallback.label, fallback.text, {
          severityOverride: fallback.severityOverride,
        }),
      ];
    case 'labelOnly':
      return [];
  }
}

function isWindowLimitReached(win: UsageWindow | undefined): boolean {
  return win?.usedPercent !== undefined && win.usedPercent >= 100;
}

function renderWindowPart(
  slot: 'fiveHour' | 'weekly',
  win: UsageWindow | undefined,
  mode: PresentationMode,
  settings: StatusBarPartsInput['settings'],
  windowLabels: AgentProvider['windowLabels'] | undefined,
): string {
  return statusPart(resolveWindowLabel(windowLabels, slot), win?.usedPercent, {
    ...statusOptions(mode, settings),
  });
}

function statusOptions(
  mode: PresentationMode,
  settings: StatusBarPartsInput['settings'],
) {
  return {
    style: settings.statusBarStyle,
    mode,
    cells: settings.cells,
    cautionAt: settings.cautionAt,
    warnAt: settings.warnAt,
  };
}
