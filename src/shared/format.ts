import { AgentNameStyle, PresentationMode, StatusBarStyle } from './types';

export const CAUTION_AT = 70;
export const WARN_AT = 90;

const CURRENCY: Record<string, string> = {
  EUR: '€',
  GBP: '£',
  USD: '$',
};

export function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function pctShort(value: number | undefined): string {
  return value === undefined ? '-' : `${Math.round(value)}%`;
}

export function meter(value: number | undefined, cells = 10, fill = '▰', empty = '▱'): string {
  if (value === undefined) return empty.repeat(cells);
  const filled = Math.round((clampPercent(value) / 100) * cells);
  return fill.repeat(filled) + empty.repeat(cells - filled);
}

export function remaining(used: number | undefined): number | undefined {
  return used === undefined ? undefined : Math.max(0, 100 - used);
}

export function presentationPercent(
  used: number | undefined,
  mode: PresentationMode,
): number | undefined {
  return mode === 'remaining' ? remaining(used) : used;
}

export function dot(used: number | undefined, caution = CAUTION_AT, warn = WARN_AT): string {
  if (used === undefined) return '○';
  if (used >= warn) return '🔴';
  if (used >= caution) return '🟡';
  return '🟢';
}

export function formatReset(
  value: string | number | null | undefined,
  locale: string | undefined,
  withDate: boolean,
): string {
  if (value === null || value === undefined || value === '') return '';
  const date = typeof value === 'number' ? new Date(value * 1000) : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return withDate
    ? date.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
    : date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

export function money(minor: number, currency = 'USD', decimals = 2): string {
  const symbol = CURRENCY[currency] ?? `${currency} `;
  return `${symbol}${(minor / 10 ** decimals).toFixed(decimals)}`;
}

export function statusPart(
  label: string,
  used: number | undefined,
  opts: {
    style: StatusBarStyle;
    mode: PresentationMode;
    cells: number;
    cautionAt: number;
    warnAt: number;
  },
): string {
  const display = presentationPercent(used, opts.mode);
  const dotGlyph = dot(used, opts.cautionAt, opts.warnAt);

  return opts.style === 'compact'
    ? `${dotGlyph} ${label}: ${pctShort(display)}`
    : `${dotGlyph} ${label} ${meter(display, opts.cells)} ${pctShort(display)}`;
}

export function agentPrefix(label: string, icon: string, style: AgentNameStyle): string {
  switch (style) {
    case 'icon':
      return `$(${icon}) · `;
    case 'both':
      return `$(${icon}) ${label}: `;
    case 'text':
    default:
      return `${label}: `;
  }
}

export function escapeMarkdown(value: string | undefined): string {
  if (!value) return '';
  return value.replace(/[\\`*_{}[\]()#+\-.!|]/g, '\\$&');
}
