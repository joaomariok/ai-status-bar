import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseClaudeCredentials } from '../agents/claudeCredentials';

test('extracts nested OAuth credentials and formats subscription with tier', () => {
  const result = parseClaudeCredentials(JSON.stringify({
    claudeAiOauth: {
      accessToken: 'nested-token',
      subscriptionType: 'pro',
      rateLimitTier: 'tier_2',
    },
  }));

  assert.deepEqual(result, { accessToken: 'nested-token', plan: 'pro (tier_2)' });
});

test('falls back to a legacy top-level access token', () => {
  const result = parseClaudeCredentials(JSON.stringify({ accessToken: 'legacy-token' }));

  assert.deepEqual(result, { accessToken: 'legacy-token', plan: undefined });
});

test('uses the available subscription metadata when the other value is absent', () => {
  const withSubscription = parseClaudeCredentials(JSON.stringify({
    claudeAiOauth: { subscriptionType: 'max' },
  }));
  const withTier = parseClaudeCredentials(JSON.stringify({
    claudeAiOauth: { rateLimitTier: 'tier_3' },
  }));

  assert.equal(withSubscription?.plan, 'max');
  assert.equal(withTier?.plan, 'tier_3');
});

test('trims metadata and omits a plan when both values are blank', () => {
  const result = parseClaudeCredentials(JSON.stringify({
    claudeAiOauth: {
      subscriptionType: '  pro  ',
      rateLimitTier: '   ',
    },
  }));
  const blank = parseClaudeCredentials(JSON.stringify({
    claudeAiOauth: { subscriptionType: ' ', rateLimitTier: '' },
  }));

  assert.equal(result?.plan, 'pro');
  assert.equal(blank?.plan, undefined);
});

test('returns undefined for malformed credential JSON', () => {
  assert.equal(parseClaudeCredentials('{not json'), undefined);
});
