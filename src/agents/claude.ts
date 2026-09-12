import * as fs from 'fs';
import * as https from 'https';
import * as os from 'os';
import * as path from 'path';
import { parseClaudeCredentials } from './claudeCredentials';
import { getBool } from '../shared/settings';
import { AgentDetection, AgentProvider, AgentUsage } from '../shared/types';

const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage';
const OAUTH_BETA = 'oauth-2025-04-20';
const MAX_RETRY_AFTER_MS = 30 * 60_000;

interface ClaudeUsagePayload {
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

export class ClaudeProvider implements AgentProvider {
  readonly id = 'claude';
  readonly label = 'Claude';
  readonly icon = 'ai-status-bar-claude';
  readonly tooltipTitle = 'Claude Code';
  readonly defaultPresentationMode = 'used';

  isEnabled(): boolean {
    return getBool('claude.enabled', true);
  }

  async detect(): Promise<AgentDetection> {
    const credentials = await readClaudeCredentials();
    return credentials?.accessToken
      ? { available: true }
      : { available: false, reason: 'no Claude credentials found' };
  }

  async fetchUsage(): Promise<AgentUsage> {
    const credentials = await readClaudeCredentials();
    if (!credentials?.accessToken) throw new Error('no credentials; sign in to Claude Code');

    const payload = await fetchClaudeUsage(credentials.accessToken);
    return {
      plan: credentials.plan,
      fiveHour: payload.five_hour?.utilization === undefined
        ? undefined
        : {
          usedPercent: payload.five_hour.utilization,
          resetsAt: payload.five_hour.resets_at,
        },
      weekly: payload.seven_day?.utilization === undefined
        ? undefined
        : {
          usedPercent: payload.seven_day.utilization,
          resetsAt: payload.seven_day.resets_at,
        },
      credits: toCredits(payload),
    };
  }
}

async function readClaudeCredentials(): Promise<ReturnType<typeof parseClaudeCredentials>> {
  try {
    const raw = await fs.promises.readFile(path.join(os.homedir(), '.claude', '.credentials.json'), 'utf8');
    return parseClaudeCredentials(raw);
  } catch {
    return undefined;
  }
}

function fetchClaudeUsage(token: string): Promise<ClaudeUsagePayload> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      USAGE_URL,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'anthropic-beta': OAUTH_BETA,
        },
        timeout: 8000,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          if (res.statusCode !== 200) {
            const error = new Error(`HTTP ${res.statusCode}`) as Error & { retryAfterMs?: number; status?: number };
            error.status = res.statusCode;
            const retryAfter = Number(res.headers['retry-after']);
            if (Number.isFinite(retryAfter) && retryAfter >= 0) {
              error.retryAfterMs = Math.min(MAX_RETRY_AFTER_MS, Math.max(5_000, retryAfter * 1000));
            }
            reject(error);
            return;
          }

          try {
            resolve(JSON.parse(body) as ClaudeUsagePayload);
          } catch (error) {
            reject(error);
          }
        });
      },
    );

    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
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
