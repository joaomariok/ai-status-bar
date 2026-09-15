import { AgentUsage, StatusBarFallback, UsageWindow } from '../shared/types';

export interface ClaudeUsagePayload {
  five_hour?: { utilization?: number; resets_at?: string };
  seven_day?: { utilization?: number; resets_at?: string };
  extra_usage?: {
    is_enabled?: boolean;
    utilization?: number;
    used_credits?: number;
    monthly_limit?: number;
    currency?: string;
    decimal_places?: number;
  };
}

export function normalizeClaudeUsage(
  payload: ClaudeUsagePayload,
  plan: string | undefined,
): AgentUsage {
  const fiveHour = toUsageWindow(payload.five_hour);
  const weekly = toUsageWindow(payload.seven_day);
  const credits = toCredits(payload);
  const statusBarFallback = claudeStatusBarFallback(fiveHour, weekly, credits);

  return {
    plan,
    fiveHour,
    weekly,
    credits,
    ...(statusBarFallback ? { statusBarFallback } : {}),
  };
}

function toUsageWindow(
  window: ClaudeUsagePayload['five_hour'],
): UsageWindow | undefined {
  if (window?.utilization === undefined) return undefined;
  return {
    usedPercent: window.utilization,
    resetsAt: window.resets_at,
  };
}

function claudeStatusBarFallback(
  fiveHour: UsageWindow | undefined,
  weekly: UsageWindow | undefined,
  credits: AgentUsage['credits'],
): StatusBarFallback | undefined {
  const usedPercent = finiteCreditPercent(credits?.usedPercent);
  const hasWindows = Boolean(fiveHour || weekly);
  const exhausted = isWindowExhausted(fiveHour) || isWindowExhausted(weekly);

  if (!hasWindows && usedPercent === undefined) {
    return { kind: 'labelOnly' };
  }
  if (usedPercent === undefined || (!exhausted && hasWindows)) {
    return undefined;
  }
  return {
    kind: 'gauge',
    label: 'Cr',
    usedPercent,
    ...(exhausted ? { severityOverride: 'warn' as const } : {}),
  };
}

function finiteCreditPercent(value: number | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function isWindowExhausted(window: UsageWindow | undefined): boolean {
  return window?.usedPercent !== undefined && window.usedPercent >= 100;
}

function toCredits(payload: ClaudeUsagePayload): AgentUsage['credits'] {
  const extra = payload.extra_usage;
  if (!extra?.is_enabled || extra.monthly_limit === undefined) return undefined;

  return {
    usedPercent: extra.utilization ?? 0,
    used: extra.used_credits ?? 0,
    limit: extra.monthly_limit,
    currency: extra.currency ?? 'USD',
    decimals: extra.decimal_places ?? 2,
  };
}
