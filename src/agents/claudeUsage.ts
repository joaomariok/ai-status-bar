import { AgentUsage } from '../shared/types';

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
  return {
    plan,
    fiveHour:
      payload.five_hour?.utilization === undefined
        ? undefined
        : {
            usedPercent: payload.five_hour.utilization,
            resetsAt: payload.five_hour.resets_at,
          },
    weekly:
      payload.seven_day?.utilization === undefined
        ? undefined
        : {
            usedPercent: payload.seven_day.utilization,
            resetsAt: payload.seven_day.resets_at,
          },
    credits: toCredits(payload),
  };
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
