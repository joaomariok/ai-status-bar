import type { AgentProvider } from './types';

type WindowSlot = 'fiveHour' | 'weekly';

const defaultWindowLabels: Record<WindowSlot, string> = {
  fiveHour: '5h',
  weekly: '7d',
};

export function resolveWindowLabel(
  labels: AgentProvider['windowLabels'] | undefined,
  slot: WindowSlot,
): string {
  return labels?.[slot] ?? defaultWindowLabels[slot];
}
