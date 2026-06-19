import * as fs from 'fs';
import * as https from 'https';
import * as os from 'os';
import * as path from 'path';
import { getBool, getNumber, getString } from '../shared/settings';
import { AgentDetection, AgentProvider, AgentUsage, UsageWindow } from '../shared/types';

const DEFAULT_API_BASE_URL = 'https://api.devin.ai';
const REQUEST_TIMEOUT_MS = 10_000;

interface DevinUsagePayload {
  plan?: string;
  plan_type?: string;
  planType?: string;
  tier?: string;
  usage?: unknown;
  value?: unknown;
  fiveHour?: unknown;
  five_hour?: unknown;
  weekly?: unknown;
  seven_day?: unknown;
  credits?: unknown;
  limitReached?: unknown;
  rateLimitReached?: unknown;
}

interface DevinSelfResponse {
  org_id?: string | null;
}

interface DevinCycle {
  after: number;
  before: number;
}

interface DevinCyclesResponse {
  items?: DevinCycle[];
}

interface DevinDailyConsumptionResponse {
  total_acus?: number;
}

interface DevinOrganizationResponse {
  name?: string;
  max_cycle_acu_limit?: number | null;
}

interface DevinCachedPlanInfo {
  planName?: unknown;
  plan?: unknown;
  dailyRemainingPercent?: unknown;
  weeklyRemainingPercent?: unknown;
  dailyResetAtUnix?: unknown;
  weeklyResetAtUnix?: unknown;
  hideDailyQuota?: unknown;
  hideWeeklyQuota?: unknown;
  remainingFlexCredits?: unknown;
  totalFlexCredits?: unknown;
  overageBalanceMicros?: unknown;
  quotaUsage?: unknown;
  usage?: unknown;
}

export class DevinProvider implements AgentProvider {
  readonly id = 'devin';
  readonly label = 'Devin';
  readonly tooltipTitle = 'Devin';
  readonly defaultPresentationMode = 'used';
  readonly windowLabels = {
    fiveHour: 'day',
    fiveHourTooltip: 'Today',
    weekly: 'cy',
    weeklyTooltip: 'Billing cycle',
  };

  isEnabled(): boolean {
    return getBool('devin.enabled', true);
  }

  async detect(): Promise<AgentDetection> {
    if (apiToken() || await exists(devinAppDataDir()) || await exists(devinHomeDir())) {
      return { available: true };
    }

    return { available: false, reason: 'no Devin IDE storage found' };
  }

  async fetchUsage(): Promise<AgentUsage> {
    const configured = getString('devin.usageFile') || process.env.DEVIN_USAGE_FILE || '';
    if (configured) {
      const configuredUsage = await readUsageFile(configured);
      if (configuredUsage) return configuredUsage;
    }

    const cachedUsage = await readLocalDevinCache();
    if (cachedUsage) return cachedUsage;

    const token = apiToken();
    if (token) return fetchApiUsage(token);

    for (const candidate of devinUsageFileCandidates()) {
      const usage = await readUsageFile(candidate);
      if (usage) return usage;
    }

    throw new Error('Devin usage source not found; open Devin once or set aiStatusBar.devin.usageFile');
  }
}

async function fetchApiUsage(token: string): Promise<AgentUsage> {
  const orgId = getString('devin.orgId') || (await fetchDevinJson<DevinSelfResponse>(token, '/v3/self')).org_id;
  const userId = getString('devin.userId');
  if (!orgId) throw new Error('Devin org ID not found; set aiStatusBar.devin.orgId');
  if (!userId) throw new Error('Devin user ID required; set aiStatusBar.devin.userId');

  const [cycle, organization] = await Promise.all([
    currentCycle(token),
    fetchDevinJson<DevinOrganizationResponse>(token, `/v3/enterprise/organizations/${encodeURIComponent(orgId)}`),
  ]);

  const cycleUsage = await userConsumption(token, userId, cycle.after, cycle.before);
  const dailyUsage = await userConsumption(token, userId, todayStartUtcSeconds(), Math.floor(Date.now() / 1000));
  const configuredLimit = getNumberSetting('devin.cycleAcuLimit');
  const limit = configuredLimit ?? organization.max_cycle_acu_limit ?? undefined;

  return {
    plan: organization.name,
    fiveHour: limit === undefined
      ? undefined
      : {
        usedPercent: (dailyUsage.total_acus ?? 0) / limit * 100,
      },
    weekly: limit === undefined
      ? undefined
      : {
        usedPercent: (cycleUsage.total_acus ?? 0) / limit * 100,
        resetsAt: cycle.before,
      },
    credits: {
      text: limit === undefined
        ? `${formatAcus(cycleUsage.total_acus)} ACUs this cycle`
        : `${formatAcus(cycleUsage.total_acus)} / ${formatAcus(limit)} ACUs`,
    },
  };
}

async function currentCycle(token: string): Promise<DevinCycle> {
  const response = await fetchDevinJson<DevinCyclesResponse>(token, '/v3/enterprise/consumption/cycles?first=10');
  const now = Math.floor(Date.now() / 1000);
  const current = response.items?.find((cycle) => cycle.after <= now && now < cycle.before);
  if (current) return current;

  const latest = response.items?.sort((a, b) => b.after - a.after)[0];
  if (latest) return latest;

  throw new Error('Devin consumption cycle not found');
}

async function userConsumption(
  token: string,
  userId: string,
  timeAfter: number,
  timeBefore: number,
): Promise<DevinDailyConsumptionResponse> {
  const query = `time_after=${encodeURIComponent(timeAfter)}&time_before=${encodeURIComponent(timeBefore)}`;
  return fetchDevinJson<DevinDailyConsumptionResponse>(
    token,
    `/v3/enterprise/consumption/daily/users/${encodeURIComponent(userId)}?${query}`,
  );
}

function fetchDevinJson<T>(token: string, route: string): Promise<T> {
  const base = getString('devin.apiBaseUrl', DEFAULT_API_BASE_URL).replace(/\/+$/, '');
  const url = new URL(route, `${base}/`);

  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        timeout: REQUEST_TIMEOUT_MS,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          if (res.statusCode !== 200) {
            const error = new Error(`HTTP ${res.statusCode}`) as Error & { status?: number };
            error.status = res.statusCode;
            reject(error);
            return;
          }

          try {
            resolve(JSON.parse(body) as T);
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

async function readUsageFile(file: string): Promise<AgentUsage | undefined> {
  if (!file) return undefined;

  try {
    const raw = await fs.promises.readFile(expandHome(file), 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    return usageFromPayload(parsed);
  } catch {
    return undefined;
  }
}

async function readLocalDevinCache(): Promise<AgentUsage | undefined> {
  for (const file of devinStateDbCandidates()) {
    const usage = await readStateDbUsage(file);
    if (usage) return usage;
  }

  return undefined;
}

async function readStateDbUsage(file: string): Promise<AgentUsage | undefined> {
  let text: string;

  try {
    text = (await fs.promises.readFile(file)).toString('utf8');
  } catch {
    return undefined;
  }

  const payloads = extractCachedPlanPayloads(text);
  for (let i = payloads.length - 1; i >= 0; i -= 1) {
    const usage = usageFromCachedPlan(payloads[i]);
    if (usage) return usage;
  }

  return undefined;
}

function extractCachedPlanPayloads(text: string): unknown[] {
  const payloads: unknown[] = [];
  const keys = [
    'windsurf.reactSettings.cachedPlanInfoData:',
    'windsurf.settings.cachedPlanInfo',
  ];

  for (const key of keys) {
    let index = -1;
    while (payloads.length < 50) {
      index = text.indexOf(key, index + 1);
      if (index < 0) break;

      const jsonStart = text.indexOf('{', index + key.length);
      if (jsonStart < 0 || jsonStart - index > 512) continue;

      const json = readBalancedJsonObject(text, jsonStart);
      if (!json) continue;

      try {
        payloads.push(JSON.parse(json) as unknown);
      } catch {
        // Ignore unrelated SQLite page fragments that happen to follow the key.
      }
    }
  }

  return payloads;
}

function readBalancedJsonObject(text: string, start: number): string | undefined {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  return undefined;
}

function usageFromCachedPlan(payload: unknown): AgentUsage | undefined {
  if (!payload || typeof payload !== 'object') return undefined;

  const record = payload as DevinCachedPlanInfo;
  const quota = asRecord(record.quotaUsage);
  const nestedUsage = asRecord(record.usage);
  const plan = firstString(record.planName, record.plan);
  const dailyRemaining = firstNumber(record.dailyRemainingPercent, quota?.dailyRemainingPercent);
  const weeklyRemaining = firstNumber(record.weeklyRemainingPercent, quota?.weeklyRemainingPercent);
  const dailyHidden = readBool(record.hideDailyQuota) ?? false;
  const weeklyHidden = readBool(record.hideWeeklyQuota) ?? false;
  const daily = dailyHidden || dailyRemaining === undefined
    ? undefined
    : {
      usedPercent: usedPercentFromRemaining(dailyRemaining),
      resetsAt: firstReset(record.dailyResetAtUnix, quota?.dailyResetAtUnix),
    };
  const weekly = weeklyHidden || weeklyRemaining === undefined
    ? undefined
    : {
      usedPercent: usedPercentFromRemaining(weeklyRemaining),
      resetsAt: firstReset(record.weeklyResetAtUnix, quota?.weeklyResetAtUnix),
    };
  const credits = cachedCredits(record, nestedUsage);

  if (!plan && !daily && !weekly && !credits) return undefined;

  return {
    plan,
    fiveHour: daily,
    weekly,
    credits,
    limitReached: dailyRemaining === 0 || weeklyRemaining === 0,
    windowLabels: {
      fiveHour: 'day',
      fiveHourTooltip: 'Daily quota',
      weekly: 'wk',
      weeklyTooltip: 'Weekly quota',
      fiveHourResetWithDate: true,
      weeklyResetWithDate: false,
    },
  };
}

function cachedCredits(
  record: DevinCachedPlanInfo,
  nestedUsage: Record<string, unknown> | undefined,
): AgentUsage['credits'] {
  const remainingFlexCredits = firstNumber(record.remainingFlexCredits, nestedUsage?.remainingFlexCredits);
  if (remainingFlexCredits !== undefined && remainingFlexCredits >= 0) {
    return { text: `${formatCredits(remainingFlexCredits)} add-on credits left` };
  }

  const totalFlexCredits = firstNumber(record.totalFlexCredits, nestedUsage?.flexCredits);
  const usedFlexCredits = firstNumber(nestedUsage?.usedFlexCredits);
  if (totalFlexCredits !== undefined && usedFlexCredits !== undefined && totalFlexCredits > 0) {
    return {
      used: usedFlexCredits,
      limit: totalFlexCredits,
      currency: 'USD',
      decimals: 0,
      usedPercent: usedFlexCredits / totalFlexCredits * 100,
    };
  }

  return undefined;
}

function usageFromPayload(payload: unknown): AgentUsage | undefined {
  const source = unwrapPayload(payload);
  if (!source || typeof source !== 'object') return undefined;

  const record = source as DevinUsagePayload;
  const fiveHour = usageWindow(record.fiveHour ?? record.five_hour);
  const weekly = usageWindow(record.weekly ?? record.seven_day);
  const credits = creditsFrom(record.credits);
  const plan = firstString(record.plan, record.plan_type, record.planType, record.tier);
  const limitReached = readBool(record.limitReached) ?? readBool(record.rateLimitReached);

  if (!fiveHour && !weekly && !credits && !plan && limitReached === undefined) return undefined;

  return {
    plan,
    fiveHour,
    weekly,
    credits,
    limitReached,
  };
}

function unwrapPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object') return payload;
  const record = payload as DevinUsagePayload;
  if (record.value) return unwrapPayload(record.value);
  if (record.usage) return unwrapPayload(record.usage);
  return payload;
}

function usageWindow(value: unknown): UsageWindow | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  const usedPercent = firstNumber(
    record.usedPercent,
    record.used_percent,
    record.utilization,
    record.percent,
    record.percentage,
  );
  if (usedPercent === undefined) return undefined;

  return {
    usedPercent: normalizePercent(usedPercent),
    resetsAt: firstReset(record.resetsAt, record.resets_at, record.resetAt, record.reset_at),
  };
}

function creditsFrom(value: unknown): AgentUsage['credits'] {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  const text = firstString(record.text, record.balanceText, record.summary);
  if (text) return { text };

  const usedPercent = firstNumber(record.usedPercent, record.used_percent, record.utilization);
  const used = firstNumber(record.used, record.usedCredits, record.used_credits);
  const limit = firstNumber(record.limit, record.monthlyLimit, record.monthly_limit);
  const currency = firstString(record.currency) ?? 'USD';
  const decimals = firstNumber(record.decimals, record.decimalPlaces, record.decimal_places) ?? 2;

  if (used === undefined || limit === undefined) return undefined;

  return {
    usedPercent: usedPercent === undefined ? undefined : normalizePercent(usedPercent),
    used,
    limit,
    currency,
    decimals,
  };
}

function devinUsageFileCandidates(): string[] {
  const app = devinAppDataDir();
  const home = devinHomeDir();

  return [
    path.join(app, 'User', 'globalStorage', 'devin-usage.json'),
    path.join(app, 'User', 'globalStorage', 'devin.usage.json'),
    path.join(app, 'User', 'globalStorage', 'cognition.devin', 'usage.json'),
    path.join(app, 'User', 'globalStorage', 'codeium.windsurf', 'devin-usage.json'),
    path.join(app, 'cli', 'usage.json'),
    path.join(home, 'usage.json'),
    path.join(home, 'devin-usage.json'),
  ];
}

function devinStateDbCandidates(): string[] {
  const app = process.env.APPDATA ?? path.join(homeDir(), 'AppData', 'Roaming');
  return [
    path.join(app, 'devin', 'User', 'globalStorage', 'state.vscdb'),
    path.join(app, 'devin', 'User', 'globalStorage', 'state.vscdb.backup'),
    path.join(app, 'Windsurf', 'User', 'globalStorage', 'state.vscdb'),
    path.join(app, 'Windsurf', 'User', 'globalStorage', 'state.vscdb.backup'),
  ];
}

function apiToken(): string | undefined {
  const envName = getString('devin.apiKeyEnv', 'DEVIN_API_KEY');
  const token = process.env[envName] ?? process.env.DEVIN_API_KEY;
  return token?.trim() || undefined;
}

function getNumberSetting(key: string): number | undefined {
  const value = getNumber(key);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function todayStartUtcSeconds(): number {
  const now = new Date();
  return Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 1000);
}

function formatAcus(value: number | undefined): string {
  if (value === undefined) return '?';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatCredits(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function devinAppDataDir(): string {
  const base = process.env.APPDATA;
  return base ? path.join(base, 'devin') : path.join(homeDir(), 'AppData', 'Roaming', 'devin');
}

function devinHomeDir(): string {
  return path.join(homeDir(), '.devin');
}

function homeDir(): string {
  return process.env.HOME ?? process.env.USERPROFILE ?? os.homedir();
}

async function exists(file: string): Promise<boolean> {
  try {
    await fs.promises.access(file, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function expandHome(file: string): string {
  if (file === '~') return homeDir();
  if (file.startsWith(`~${path.sep}`) || file.startsWith('~/')) {
    return path.join(homeDir(), file.slice(2));
  }
  return file;
}

function firstNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function firstReset(...values: unknown[]): string | number | null | undefined {
  for (const value of values) {
    if (value === null) return null;
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return undefined;
}

function readBool(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function normalizePercent(value: number): number {
  return value <= 1 ? value * 100 : value;
}

function usedPercentFromRemaining(value: number): number {
  return clampPercent(100 - normalizePercent(value));
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' ? value as Record<string, unknown> : undefined;
}
