import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveCookingJob,
  resolveMeatSpoilage,
  seasoningExpiresAt,
  shouldRefreshShop,
  spoilageDueAtForState
} from '../src/lib/game/time.mjs';

test('cooking auto-stops at target after offline time', () => {
  const job = resolveCookingJob(
    {
      cookingCompleted: false,
      targetCookingState: 'well_cooked',
      cookingTargetEndAt: '2026-06-10T08:30:00.000Z'
    },
    '2026-06-10T10:00:00.000Z'
  );

  assert.equal(job.cookingCompleted, true);
  assert.equal(job.cookingCompletedAt, '2026-06-10T08:30:00.000Z');
  assert.equal(job.resolvedState, 'well_cooked');
});

test('raw meat does not receive spoilage timer and cooked meat spoils after three days', () => {
  assert.equal(spoilageDueAtForState('raw', '2026-06-10T08:30:00.000Z'), null);
  assert.equal(
    spoilageDueAtForState('perfectly_cooked', '2026-06-10T08:30:00.000Z'),
    '2026-06-13T08:30:00.000Z'
  );
});

test('offline spoilage uses absolute timestamps', () => {
  const meat = resolveMeatSpoilage(
    {
      currentCookingState: 'cooked',
      spoilageDueAt: '2026-06-13T08:30:00.000Z'
    },
    '2026-06-14T08:30:00.000Z'
  );

  assert.equal(meat.currentCookingState, 'spoiled');
  assert.equal(meat.spoiledAt, '2026-06-13T08:30:00.000Z');
});

test('shop refreshes use real due timestamps', () => {
  assert.equal(
    shouldRefreshShop(
      { refreshDueAt: '2026-06-10T08:30:00.000Z' },
      '2026-06-10T08:29:59.000Z'
    ),
    false
  );
  assert.equal(
    shouldRefreshShop(
      { refreshDueAt: '2026-06-10T08:30:00.000Z' },
      '2026-06-10T08:30:00.000Z'
    ),
    true
  );
});

test('seasonings do not expire', () => {
  assert.equal(seasoningExpiresAt(), null);
});
