import { useCallback, useSyncExternalStore } from 'react'
import {
  acceptSuggestion,
  createSession,
  markDraftSaved,
  markReadyForReview,
  reconsiderSuggestion,
  rejectSuggestion,
  resetSession,
  setText,
  undoLastCorrection,
} from '@/lib/correction'
import type { ActionResult, CorrectionCase, EditorSession } from '@/types/correction'

/**
 * In-memory store for editor sessions, one per case.
 *
 * Sessions survive navigating between pages but are lost on refresh, and
 * nothing is sent to a backend. "Save draft" only records a marker in this
 * store. Replace this module with real API calls later.
 */
let sessions: Record<string, EditorSession> = {}

const listeners = new Set<() => void>()
const emit = () => listeners.forEach((listener) => listener())

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const getSnapshot = () => sessions

function write(caseId: string, session: EditorSession) {
  sessions = { ...sessions, [caseId]: session }
  emit()
}

/**
 * Read-only view of every editor session, keyed by case ID. Other modules (such as Review & Approval)
 * use it to show the current state of the corrected content without being able to change it.
 */
export function useCorrectionSessions(): Readonly<Record<string, EditorSession>> {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export interface CorrectionActions {
  editText: (text: string) => void
  accept: (suggestionId: string) => ActionResult
  reject: (suggestionId: string) => ActionResult
  reconsider: (suggestionId: string) => ActionResult
  undo: () => ActionResult
  reset: () => void
  saveDraft: () => void
  markReady: () => ActionResult
}

/** The working session for a case, plus the actions that change it. */
export function useCorrectionSession(correctionCase: CorrectionCase): { session: EditorSession; actions: CorrectionActions } {
  const all = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  // Created lazily without notifying anyone: a fresh session is just the original content.
  const session = all[correctionCase.id] ?? createSession(correctionCase)
  const caseId = correctionCase.id

  const current = useCallback(() => sessions[caseId] ?? createSession(correctionCase), [caseId, correctionCase])

  const run = useCallback(
    (step: (session: EditorSession) => ActionResult): ActionResult => {
      const result = step(current())
      if (result.ok) write(caseId, result.session)
      return result
    },
    [caseId, current],
  )

  const findSuggestion = useCallback(
    (suggestionId: string) => correctionCase.suggestions.find((item) => item.id === suggestionId),
    [correctionCase],
  )

  const actions: CorrectionActions = {
    editText: (text) => write(caseId, setText(current(), text)),
    accept: (suggestionId) => {
      const suggestion = findSuggestion(suggestionId)
      return suggestion ? run((s) => acceptSuggestion(s, suggestion)) : { ok: false, message: 'This suggestion no longer exists.' }
    },
    reject: (suggestionId) => run((s) => rejectSuggestion(s, suggestionId)),
    reconsider: (suggestionId) => run((s) => reconsiderSuggestion(s, suggestionId)),
    undo: () => run((s) => undoLastCorrection(s, correctionCase.suggestions)),
    reset: () => write(caseId, resetSession(correctionCase)),
    saveDraft: () => write(caseId, markDraftSaved(current(), new Date().toISOString())),
    markReady: () => run((s) => markReadyForReview(s, new Date().toISOString())),
  }

  return { session, actions }
}
