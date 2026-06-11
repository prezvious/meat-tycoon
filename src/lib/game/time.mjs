export const COOKED_STATES = new Set(['cooked', 'well_cooked', 'perfectly_cooked']);
export const SPOILAGE_MS = 3 * 24 * 60 * 60 * 1000;

export function addMilliseconds(isoDate, milliseconds) {
  return new Date(new Date(isoDate).getTime() + milliseconds).toISOString();
}

export function resolveCookingJob(job, nowIso = new Date().toISOString()) {
  const now = new Date(nowIso).getTime();
  const targetEnd = new Date(job.cookingTargetEndAt).getTime();

  if (job.cookingCompleted || now < targetEnd) {
    return { ...job, cookingCompleted: Boolean(job.cookingCompleted) };
  }

  return {
    ...job,
    cookingCompleted: true,
    cookingCompletedAt: job.cookingTargetEndAt,
    resolvedState: job.targetCookingState
  };
}

export function spoilageStartsForState(cookingState, completedAtIso) {
  if (!COOKED_STATES.has(cookingState)) {
    return null;
  }

  return completedAtIso;
}

export function spoilageDueAtForState(cookingState, completedAtIso) {
  const spoilageStartedAt = spoilageStartsForState(cookingState, completedAtIso);
  if (!spoilageStartedAt) {
    return null;
  }

  return addMilliseconds(spoilageStartedAt, SPOILAGE_MS);
}

export function resolveMeatSpoilage(meat, nowIso = new Date().toISOString()) {
  if (!meat.spoilageDueAt || meat.currentCookingState === 'spoiled') {
    return { ...meat };
  }

  const now = new Date(nowIso).getTime();
  const dueAt = new Date(meat.spoilageDueAt).getTime();
  if (now < dueAt) {
    return { ...meat };
  }

  return {
    ...meat,
    currentCookingState: 'spoiled',
    spoiledAt: meat.spoilageDueAt
  };
}

export function shouldRefreshShop(shopState, nowIso = new Date().toISOString()) {
  if (!shopState.refreshDueAt) {
    return false;
  }

  return new Date(nowIso).getTime() >= new Date(shopState.refreshDueAt).getTime();
}

export function seasoningExpiresAt() {
  return null;
}
