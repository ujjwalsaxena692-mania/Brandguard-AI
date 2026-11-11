import { useDeferredValue, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CaseChooser } from '@/components/correction/case-chooser'
import { ContentComparison } from '@/components/correction/content-comparison'
import { CorrectedEditor } from '@/components/correction/corrected-editor'
import { CorrectionPreviewDialog } from '@/components/correction/correction-preview-dialog'
import { CorrectionSummary } from '@/components/correction/correction-summary'
import { EditorHeader } from '@/components/correction/editor-header'
import { CorrectionNotFoundState, NoCorrectionDataState } from '@/components/correction/no-correction-state'
import { OriginalContent } from '@/components/correction/original-content'
import { ReviewLinkCard } from '@/components/review/review-link-card'
import { SuggestionsPanel } from '@/components/correction/suggestions-panel'
import { WorkflowActions } from '@/components/correction/workflow-actions'
import { ConfirmDialog } from '@/components/submission/confirm-dialog'
import { Notice } from '@/components/ui/notice'
import { PageHeader } from '@/components/ui/page-header'
import { useCorrectionCases } from '@/hooks/use-correction-cases'
import { useCorrectionSession } from '@/hooks/use-correction-store'
import { useSubmissions } from '@/hooks/use-submission-store'
import { countStatuses, diffText, hasAnyChange, hasManualEdits, planUndo, summarizeChanges } from '@/lib/correction'
import type { CorrectionCase } from '@/types/correction'

interface Feedback {
  tone: 'success' | 'error' | 'info'
  message: string
}

function CorrectionWorkspace({ correctionCase }: { correctionCase: CorrectionCase }) {
  const { session, actions } = useCorrectionSession(correctionCase)
  const [resetOpen, setResetOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  // The diff is the heaviest calculation, so it may lag a keystroke behind instead of slowing typing.
  const deferredText = useDeferredValue(session.text)
  const hunks = useMemo(() => diffText(correctionCase.originalContent, deferredText), [correctionCase.originalContent, deferredText])
  const stats = useMemo(() => summarizeChanges(hunks), [hunks])

  const counts = countStatuses(correctionCase.suggestions, session.statuses)
  const undoPlan = planUndo(session, correctionCase.suggestions)
  const undoBlockedReason = undoPlan.ok ? null : undoPlan.reason
  const undoNote = !undoPlan.ok && session.history.length > 0 ? undoPlan.reason : null

  const undo = () => {
    const result = actions.undo()
    setFeedback(
      result.ok
        ? { tone: 'success', message: 'The most recent correction was undone, and its suggestion is pending again.' }
        : { tone: 'error', message: result.message },
    )
  }

  const reset = () => {
    actions.reset()
    setResetOpen(false)
    setFeedback({ tone: 'info', message: 'The corrected content was reset to the original, and every suggestion is pending again.' })
  }

  const markReady = () => {
    const result = actions.markReady()
    if (!result.ok) setFeedback({ tone: 'error', message: result.message })
    else setFeedback(null)
  }

  return (
    <div className="space-y-6">
      <Notice tone="info">
        {correctionCase.isDemo && (
          <>
            Demo data: no AI correction engine is connected. The suggestions here are hand-written examples with sample references, not AI output.{' '}
          </>
        )}
        You stay in control: nothing is applied unless you accept it, and nothing on this page approves content. A human reviewer makes the final
        decision. Your work is kept in memory only and is lost when you refresh the page.
      </Notice>

      <EditorHeader correctionCase={correctionCase} session={session} />

      {feedback && <Notice tone={feedback.tone}>{feedback.message}</Notice>}

      <div className="grid gap-6 lg:grid-cols-2">
        <OriginalContent content={correctionCase.originalContent} />
        <CorrectedEditor
          text={session.text}
          onChange={actions.editText}
          undoBlockedReason={undoBlockedReason}
          undoNote={undoNote}
          onUndo={undo}
          onReset={() => setResetOpen(true)}
          canReset={hasAnyChange(correctionCase, session)}
        />
      </div>

      <SuggestionsPanel correctionCase={correctionCase} session={session} actions={actions} />

      <ContentComparison hunks={hunks} />

      <CorrectionSummary
        suggestions={correctionCase.suggestions}
        statuses={session.statuses}
        counts={counts}
        stats={stats}
        manualEdits={hasManualEdits(correctionCase, session)}
      />

      <WorkflowActions
        session={session}
        pendingCount={counts.pending}
        onSaveDraft={actions.saveDraft}
        onPreview={() => setPreviewOpen(true)}
        onMarkReady={markReady}
      />

      <ReviewLinkCard submissionId={correctionCase.submissionId} from="correction" />

      <ConfirmDialog
        open={resetOpen}
        title="Reset to original?"
        description="This discards every accepted suggestion, rejection and manual edit, and puts all suggestions back to pending. The original content is not changed."
        confirmLabel="Reset to original"
        onConfirm={reset}
        onClose={() => setResetOpen(false)}
      />
      <CorrectionPreviewDialog open={previewOpen} title={correctionCase.title} text={session.text} onClose={() => setPreviewOpen(false)} />
    </div>
  )
}

/**
 * AI Correction Editor (route: /corrections).
 *
 * `?submission=<id>` selects the content. Only demo cases carry suggestions, and they are labelled as
 * demonstrations. A real submission never gets generated suggestions: it shows an explanatory empty state.
 */
export function CorrectionEditorPage() {
  const [params] = useSearchParams()
  const cases = useCorrectionCases()
  const submissions = useSubmissions()

  const selectedId = params.get('submission')
  const correctionCase = selectedId ? cases.find((item) => item.submissionId === selectedId) : undefined
  const submission = selectedId && !correctionCase ? submissions.find((item) => item.id === selectedId) : undefined

  let content
  if (correctionCase) {
    // Keyed so editor state never leaks between cases.
    content = <CorrectionWorkspace key={correctionCase.id} correctionCase={correctionCase} />
  } else if (submission) {
    content = <NoCorrectionDataState submission={submission} />
  } else if (selectedId) {
    content = <CorrectionNotFoundState id={selectedId} />
  } else {
    content = (
      <div className="space-y-6">
        <Notice tone="info">
          Demo data: no AI correction engine is connected. Only the demonstration examples have suggestions, and they are hand-written samples.
          Your own submissions show their status only.
        </Notice>
        <CaseChooser cases={cases} submissions={submissions} />
      </div>
    )
  }

  return (
    <>
      <PageHeader
        title="AI Correction Editor"
        description="Review suggested corrections one at a time, edit the result yourself, and compare it with the original. You decide every change."
        badge="Demo data"
      />
      {content}
    </>
  )
}
