import { useEffect, useRef, useState } from 'react'
import { ConfirmDialog } from '@/components/submission/confirm-dialog'
import { SubmissionConfirmation } from '@/components/submission/submission-confirmation'
import { SubmissionDetailDialog } from '@/components/submission/submission-detail-dialog'
import { SubmissionForm } from '@/components/submission/submission-form'
import { SubmissionHistory } from '@/components/submission/submission-history'
import { SubmissionPreview } from '@/components/submission/submission-preview'
import { useSubmissionForm } from '@/components/submission/use-submission-form'
import { WorkflowSteps } from '@/components/submission/workflow-steps'
import { Notice } from '@/components/ui/notice'
import { PageHeader } from '@/components/ui/page-header'
import { removeDraft, saveDraft, submitContent, useSubmissions } from '@/hooks/use-submission-store'
import { validateDraft, validateSubmission, type SubmissionErrors } from '@/lib/submission'
import type { ContentSubmission, SubmissionInput } from '@/types/submission'

type Feedback = { tone: 'success' | 'error' | 'info'; text: string } | null

export function ContentSubmissionPage() {
  const submissions = useSubmissions()
  const form = useSubmissionForm()
  const formRef = useRef<HTMLFormElement>(null)
  const topRef = useRef<HTMLDivElement>(null)

  const [confirmation, setConfirmation] = useState<ContentSubmission | null>(null)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [clearOpen, setClearOpen] = useState(false)
  const [pendingEdit, setPendingEdit] = useState<ContentSubmission | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ContentSubmission | null>(null)
  const [viewId, setViewId] = useState<string | null>(null)

  useEffect(() => {
    if (!feedback || feedback.tone === 'error') return
    const timer = window.setTimeout(() => setFeedback(null), 7000)
    return () => window.clearTimeout(timer)
  }, [feedback])

  const toInput = (): SubmissionInput => ({
    values: form.values,
    attachments: form.attachments.map((item) => item.meta),
  })

  /** Shows the errors and moves focus to the first invalid field so keyboard and screen-reader users land on it. */
  const reject = (errors: SubmissionErrors, intro: string) => {
    form.setErrors(errors)
    const count = Object.keys(errors).length
    setFeedback({ tone: 'error', text: `${intro} ${count} ${count === 1 ? 'field needs' : 'fields need'} attention.` })
    window.requestAnimationFrame(() => {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
    })
  }

  const handleSaveDraft = () => {
    const errors = validateDraft(form.values)
    if (Object.keys(errors).length > 0) {
      reject(errors, 'The draft was not saved.')
      return
    }
    const record = saveDraft(toInput(), form.draftId)
    form.setDraftId(record.id)
    form.setErrors({})
    const withFiles = form.attachments.length > 0
    setFeedback({
      tone: 'success',
      text: withFiles
        ? `Draft ${record.id} saved. Selected files are recorded by name only, so you will need to re-attach them when you continue.`
        : `Draft ${record.id} saved.`,
    })
  }

  const handleSubmit = () => {
    const errors = validateSubmission(form.values, form.attachments)
    if (Object.keys(errors).length > 0) {
      reject(errors, 'The content was not submitted.')
      return
    }
    const record = submitContent(toInput(), form.draftId)
    form.reset()
    setFeedback(null)
    setConfirmation(record)
    window.requestAnimationFrame(() => {
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      document.getElementById('submission-confirmation-title')?.focus()
    })
  }

  const handleClear = () => {
    if (form.isDirty) setClearOpen(true)
    else form.reset()
  }

  const confirmClear = () => {
    form.reset()
    setClearOpen(false)
    setFeedback({ tone: 'info', text: 'The form was cleared. Saved drafts are not affected.' })
  }

  const loadDraft = (record: ContentSubmission) => {
    form.loadDraft(record)
    setConfirmation(null)
    setPendingEdit(null)
    setFeedback({ tone: 'info', text: `Editing draft ${record.id}.` })
    window.requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const handleEditDraft = (record: ContentSubmission) => {
    // Opening a draft replaces the form, so confirm first if that would discard unsaved typing.
    if (form.isDirty && form.draftId !== record.id) setPendingEdit(record)
    else loadDraft(record)
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    removeDraft(deleteTarget.id)
    if (form.draftId === deleteTarget.id) form.setDraftId(null)
    setFeedback({ tone: 'success', text: `Draft ${deleteTarget.id} was deleted.` })
    setDeleteTarget(null)
  }

  const viewRecord = submissions.find((item) => item.id === viewId) ?? null

  return (
    <>
      <div ref={topRef} />
      <PageHeader
        title="Submit Content"
        description="Submit marketing content for brand compliance review. This is the first step: your content is recorded here, then analysed against your approved brand knowledge in a later step."
        badge="Step 1 of 3"
      />
      <WorkflowSteps />

      <div className="space-y-6">
        <Notice tone="info">
          Demo mode: drafts and submissions are kept in this browser session only. Nothing is sent to a server, and no AI analysis
          runs.
        </Notice>

        {feedback && <Notice tone={feedback.tone === 'info' ? 'info' : feedback.tone}>{feedback.text}</Notice>}

        {confirmation ? (
          <SubmissionConfirmation record={confirmation} onSubmitAnother={() => setConfirmation(null)} />
        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <SubmissionForm form={form} formRef={formRef} onSubmit={handleSubmit} onSaveDraft={handleSaveDraft} onClear={handleClear} />
            </div>
            <div className="lg:sticky lg:top-24">
              <SubmissionPreview values={form.values} attachments={form.attachments} draftId={form.draftId} />
            </div>
          </div>
        )}

        <SubmissionHistory
          submissions={submissions}
          activeDraftId={form.draftId}
          onEditDraft={handleEditDraft}
          onDeleteDraft={setDeleteTarget}
          onView={(record) => setViewId(record.id)}
        />
      </div>

      <ConfirmDialog
        open={clearOpen}
        title="Clear the form?"
        description="Everything you have entered, including selected files, will be removed from the form. Saved drafts are not deleted."
        confirmLabel="Clear form"
        onConfirm={confirmClear}
        onClose={() => setClearOpen(false)}
      />
      <ConfirmDialog
        open={pendingEdit !== null}
        title="Replace what is in the form?"
        description="Opening this draft will replace the content currently in the form. Anything you have not saved will be lost."
        confirmLabel="Open draft"
        onConfirm={() => pendingEdit && loadDraft(pendingEdit)}
        onClose={() => setPendingEdit(null)}
      />
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete this draft?"
        description={deleteTarget ? `“${deleteTarget.title}” (${deleteTarget.id}) will be permanently removed.` : ''}
        confirmLabel="Delete draft"
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
      <SubmissionDetailDialog record={viewRecord} onClose={() => setViewId(null)} />
    </>
  )
}
