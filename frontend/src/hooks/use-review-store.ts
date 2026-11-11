import { useSyncExternalStore } from 'react'
import { getDemoReviewRecords } from '@/data/demo/reviews'
import { applyDecision } from '@/lib/review'
import type { DecisionInput, DecisionResult, ReviewRecord } from '@/types/review'

/**
 * In-memory store for review records, seeded from the demo data layer.
 *
 * Decisions survive navigating between pages but are lost on refresh, and nothing is sent to a
 * backend. Replace this module with real API calls later. Every decision goes through `applyDecision`,
 * which re-checks the record's current status, so a duplicate or stale submission is rejected here
 * even if the UI let it through.
 */
let records: ReviewRecord[] = getDemoReviewRecords()

const listeners = new Set<() => void>()
const emit = () => listeners.forEach((listener) => listener())

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const getSnapshot = () => records

/** Records a human reviewer's decision. Returns an error instead of changing anything when it is not allowed. */
export function recordDecision(input: DecisionInput): DecisionResult {
  const record = records.find((item) => item.id === input.reviewId)
  if (!record) return { ok: false, message: 'This review record no longer exists.' }
  const result = applyDecision(record, input, new Date().toISOString())
  if (result.ok) {
    records = records.map((item) => (item.id === record.id ? result.record : item))
    emit()
  }
  return result
}

/** Discards every decision made in this tab and restores the demo records. */
export function resetReviewDemoState(): void {
  records = getDemoReviewRecords()
  emit()
}

export function useReviewRecords(): ReviewRecord[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
