import * as path from 'path';
import * as vscode from 'vscode';
import { readCache, writeCache } from './cache';
import { renderStatus } from './renderer';
import { getSettings } from './settings';
import { AgentProvider, AgentUsage } from './types';

const MAX_BACKOFF_MS = 30 * 60_000;

interface CachedUsage {
  stamp: number;
  value: AgentUsage;
}

export class AgentStatusController implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;
  private readonly cacheFile: string;
  private timer: NodeJS.Timeout | undefined;
  private usage: AgentUsage | undefined;
  private updatedAt: Date | undefined;
  private note: string | undefined;
  private inFlight = false;
  private alerted = false;
  private disposed = false;
  private backoffMs: number | undefined;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly provider: AgentProvider,
    priority: number,
  ) {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, priority);
    this.cacheFile = path.join(context.globalStorageUri.fsPath, `${provider.id}-usage-cache.json`);
    context.subscriptions.push(this.item);
  }

  start(initialDelayMs = 0): void {
    this.schedule(initialDelayMs);
  }

  refresh(): void {
    void this.poll(true);
  }

  dispose(): void {
    this.disposed = true;
    if (this.timer) clearTimeout(this.timer);
    this.provider.dispose?.();
    this.item.dispose();
  }

  private schedule(ms: number): void {
    if (this.disposed) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.poll(false), ms);
  }

  private async poll(force: boolean): Promise<void> {
    const settings = getSettings();
    if (this.inFlight) return;
    this.backoffMs ??= settings.pollMs;
    if (!this.provider.isEnabled()) {
      this.item.hide();
      this.schedule(settings.pollMs);
      return;
    }

    this.inFlight = true;
    let next = settings.pollMs;
    try {
      const detected = await this.provider.detect();
      if (!detected.available) {
        this.item.hide();
        this.usage = undefined;
        this.note = detected.reason;
        return;
      }

      this.item.show();

      if (!force) {
        const cache = await readCache<AgentUsage>(this.cacheFile);
        const age = cache ? Date.now() - cache.stamp : Infinity;
        if (cache && age < settings.pollMs) {
          this.usage = cache.value;
          this.updatedAt = new Date(cache.stamp);
          this.note = undefined;
          this.maybeAlert(settings.warnAt);
          next = Math.max(5_000, settings.pollMs - age);
          return;
        }
      }

      this.usage = await this.provider.fetchUsage();
      this.updatedAt = new Date();
      this.note = undefined;
      this.backoffMs = settings.pollMs;
      await writeCache<CachedUsage['value']>(this.cacheFile, {
        stamp: this.updatedAt.getTime(),
        value: this.usage,
      });
      this.maybeAlert(settings.warnAt);
    } catch (error: unknown) {
      this.note = noteFromError(error);
      this.item.show();
      next = this.nextFailureDelay(settings.pollMs, error);
    } finally {
      this.inFlight = false;
      this.render();
      this.schedule(next);
    }
  }

  private nextFailureDelay(basePollMs: number, error: unknown): number {
    const retryAfterMs = retryAfterFrom(error);
    if (retryAfterMs !== undefined) {
      this.backoffMs = Math.min(MAX_BACKOFF_MS, Math.max(5_000, retryAfterMs));
      return this.backoffMs;
    }

    const current = Math.max(basePollMs, this.backoffMs ?? basePollMs);
    this.backoffMs = Math.min(current * 2, MAX_BACKOFF_MS);
    return this.backoffMs;
  }

  private render(): void {
    const rendered = renderStatus({
      provider: this.provider,
      settings: getSettings(),
      usage: this.usage,
      updatedAt: this.updatedAt,
      note: this.note,
    });
    this.item.text = rendered.text;
    this.item.tooltip = rendered.tooltip;
  }

  private maybeAlert(warnAt: number): void {
    const five = this.usage?.fiveHour?.usedPercent ?? 0;
    const week = this.usage?.weekly?.usedPercent ?? 0;
    const worst = Math.max(five, week);

    if (worst >= warnAt && !this.alerted) {
      this.alerted = true;
      const labels = this.usage?.windowLabels ?? this.provider.windowLabels;
      const fiveLabel = labels?.fiveHourTooltip ?? '5-hour';
      const weekLabel = labels?.weeklyTooltip ?? 'weekly';
      const which = five >= warnAt && week >= warnAt ? `${fiveLabel} and ${weekLabel}` : five >= warnAt ? fiveLabel : weekLabel;
      void vscode.window.showWarningMessage(`${this.provider.label} ${which} usage at ${Math.round(worst)}%.`);
    } else if (worst < warnAt) {
      this.alerted = false;
    }
  }
}

function retryAfterFrom(error: unknown): number | undefined {
  if (error === null || typeof error !== 'object') return undefined;
  const value = (error as { retryAfterMs?: unknown }).retryAfterMs;
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function noteFromError(error: unknown): string {
  const status = statusFrom(error);
  if (status === 429) return 'rate limited (HTTP 429)';
  if (status === 401 || status === 403) return 'token rejected (reopen the agent)';

  const message = error instanceof Error ? error.message : String(error);
  return `fetch failed (${message})`;
}

function statusFrom(error: unknown): number | undefined {
  if (error === null || typeof error !== 'object') return undefined;

  const status = (error as { status?: unknown; statusCode?: unknown }).status ??
    (error as { status?: unknown; statusCode?: unknown }).statusCode;
  if (typeof status === 'number' && Number.isFinite(status)) return status;

  const message = error instanceof Error ? error.message : String(error);
  const match = /^HTTP (\d{3})$/.exec(message);
  return match ? Number(match[1]) : undefined;
}
