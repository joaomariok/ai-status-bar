import { isWindowsCommandShim } from './codexCommand';
import { AgentDetection } from '../shared/types';

export function detectCodexAvailability(
  command: string | undefined,
  platform = process.platform,
): AgentDetection {
  if (!command) {
    return { available: false, reason: 'Codex executable not found' };
  }

  if (isWindowsCommandShim(command, platform)) {
    return {
      available: false,
      reason: 'codex.command must point to codex.exe, not a .cmd/.bat shim',
    };
  }

  return { available: true };
}
