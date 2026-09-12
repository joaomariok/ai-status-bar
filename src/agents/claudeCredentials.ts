export interface ClaudeCredentials {
  accessToken?: string;
  plan?: string;
}

export function parseClaudeCredentials(raw: string): ClaudeCredentials | undefined {
  try {
    const credentials = asRecord(JSON.parse(raw));
    if (!credentials) return undefined;

    const oauth = asRecord(credentials.claudeAiOauth);
    const subscriptionType = readString(oauth?.subscriptionType);
    const rateLimitTier = readString(oauth?.rateLimitTier);

    return {
      accessToken: readString(oauth?.accessToken) ?? readString(credentials.accessToken),
      plan: formatPlan(subscriptionType, rateLimitTier),
    };
  } catch {
    return undefined;
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function formatPlan(subscriptionType: string | undefined, rateLimitTier: string | undefined): string | undefined {
  if (subscriptionType && rateLimitTier) return `${subscriptionType} (${rateLimitTier})`;
  return subscriptionType ?? rateLimitTier;
}
