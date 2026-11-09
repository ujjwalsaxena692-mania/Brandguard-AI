import { useSyncExternalStore } from 'react'
import { getDemoKnowledgeEntries } from '@/data/demo/knowledge'
import { getApprovalBlockers } from '@/lib/knowledge'
import type { KnowledgeEntry, KnowledgeInput, KnowledgeStatus } from '@/types/knowledge'

/**
 * Client-side store for Knowledge Hub entries, seeded from the demo data layer.
 *
 * Changes live in memory only: they survive navigating between pages but are
 * lost on refresh, and nothing is sent to a backend. Replace this module with
 * real API calls later; the exported action signatures can stay the same.
 */
let entries: KnowledgeEntry[] = getDemoKnowledgeEntries()
let counter = 0
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot() {
  return entries
}

function normalise(input: KnowledgeInput) {
  return {
    title: input.title.trim(),
    category: input.category,
    subtype: input.subtype,
    description: input.description.trim(),
    source: input.source.trim(),
    evidence: input.category === 'claims' ? input.evidence.trim() : '',
    status: input.status,
    validUntil: input.validUntil || null,
  }
}

export function addEntry(input: KnowledgeInput): KnowledgeEntry {
  const now = new Date().toISOString()
  counter += 1
  const entry: KnowledgeEntry = {
    id: `kn-${Date.now().toString(36)}-${counter}`,
    ...normalise(input),
    createdAt: now,
    updatedAt: now,
    approvedAt: input.status === 'approved' ? now : null,
  }
  entries = [entry, ...entries]
  emit()
  return entry
}

export function updateEntry(id: string, input: KnowledgeInput): void {
  const now = new Date().toISOString()
  entries = entries.map((entry) => {
    if (entry.id !== id) return entry
    const next = normalise(input)
    const approvedAt =
      next.status !== 'approved' ? null : entry.status === 'approved' && entry.approvedAt ? entry.approvedAt : now
    return { ...entry, ...next, updatedAt: now, approvedAt }
  })
  emit()
}

export function removeEntry(id: string): void {
  entries = entries.filter((entry) => entry.id !== id)
  emit()
}

export type StatusChangeResult = { ok: true } | { ok: false; message: string }

/** Moves an entry to a new status. Approval is always an explicit action and is blocked if requirements are unmet. */
export function changeStatus(id: string, next: KnowledgeStatus): StatusChangeResult {
  const current = entries.find((entry) => entry.id === id)
  if (!current) return { ok: false, message: 'This entry no longer exists.' }
  if (next === 'approved') {
    const blockers = getApprovalBlockers(current)
    if (blockers.length > 0) return { ok: false, message: blockers.map((blocker) => blocker.message).join(' ') }
  }
  const now = new Date().toISOString()
  entries = entries.map((entry) =>
    entry.id === id ? { ...entry, status: next, updatedAt: now, approvedAt: next === 'approved' ? now : null } : entry,
  )
  emit()
  return { ok: true }
}

export function useKnowledgeEntries(): KnowledgeEntry[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
