import { useSyncExternalStore } from 'react'
import { getDemoSubmissions } from '@/data/demo/submissions'
import type { ContentSubmission, SubmissionInput } from '@/types/submission'

/**
 * Client-side store for content submissions, seeded from the demo data layer.
 *
 * Records live in memory only: they survive navigating between pages (so the
 * Analysis Reports page can read them later) but are lost on refresh, and
 * nothing is sent to a backend. Replace this module with real API calls later.
 */
let submissions: ContentSubmission[] = getDemoSubmissions()

function seqOf(id: string): number {
  const n = Number.parseInt(id.split('-')[2] ?? '', 10)
  return Number.isNaN(n) ? 0 : n
}

// Only ever increases, so an ID is never reused even after a draft is deleted.
let lastSeq = submissions.reduce((max, item) => Math.max(max, seqOf(item.id)), 0)

const listeners = new Set<() => void>()
const emit = () => listeners.forEach((listener) => listener())

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot() {
  return submissions
}

function nextId(): string {
  lastSeq += 1
  return `SUB-${new Date().getFullYear()}-${String(lastSeq).padStart(4, '0')}`
}

function fieldsFrom({ values, attachments }: SubmissionInput) {
  return {
    title: values.title.trim(),
    contentType: values.contentType || null,
    contentText: values.contentText,
    campaignName: values.campaignName.trim(),
    targetAudience: values.targetAudience.trim(),
    platform: values.platform,
    publishingDate: values.publishingDate,
    reviewerContext: values.reviewerContext.trim(),
    attachments,
  }
}

function write(input: SubmissionInput, existingId: string | null, submit: boolean): ContentSubmission {
  const now = new Date().toISOString()
  const existing = existingId ? submissions.find((item) => item.id === existingId && item.status === 'draft') : undefined

  const record: ContentSubmission = existing
    ? { ...existing, ...fieldsFrom(input), updatedAt: now, status: submit ? 'submitted' : 'draft', submittedAt: submit ? now : null }
    : {
        id: nextId(),
        ...fieldsFrom(input),
        status: submit ? 'submitted' : 'draft',
        createdAt: now,
        updatedAt: now,
        submittedAt: submit ? now : null,
      }

  submissions = existing ? submissions.map((item) => (item.id === record.id ? record : item)) : [record, ...submissions]
  emit()
  return record
}

/** Creates a draft, or updates the draft with `existingId`. */
export function saveDraft(input: SubmissionInput, existingId: string | null): ContentSubmission {
  return write(input, existingId, false)
}

/** Records a submission (new, or converting the draft with `existingId`). Never approves or analyses anything. */
export function submitContent(input: SubmissionInput, existingId: string | null): ContentSubmission {
  return write(input, existingId, true)
}

/** Only drafts can be deleted; submitted records are kept. */
export function removeDraft(id: string): void {
  submissions = submissions.filter((item) => !(item.id === id && item.status === 'draft'))
  emit()
}

export function useSubmissions(): ContentSubmission[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
