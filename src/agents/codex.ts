import { ChildProcess, execFile, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import {
  exists,
  findCommandOnPath,
  isWindowsCommandShim,
} from './codexCommand';
import { detectCodexAvailability } from './codexDetection';
import { getBool, getString } from '../shared/settings';
import { AgentDetection, AgentProvider, AgentUsage } from '../shared/types';
import { getExtensionVersion } from '../shared/version';

const START_TIMEOUT_MS = 15_000;
const REQUEST_TIMEOUT_MS = 30_000;

interface RateLimitWindow {
  usedPercent: number;
  windowDurationMins: number | null;
  resetsAt: number | null;
}

interface CreditsSnapshot {
  hasCredits: boolean;
  unlimited: boolean;
  balance: string | null;
}

interface RateLimitSnapshot {
  limitId: string | null;
  limitName: string | null;
  primary: RateLimitWindow | null;
  secondary: RateLimitWindow | null;
  credits: CreditsSnapshot | null;
  planType: string | null;
  rateLimitReachedType: string | null;
}

interface RateLimitsResponse {
  rateLimits: RateLimitSnapshot;
  rateLimitsByLimitId: Record<string, RateLimitSnapshot | undefined> | null;
}

interface AppServerResponse {
  id?: number;
  error?: {
    message?: string;
  };
  result?: unknown;
}

export class CodexProvider implements AgentProvider {
  readonly id = 'codex';
  readonly label = 'Codex';
  readonly icon = 'ai-status-bar-codex';
  readonly tooltipTitle = 'Codex';
  readonly defaultPresentationMode = 'remaining';
  private readonly activeProcesses = new Set<ChildProcess>();

  dispose(): void {
    for (const proc of this.activeProcesses) {
      killTree(proc);
    }
    this.activeProcesses.clear();
  }

  isEnabled(): boolean {
    return getBool('codex.enabled', true);
  }

  async detect(): Promise<AgentDetection> {
    const configured = getString('codex.command', 'codex');
    const resolved = await resolveCodexCommand(configured);
    return detectCodexAvailability(resolved);
  }

  async fetchUsage(): Promise<AgentUsage> {
    const command = await resolveCodexCommand(
      getString('codex.command', 'codex'),
    );
    if (!command) throw new Error('Codex executable not found');
    const usage = await fetchCodexRateLimits(command, this.activeProcesses);

    return {
      plan: usage.planType ?? undefined,
      fiveHour: usage.primary
        ? {
            usedPercent: usage.primary.usedPercent,
            resetsAt: usage.primary.resetsAt,
          }
        : undefined,
      weekly: usage.secondary
        ? {
            usedPercent: usage.secondary.usedPercent,
            resetsAt: usage.secondary.resetsAt,
          }
        : undefined,
      credits: usage.credits ? { text: creditText(usage.credits) } : undefined,
      limitReached: Boolean(usage.rateLimitReachedType),
    };
  }
}

async function findFirstMatchingCodex(
  root: string | undefined,
  relativeParts: string[],
): Promise<string | undefined> {
  if (!root) return undefined;
  try {
    const entries = await fs.promises.readdir(root, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (!entry.name.startsWith('openai.chatgpt-')) continue;
      const candidate = path.join(root, entry.name, ...relativeParts);
      if (await exists(candidate)) return candidate;
    }
  } catch {
    // Directory may not exist.
  }
  return undefined;
}

async function resolveCodexCommand(
  configured: string,
): Promise<string | undefined> {
  if (configured && configured !== 'codex') {
    if (isPathCommand(configured)) {
      return (await exists(configured)) ? configured : undefined;
    }
    return findCommandOnPath(configured);
  }

  const candidates = await codexCommandCandidates();

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (await exists(candidate)) {
      return candidate;
    }
  }

  return findCommandOnPath('codex');
}

function isPathCommand(command: string): boolean {
  return (
    path.isAbsolute(command) || command.includes('/') || command.includes('\\')
  );
}

async function codexCommandCandidates(): Promise<string[]> {
  const candidates: Array<string | undefined> = [
    ...npmCodexCandidates(),
    ...(await extensionCodexCandidates()),
  ];

  return candidates.filter((candidate): candidate is string =>
    Boolean(candidate),
  );
}

function npmCodexCandidates(): Array<string | undefined> {
  if (process.platform === 'win32') {
    return [
      process.env.APPDATA
        ? path.join(
            process.env.APPDATA,
            'npm',
            'node_modules',
            '@openai',
            'codex',
            'node_modules',
            '@openai',
            'codex-win32-x64',
            'vendor',
            'x86_64-pc-windows-msvc',
            'codex',
            'codex.exe',
          )
        : undefined,
      process.env.APPDATA
        ? path.join(process.env.APPDATA, 'npm', 'codex.exe')
        : undefined,
    ];
  }

  return [
    path.join(homeDir(), '.npm-global', 'bin', 'codex'),
    path.join(homeDir(), '.local', 'bin', 'codex'),
    '/opt/homebrew/bin/codex',
    '/usr/local/bin/codex',
  ];
}

async function extensionCodexCandidates(): Promise<Array<string | undefined>> {
  const roots = extensionRoots();
  const relativeParts = platformExtensionBinaryPaths();
  const candidates: Array<string | undefined> = [];

  for (const root of roots) {
    for (const relative of relativeParts) {
      candidates.push(await findFirstMatchingCodex(root, relative));
    }
  }

  return candidates;
}

function extensionRoots(): string[] {
  const home = homeDir();
  const roots = [
    path.join(home, '.vscode', 'extensions'),
    path.join(home, '.vscode-insiders', 'extensions'),
    path.join(home, '.cursor', 'extensions'),
  ];

  if (process.platform === 'darwin') {
    roots.push(
      path.join(
        home,
        'Library',
        'Application Support',
        'Code',
        'User',
        'globalStorage',
      ),
      path.join(
        home,
        'Library',
        'Application Support',
        'Cursor',
        'User',
        'globalStorage',
      ),
    );
  }

  return roots;
}

function platformExtensionBinaryPaths(): string[][] {
  if (process.platform === 'win32') {
    return [['bin', 'windows-x86_64', 'codex.exe']];
  }

  if (process.platform === 'darwin') {
    return [
      [
        'bin',
        process.arch === 'arm64' ? 'macos-aarch64' : 'macos-x86_64',
        'codex',
      ],
      [
        'bin',
        process.arch === 'arm64' ? 'darwin-aarch64' : 'darwin-x86_64',
        'codex',
      ],
    ];
  }

  return [
    [
      'bin',
      process.arch === 'arm64' ? 'linux-aarch64' : 'linux-x86_64',
      'codex',
    ],
    ['bin', process.arch === 'arm64' ? 'linux-arm64' : 'linux-x64', 'codex'],
  ];
}

function homeDir(): string {
  return process.env.HOME ?? process.env.USERPROFILE ?? '';
}

function fetchCodexRateLimits(
  command: string,
  activeProcesses: Set<ChildProcess>,
): Promise<RateLimitSnapshot> {
  return new Promise((resolve, reject) => {
    if (isWindowsCommandShim(command)) {
      reject(
        new Error(
          'codex.command must point to codex.exe, not a .cmd/.bat shim',
        ),
      );
      return;
    }

    const proc = spawn(command, ['app-server'], { stdio: 'pipe' });
    activeProcesses.add(proc);
    const rl = readline.createInterface({ input: proc.stdout });
    let settled = false;
    let stderr = '';

    const timer = setTimeout(() => {
      finish(
        new Error(`account/rateLimits/read timed out${stderrSuffix(stderr)}`),
      );
    }, START_TIMEOUT_MS + REQUEST_TIMEOUT_MS);

    const finish = (
      error: Error | undefined,
      value?: RateLimitSnapshot,
    ): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      rl.close();
      activeProcesses.delete(proc);
      killTree(proc);
      if (error) reject(error);
      else resolve(value!);
    };

    const send = (message: unknown): void => {
      if (!proc.stdin.writable) {
        finish(new Error('Codex app-server stdin is not writable'));
        return;
      }
      proc.stdin.write(`${JSON.stringify(message)}\n`);
    };

    proc.once('error', finish);
    proc.stdin.once('error', finish);
    proc.once('exit', (code, signal) => {
      if (!settled) {
        finish(
          new Error(
            `Codex app-server exited before responding (${signal ?? code ?? 'unknown'})${stderrSuffix(stderr)}`,
          ),
        );
      }
    });
    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
      if (stderr.length > 2000) stderr = stderr.slice(-2000);
    });

    rl.on('line', (line) => {
      let message: AppServerResponse;
      try {
        message = JSON.parse(line) as AppServerResponse;
      } catch {
        return;
      }

      if (message.id === 0) {
        if (message.error) {
          finish(
            new Error(message.error.message ?? JSON.stringify(message.error)),
          );
          return;
        }
        send({ method: 'initialized', params: {} });
        send({ method: 'account/rateLimits/read', id: 1 });
        return;
      }

      if (message.id === 1) {
        if (message.error) {
          finish(
            new Error(message.error.message ?? JSON.stringify(message.error)),
          );
          return;
        }
        const response = message.result as RateLimitsResponse;
        finish(
          undefined,
          response.rateLimitsByLimitId?.codex ?? response.rateLimits,
        );
      }
    });

    send({
      method: 'initialize',
      id: 0,
      params: {
        clientInfo: {
          name: 'ai_status_bar',
          title: 'AI Status Bar',
          version: getExtensionVersion(),
        },
        capabilities: {
          experimentalApi: true,
        },
      },
    });
  });
}

function killTree(proc: ChildProcess): void {
  if (proc.killed || proc.pid === undefined) return;
  if (process.platform === 'win32') {
    execFile(
      'taskkill',
      ['/pid', String(proc.pid), '/T', '/F'],
      () => undefined,
    );
    return;
  }
  proc.kill();
}

function stderrSuffix(stderr: string): string {
  const trimmed = stderr.trim();
  return trimmed ? `; stderr: ${trimmed.slice(-300)}` : '';
}

function creditText(credits: CreditsSnapshot): string {
  if (credits.unlimited) return 'unlimited';
  if (credits.hasCredits) return credits.balance ?? 'available';
  return 'none';
}
