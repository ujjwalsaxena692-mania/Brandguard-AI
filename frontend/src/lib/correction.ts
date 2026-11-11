import { countWords } from '@/lib/submission'
import type {
  ActionResult,
  Applicability,
  ChangeStats,
  CorrectionCase,
  CorrectionSuggestion,
  DiffHunk,
  EditorSession,
  SuggestionCategory,
  SuggestionFilter,
  SuggestionStatus,
  WorkflowStatus,
} from '@/types/correction'

export { countWords }

export const CATEGORY_LABELS: Record<SuggestionCategory, string> = {
  contradicted_claim: 'Contradicted claim',
  unsupported_claim: 'Unsupported claim',
  terminology: 'Terminology',
  tone_voice: 'Tone and voice',
  brand_guideline: 'Brand guideline',
  promotional_claim: 'Promotional claim',
}

export const STATUS_LABELS: Record<SuggestionStatus, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  rejected: 'Rejected',
}

export const FILTERS: readonly SuggestionFilter[] = ['all', 'pending', 'accepted', 'rejected']

export const FILTER_LABELS: Record<SuggestionFilter, string> = {
  all: 'All',
  pending: 'Pending',
  accepted: 'Accepted',
  rejected: 'Rejected',
}

/** No label here ever says "approved": a human reviewer decides that elsewhere. */
export const WORKFLOW_LABELS: Record<WorkflowStatus, string> = {
  in_progress: 'Corrections in progress',
  draft_saved: 'Draft saved',
  ready_for_review: 'Ready for human review',
}

export const CONFLICT_MISSING =
  'This text is no longer in the corrected content, so the suggestion cannot be applied. It may have been changed by another suggestion or by a manual edit. Restore the original wording, or reject this suggestion.'

export const conflictAmbiguous = (count: number) =>
  `The original wording now appears ${count} times in the corrected content, so it is unclear which one to change. Edit the text manually, or reject this suggestion.`

export function conflictMessage(applicability: Applicability): string | null {
  if (applicability.state === 'missing') return CONFLICT_MISSING
  if (applicability.state === 'ambiguous') return conflictAmbiguous(applicability.count)
  return null
}

/** Counts occurrences of `needle`, including overlapping ones, so ambiguity is never under-reported. */
export function countOccurrences(haystack: string, needle: string): number {
  if (needle === '') return 0
  let count = 0
  let from = 0
  for (;;) {
    const index = haystack.indexOf(needle, from)
    if (index === -1) return count
    count += 1
    from = index + 1
  }
}

export function getApplicability(text: string, suggestion: Pick<CorrectionSuggestion, 'originalText'>): Applicability {
  const count = countOccurrences(text, suggestion.originalText)
  if (count === 0) return { state: 'missing' }
  if (count > 1) return { state: 'ambiguous', count }
  return { state: 'applicable' }
}

/** Splice by index (not String.replace) so "$" in replacement text is never treated as a pattern. */
function replaceOnce(text: string, find: string, replacement: string): string {
  const index = text.indexOf(find)
  return text.slice(0, index) + replacement + text.slice(index + find.length)
}

// ---------------------------------------------------------------------------
// Session transitions. All pure: they return a new session or a failure message.
// ---------------------------------------------------------------------------

export function createSession(correctionCase: Pick<CorrectionCase, 'originalContent' | 'suggestions'>): EditorSession {
  return {
    text: correctionCase.originalContent,
    statuses: Object.fromEntries(correctionCase.suggestions.map((item) => [item.id, 'pending' as const])),
    history: [],
    workflow: 'in_progress',
    savedAt: null,
    markedReadyAt: null,
  }
}

/** Any change to the content or to a decision drops a saved or ready marker: that version was not the one saved. */
function edited(session: EditorSession, patch: Partial<EditorSession>): EditorSession {
  return { ...session, ...patch, workflow: 'in_progress', markedReadyAt: null }
}

export function setText(session: EditorSession, text: string): EditorSession {
  return text === session.text ? session : edited(session, { text })
}

export function acceptSuggestion(session: EditorSession, suggestion: CorrectionSuggestion): ActionResult {
  const status = session.statuses[suggestion.id]
  if (status === 'accepted') return { ok: false, message: 'This suggestion has already been applied.' }
  if (status === 'rejected') return { ok: false, message: 'Reconsider this rejected suggestion before accepting it.' }

  const message = conflictMessage(getApplicability(session.text, suggestion))
  if (message) return { ok: false, message }

  const text = replaceOnce(session.text, suggestion.originalText, suggestion.suggestedText)
  return {
    ok: true,
    session: edited(session, {
      text,
      statuses: { ...session.statuses, [suggestion.id]: 'accepted' },
      history: [...session.history, { suggestionId: suggestion.id, textBefore: session.text, textAfter: text }],
    }),
  }
}

export function rejectSuggestion(session: EditorSession, suggestionId: string): ActionResult {
  if (session.statuses[suggestionId] !== 'pending') {
    return { ok: false, message: 'Only pending suggestions can be rejected.' }
  }
  return { ok: true, session: edited(session, { statuses: { ...session.statuses, [suggestionId]: 'rejected' } }) }
}

/** Puts a rejected suggestion back to pending. It never changes the text. */
export function reconsiderSuggestion(session: EditorSession, suggestionId: string): ActionResult {
  if (session.statuses[suggestionId] !== 'rejected') {
    return { ok: false, message: 'Only rejected suggestions can be reconsidered.' }
  }
  return { ok: true, session: edited(session, { statuses: { ...session.statuses, [suggestionId]: 'pending' } }) }
}

export type UndoPlan = { ok: true; suggestionId: string; text: string } | { ok: false; reason: string }

/**
 * Plans undoing the most recent accepted suggestion.
 * - Text unchanged since it was applied: restore the exact earlier text.
 * - Text edited since: only if the applied wording is still found exactly once, so manual edits elsewhere are kept.
 * - Otherwise undo is refused rather than guessing.
 */
export function planUndo(session: EditorSession, suggestions: readonly CorrectionSuggestion[]): UndoPlan {
  const last = session.history[session.history.length - 1]
  if (!last) return { ok: false, reason: 'There is no accepted correction to undo.' }
  if (session.text === last.textAfter) return { ok: true, suggestionId: last.suggestionId, text: last.textBefore }

  const suggestion = suggestions.find((item) => item.id === last.suggestionId)
  if (suggestion && suggestion.suggestedText !== '' && countOccurrences(session.text, suggestion.suggestedText) === 1) {
    return { ok: true, suggestionId: last.suggestionId, text: replaceOnce(session.text, suggestion.suggestedText, suggestion.originalText) }
  }
  return {
    ok: false,
    reason: 'The content was edited after this correction, so it cannot be undone safely. Edit the text directly, or reset to the original.',
  }
}

export function undoLastCorrection(session: EditorSession, suggestions: readonly CorrectionSuggestion[]): ActionResult {
  const plan = planUndo(session, suggestions)
  if (!plan.ok) return { ok: false, message: plan.reason }
  return {
    ok: true,
    session: edited(session, {
      text: plan.text,
      statuses: { ...session.statuses, [plan.suggestionId]: 'pending' },
      history: session.history.slice(0, -1),
    }),
  }
}

export function resetSession(correctionCase: Pick<CorrectionCase, 'originalContent' | 'suggestions'>): EditorSession {
  return createSession(correctionCase)
}

export function markDraftSaved(session: EditorSession, now: string): EditorSession {
  return { ...session, workflow: 'draft_saved', savedAt: now, markedReadyAt: null }
}

/** Ready for human review. This is a hand-off marker, never an approval. */
export function markReadyForReview(session: EditorSession, now: string): ActionResult {
  if (session.text.trim() === '') return { ok: false, message: 'The corrected content is empty, so it cannot be marked ready.' }
  return { ok: true, session: { ...session, workflow: 'ready_for_review', savedAt: now, markedReadyAt: now } }
}

// ---------------------------------------------------------------------------
// Derived values
// ---------------------------------------------------------------------------

export function countStatuses(
  suggestions: readonly CorrectionSuggestion[],
  statuses: Record<string, SuggestionStatus>,
): Record<SuggestionStatus, number> {
  const counts: Record<SuggestionStatus, number> = { pending: 0, accepted: 0, rejected: 0 }
  for (const item of suggestions) counts[statuses[item.id] ?? 'pending'] += 1
  return counts
}

export function filterSuggestions(
  suggestions: readonly CorrectionSuggestion[],
  statuses: Record<string, SuggestionStatus>,
  filter: SuggestionFilter,
): CorrectionSuggestion[] {
  return filter === 'all' ? [...suggestions] : suggestions.filter((item) => (statuses[item.id] ?? 'pending') === filter)
}

/** What the text would be if only the accepted suggestions had been applied, or null if they no longer replay cleanly. */
export function replayAccepted(
  originalContent: string,
  history: EditorSession['history'],
  suggestions: readonly CorrectionSuggestion[],
): string | null {
  let text = originalContent
  for (const entry of history) {
    const suggestion = suggestions.find((item) => item.id === entry.suggestionId)
    if (!suggestion || getApplicability(text, suggestion).state !== 'applicable') return null
    text = replaceOnce(text, suggestion.originalText, suggestion.suggestedText)
  }
  return text
}

export function hasManualEdits(correctionCase: CorrectionCase, session: EditorSession): boolean {
  return session.text !== replayAccepted(correctionCase.originalContent, session.history, correctionCase.suggestions)
}

export function hasAnyChange(correctionCase: CorrectionCase, session: EditorSession): boolean {
  return (
    session.text !== correctionCase.originalContent ||
    Object.values(session.statuses).some((status) => status !== 'pending')
  )
}

export function getStatusLabel(correctionCase: CorrectionCase, session: EditorSession): string {
  if (session.workflow !== 'in_progress') return WORKFLOW_LABELS[session.workflow]
  return hasAnyChange(correctionCase, session) ? WORKFLOW_LABELS.in_progress : 'Not started'
}

/**
 * Suggestions whose target text overlaps another suggestion's target in the ORIGINAL content.
 * Accepting one of them will make the other a conflict, so the UI warns about it up front.
 * Maps a suggestion ID to the IDs it overlaps with (suggestions without overlaps are absent).
 */
export function findOverlaps(
  originalContent: string,
  suggestions: readonly CorrectionSuggestion[],
): Record<string, string[]> {
  const ranges = suggestions
    .map((item) => {
      const start = originalContent.indexOf(item.originalText)
      return start === -1 || item.originalText === '' ? null : { id: item.id, start, end: start + item.originalText.length }
    })
    .filter((range): range is { id: string; start: number; end: number } => range !== null)

  const overlaps: Record<string, string[]> = {}
  for (const a of ranges) {
    for (const b of ranges) {
      if (a.id !== b.id && a.start < b.end && b.start < a.end) (overlaps[a.id] ??= []).push(b.id)
    }
  }
  return overlaps
}

// ---------------------------------------------------------------------------
// Word-level diff
// ---------------------------------------------------------------------------

type Op = { t: 'eq' | 'del' | 'ins'; v: string }

/** Words and whitespace as separate tokens, so line breaks survive the round trip. */
const tokenize = (text: string): string[] => text.split(/(\s+)/).filter((token) => token !== '')

// Above this many table cells the exact diff is skipped for a coarse one, so typing never freezes the page.
const MAX_DIFF_CELLS = 2_000_000

function diffOps(a: string[], b: string[]): Op[] {
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start += 1
  let endA = a.length
  let endB = b.length
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA -= 1
    endB -= 1
  }

  const head: Op[] = a.slice(0, start).map((v) => ({ t: 'eq', v }))
  const tail: Op[] = a.slice(endA).map((v) => ({ t: 'eq', v }))
  const midA = a.slice(start, endA)
  const midB = b.slice(start, endB)
  const n = midA.length
  const m = midB.length

  if (n === 0 || m === 0 || (n + 1) * (m + 1) > MAX_DIFF_CELLS) {
    return [
      ...head,
      ...midA.map((v): Op => ({ t: 'del', v })),
      ...midB.map((v): Op => ({ t: 'ins', v })),
      ...tail,
    ]
  }

  // Longest common subsequence table, filled from the end so the walk below runs forwards.
  const width = m + 1
  const table = new Uint32Array((n + 1) * width)
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      table[i * width + j] =
        midA[i] === midB[j] ? table[(i + 1) * width + j + 1] + 1 : Math.max(table[(i + 1) * width + j], table[i * width + j + 1])
    }
  }

  const middle: Op[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (midA[i] === midB[j]) {
      middle.push({ t: 'eq', v: midA[i] })
      i += 1
      j += 1
    } else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) {
      middle.push({ t: 'del', v: midA[i] })
      i += 1
    } else {
      middle.push({ t: 'ins', v: midB[j] })
      j += 1
    }
  }
  while (i < n) middle.push({ t: 'del', v: midA[i++] })
  while (j < m) middle.push({ t: 'ins', v: midB[j++] })

  return [...head, ...middle, ...tail]
}

/** Original vs corrected as readable hunks: unchanged, removed, inserted, or modified (replaced). */
export function diffText(original: string, corrected: string): DiffHunk[] {
  const ops = diffOps(tokenize(original), tokenize(corrected))
  const hunks: DiffHunk[] = []
  let equal = ''
  let before = ''
  let after = ''

  const flushChange = () => {
    if (before !== '' && after !== '') hunks.push({ type: 'modified', before, after })
    else if (before !== '') hunks.push({ type: 'removed', text: before })
    else if (after !== '') hunks.push({ type: 'inserted', text: after })
    before = ''
    after = ''
  }
  const flushEqual = () => {
    if (equal !== '') hunks.push({ type: 'equal', text: equal })
    equal = ''
  }

  for (const op of ops) {
    if (op.t === 'eq') {
      flushChange()
      equal += op.v
    } else {
      flushEqual()
      if (op.t === 'del') before += op.v
      else after += op.v
    }
  }
  flushChange()
  flushEqual()
  return hunks
}

export function summarizeChanges(hunks: readonly DiffHunk[]): ChangeStats {
  const stats: ChangeStats = { inserted: 0, removed: 0, modified: 0, wordsAdded: 0, wordsRemoved: 0 }
  for (const hunk of hunks) {
    if (hunk.type === 'inserted') {
      stats.inserted += 1
      stats.wordsAdded += countWords(hunk.text)
    } else if (hunk.type === 'removed') {
      stats.removed += 1
      stats.wordsRemoved += countWords(hunk.text)
    } else if (hunk.type === 'modified') {
      stats.modified += 1
      stats.wordsAdded += countWords(hunk.after)
      stats.wordsRemoved += countWords(hunk.before)
    }
  }
  return stats
}
