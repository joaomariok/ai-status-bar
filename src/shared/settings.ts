import * as vscode from 'vscode';
import { AgentSettings, StatusBarStyle } from './types';
import { CAUTION_AT, WARN_AT } from './format';

const CONFIG_SECTION = 'aiStatusBar';

export function config(): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration(CONFIG_SECTION);
}

export function getSettings(): AgentSettings {
  const cfg = config();

  return {
    pollMs: Math.max(30, cfg.get<number>('pollSeconds') ?? 120) * 1000,
    cells: cfg.get<number>('barCells') ?? 3,
    showWeekly: cfg.get<boolean>('showWeekly') ?? true,
    replacePrimaryWithWeeklyOnLimit: cfg.get<boolean>('replacePrimaryWithWeeklyOnLimit') ?? true,
    cautionAt: cfg.get<number>('cautionAt') ?? CAUTION_AT,
    warnAt: cfg.get<number>('warnAt') ?? WARN_AT,
    locale: cfg.get<string>('locale') || undefined,
    presentationMode: cfg.get<'agentDefault' | 'used' | 'remaining'>('presentationMode') ?? 'agentDefault',
    statusBarStyle: cfg.get<StatusBarStyle>('statusBarStyle') ?? 'full',
  };
}

export function getBool(key: string, fallback: boolean): boolean {
  return config().get<boolean>(key) ?? fallback;
}

export function getString(key: string, fallback = ''): string {
  return config().get<string>(key) ?? fallback;
}

export function getNumber(key: string, fallback = 0): number {
  return config().get<number>(key) ?? fallback;
}
