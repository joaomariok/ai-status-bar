export type PresentationMode = 'used' | 'remaining';
export type ConfiguredPresentationMode = PresentationMode | 'agentDefault';
export type StatusBarStyle = 'full' | 'compact';
export type AgentNameStyle = 'text' | 'icon' | 'both';

export interface AgentDetection {
  available: boolean;
  reason?: string;
}

export interface UsageWindow {
  usedPercent: number;
  resetsAt?: string | number | null;
}

export interface CreditUsage {
  used?: number;
  limit?: number;
  currency?: string;
  decimals?: number;
  text?: string;
  usedPercent?: number;
}

export interface AgentUsage {
  plan?: string;
  fiveHour?: UsageWindow;
  weekly?: UsageWindow;
  credits?: CreditUsage;
  limitReached?: boolean;
  windowLabels?: AgentProvider['windowLabels'];
}

export interface AgentProvider {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
  readonly tooltipTitle: string;
  readonly defaultPresentationMode: PresentationMode;
  readonly windowLabels?: {
    readonly fiveHour?: string;
    readonly weekly?: string;
    readonly fiveHourTooltip?: string;
    readonly weeklyTooltip?: string;
    readonly fiveHourResetWithDate?: boolean;
    readonly weeklyResetWithDate?: boolean;
  };
  dispose?(): void;
  isEnabled(): boolean;
  detect(): Promise<AgentDetection>;
  fetchUsage(): Promise<AgentUsage>;
}

export interface AgentSettings {
  pollMs: number;
  cells: number;
  showWeekly: boolean;
  replacePrimaryWithWeeklyOnLimit: boolean;
  cautionAt: number;
  warnAt: number;
  locale: string | undefined;
  presentationMode: ConfiguredPresentationMode;
  statusBarStyle: StatusBarStyle;
  agentNameStyle: AgentNameStyle;
}
