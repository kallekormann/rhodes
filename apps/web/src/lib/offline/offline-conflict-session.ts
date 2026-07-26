/**
 * Pure helpers for ending an offline conflict review session (Requirement D).
 * Keep this free of React so unit tests can lock the teardown contract.
 */

export type ConflictReviewSessionSnapshot = {
  reviewPending: boolean;
  conflictCount: number;
  clusterCount: number;
  reviewCount: number;
  armed: boolean;
  mineLocked: boolean;
  workingBlockCount: number;
};

export type ConflictReviewSessionCleared = {
  reviewPending: false;
  conflictCount: 0;
  clusterCount: 0;
  reviewCount: 0;
  armed: false;
  mineLocked: false;
  workingBlockCount: 0;
};

/** Atomic cleared UI/session snapshot after endConflictReviewSession. */
export function clearedConflictReviewSession(): ConflictReviewSessionCleared {
  return {
    reviewPending: false,
    conflictCount: 0,
    clusterCount: 0,
    reviewCount: 0,
    armed: false,
    mineLocked: false,
    workingBlockCount: 0,
  };
}

export function isConflictReviewSessionCleared(
  snapshot: ConflictReviewSessionSnapshot,
): boolean {
  return (
    snapshot.reviewPending === false &&
    snapshot.conflictCount === 0 &&
    snapshot.clusterCount === 0 &&
    snapshot.reviewCount === 0 &&
    snapshot.armed === false &&
    snapshot.mineLocked === false &&
    snapshot.workingBlockCount === 0
  );
}
