import { AgentUsage, StatusBarFallback, UsageWindow } from '../shared/types';

export interface CodexRateLimitWindow {
  usedPercent: number;
  windowDurationMins: number | null;
  resetsAt: number | null;
}

export interface CodexCreditsSnapshot {
  hasCredits: boolean;
  unlimited: boolean;
  balance: string | null;
}

export interface CodexRateLimitSnapshot {
  limitId: string | null;
  limitName: string | null;
  primary: CodexRateLimitWindow | null;
  secondary: CodexRateLimitWindow | null;
  credits: CodexCreditsSnapshot | null;
  planType: string | null;
  rateLimitReachedType: string | null;
}

export function normalizeCodexUsage(
  snapshot: CodexRateLimitSnapshot,
): AgentUsage {
  const fiveHour = toUsageWindow(snapshot.primary);
  const weekly = toUsageWindow(snapshot.secondary);
  const creditText = snapshot.credits
    ? creditsText(snapshot.credits)
    : undefined;
  const limitReached = Boolean(snapshot.rateLimitReachedType);
  const statusBarFallback = codexStatusBarFallback(
    fiveHour,
    weekly,
    creditText,
    limitReached,
  );

  return {
    plan: snapshot.planType ?? undefined,
    fiveHour,
    weekly,
    credits: creditText === undefined ? undefined : { text: creditText },
    limitReached,
    ...(statusBarFallback ? { statusBarFallback } : {}),
  };
}

function toUsageWindow(
  window: CodexRateLimitWindow | null,
): UsageWindow | undefined {
  if (!window) return undefined;
  return {
    usedPercent: window.usedPercent,
    resetsAt: window.resetsAt,
  };
}

function codexStatusBarFallback(
  fiveHour: UsageWindow | undefined,
  weekly: UsageWindow | undefined,
  creditText: string | undefined,
  limitReached: boolean,
): StatusBarFallback | undefined {
  const text = usableCreditText(creditText);
  const isCreditOnly = !fiveHour && !weekly;

  if (!text || (!limitReached && !isCreditOnly)) return undefined;
  return {
    kind: 'text',
    label: 'Cr',
    text: truncateCreditDecimals(text),
    ...(limitReached ? { severityOverride: 'warn' as const } : {}),
  };
}

function usableCreditText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.toLowerCase() === 'none') return undefined;
  return trimmed;
}

function truncateCreditDecimals(value: string): string {
  return value.replace(/(\d+)\.(\d{2})\d+/g, '$1.$2');
}

function creditsText(credits: CodexCreditsSnapshot): string {
  if (credits.unlimited) return 'unlimited';
  if (credits.hasCredits) return credits.balance ?? 'available';
  return 'none';
}
