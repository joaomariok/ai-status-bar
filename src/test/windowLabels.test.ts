import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveWindowLabel } from '../shared/windowLabels';

test('uses 7d as the secondary window label when no label is supplied', () => {
  assert.equal(resolveWindowLabel(undefined, 'weekly'), '7d');
});

test('uses a supplied secondary window label instead of the default', () => {
  assert.equal(resolveWindowLabel({ weekly: 'Monthly' }, 'weekly'), 'Monthly');
});
