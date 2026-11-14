import { useEffect, useRef, useState } from 'react'
import { ConfirmDialog } from '@/components/submission/confirm-dialog'
import { OrganisationGate } from '@/components/submission/organisation-gate'
import { SubmissionConfirmation } from '@/components/submission/submission-confirmation'
import { SubmissionDetailDialog } from '@/components/submission/submission-detail-dialog'
import { SubmissionForm } from '@/components/submission/submission-form'
import { SubmissionHistory } from '@/components/submission/submission-history'
import { SubmissionPreview } from '@/components/submission/submission-preview'
import { useSubmissionForm, type PendingFile } from '@/components/submission/use-submission-form'
import { WorkflowSteps } from '@/components/submission/workflow-steps'
import { Notice } from '@/components/ui/notice'
import { PageHeader } from '@/components/ui/page-header'
import { useAuth } from '@/hooks/use-auth'
import { useOrganisation } from '@/hooks/use-organisation'
import { toPayload } from '@/lib/content-submission'
import { validateDraft, validateSubmission, type SubmissionErrors } from '@/lib/submission'
import { ApiError } from '@/services/api'
import {
  createSubmission,
  deleteAttachment,
  deleteSubmission,
  getSubmission,
  reopenSubmission,
  submitSubmission,
  updateSubmission,
  uploadAttachment,
} from '@/services/submissions'
import type { ApiAttachment, ApiSubmissionDetail } from '@/types/content-submission'

type Feedback = { tone: 'success' | 'error' | 'info'; text: string } | null
type Busy = 'idle' | 'saving' | 'submitting'

const describe = (cause: unknown): string =>
  cause instanceof ApiError ? cause.message : 'Something went wrong. Please try again.'

export function ContentSubmissionPage() {
  return (
    <>
      <PageHeader
        title="Submit Content"
        description="Submit marketing content for brand compliance review. This is the first step: your content is saved to your organisation, then analysed against your approved brand knowledge in a later step."
        badge="Step 1 of 3"
      />
      <WorkflowSteps />
      <div className="space-y-6">
        <OrganisationGate>
          <SubmissionWorkspace />
        </OrganisationGate>
      </div>
    </>
  )
}

function SubmissionWorkspace() {
  const { user } = useAuth()
  const organisation = useOrganisation()
  const userId = user?.id ?? null
  const canCreate = organisation.can('submissions:create')
  const canManageAll = organisation.can('submissions:manage_all')
  const canViewAll = organisation.can('submissions:view_all')

  const form = useSubmissionForm()
  const formRef = useRef<HTMLFormElement>(null)
  const topRef = useRef<HTMLDivElement>(null)

  const [busy, setBusy] = useState<Busy>('idle')
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [reopening, setReopening] = useState(false)
  const [confirmation, setConfirmation] = useState<ApiSubmissionDetail | null>(null)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [listVersion, setListVersion] = useState(0)
  const [clearOpen, setClearOpen] = useState(false)
  const [pendingEditId, setPendingEditId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null)
  const [viewId, setViewId] = useState<string | null>(null)

  const refreshList = () => setListVersion((version) => version + 1)

  useEffect(() => {
    if (!feedback || feedback.tone === 'error') return
    const timer = window.setTimeout(() => setFeedback(null), 7000)
    return () => window.clearTimeout(timer)
  }, [feedback])

  /** Shows the errors and moves focus to the first invalid field so keyboard and screen-reader users land on it. */
  const reject = (errors: SubmissionErrors, intro: string) => {
    form.setErrors(errors)
    const count = Object.keys(errors).length
    setFeedback({ tone: 'error', text: `${intro} ${count} ${count === 1 ? 'field needs' : 'fields need'} attention.` })
    window.requestAnimationFrame(() => {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
    })
  }

  /**
   * Saves the draft (create, or update if it already exists), then uploads any selected files.
   * The draft id is remembered as soon as it exists, so a failed upload never causes a duplicate
   * draft on retry; files that fail stay selected so nothing the user chose is lost.
   */
  const persistDraft = async (): Promise<{ id: string; failures: string[]; saved: ApiAttachment[] }> => {
    const payload = toPayload(form.values)
    const detail = form.draftId ? await updateSubmission(form.draftId, payload) : await createSubmission(payload)
    form.setDraftId(detail.id)

    let saved = detail.attachments
    const failures: string[] = []
    const remaining: PendingFile[] = []
    for (const item of form.pending) {
      try {
        saved = [...saved, await uploadAttachment(detail.id, item.file)]
      } catch (cause) {
        failures.push(`“${item.file.name}”: ${describe(cause)}`)
        remaining.push(item)
      }
    }
    form.setSaved(saved)
    form.setPending(remaining)
    refreshList()
    return { id: detail.id, failures, saved }
  }

  const handleSaveDraft = async () => {
    const errors = validateDraft(form.values)
    if (Object.keys(errors).length > 0) {
      reject(errors, 'The draft was not saved.')
      return
    }
    setBusy('saving')
    setFeedback(null)
    try {
      const { failures } = await persistDraft()
      form.setErrors({})
      if (failures.length > 0) {
        setFeedback({
          tone: 'error',
          text: `Draft saved, but ${failures.length === 1 ? 'a file' : `${failures.length} files`} could not be uploaded: ${failures.join(' ')}`,
        })
      } else {
        setFeedback({ tone: 'success', text: 'Draft saved.' })
      }
    } catch (cause) {
      setFeedback({ tone: 'error', text: `The draft was not saved. ${describe(cause)}` })
    } finally {
      setBusy('idle')
    }
  }

  const handleSubmit = async () => {
    const readable = form.pending.length + form.saved.filter((item) => item.status === 'ready').length
    const errors = validateSubmission(form.values, readable)
    if (form.saved.some((item) => item.status === 'failed')) {
      errors.attachments = 'Remove the attachments that could not be read before submitting.'
    }
    if (Object.keys(errors).length > 0) {
      reject(errors, 'The content was not submitted.')
      return
    }

    setBusy('submitting')
    setFeedback(null)
    try {
      const { id, failures, saved } = await persistDraft()
      if (failures.length > 0) {
        setFeedback({
          tone: 'error',
          text: `Your draft was saved, but it was not submitted because ${failures.length === 1 ? 'a file' : 'some files'} could not be uploaded: ${failures.join(' ')}`,
        })
        return
      }
      if (saved.some((item) => item.status === 'failed')) {
        form.setErrors({ attachments: 'Remove the attachments that could not be read before submitting.' })
        setFeedback({ tone: 'error', text: 'Your draft was saved, but it was not submitted: a document could not be read.' })
        return
      }
      const result = await submitSubmission(id)
      form.reset()
      setConfirmation(result)
      refreshList()
      window.requestAnimationFrame(() => {
        topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        document.getElementById('submission-confirmation-title')?.focus()
      })
    } catch (cause) {
      setFeedback({ tone: 'error', text: `The content was not submitted. ${describe(cause)}` })
    } finally {
      setBusy('idle')
    }
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

  const loadDraftById = async (id: string) => {
    setPendingEditId(null)
    setFeedback(null)
    try {
      const detail = await getSubmission(id)
      if (detail.status !== 'draft') {
        setFeedback({ tone: 'error', text: 'Only drafts can be edited.' })
        return
      }
      form.loadDraft(detail)
      setConfirmation(null)
      setFeedback({ tone: 'info', text: `Editing “${detail.title}”.` })
      window.requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    } catch (cause) {
      setFeedback({ tone: 'error', text: `The draft could not be opened. ${describe(cause)}` })
    }
  }

  const handleEdit = (id: string) => {
    // Opening a draft replaces the form, so confirm first if that would discard unsaved typing.
    if (form.isDirty && form.draftId !== id) setPendingEditId(id)
    else void loadDraftById(id)
  }

  const handleRemoveSaved = async (attachment: ApiAttachment) => {
    if (!form.draftId) return
    setRemovingId(attachment.id)
    try {
      await deleteAttachment(form.draftId, attachment.id)
      form.setSaved(form.saved.filter((item) => item.id !== attachment.id))
      form.setErrors({ ...form.errors, attachments: undefined })
      refreshList()
    } catch (cause) {
      setFeedback({ tone: 'error', text: `“${attachment.original_filename}” was not removed. ${describe(cause)}` })
    } finally {
      setRemovingId(null)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    const target = deleteTarget
    setDeleteTarget(null)
    try {
      await deleteSubmission(target.id)
      if (form.draftId === target.id) form.reset()
      refreshList()
      setFeedback({ tone: 'success', text: `“${target.title}” was deleted.` })
    } catch (cause) {
      setFeedback({ tone: 'error', text: `“${target.title}” was not deleted. ${describe(cause)}` })
    }
  }

  const handleReopen = async () => {
    if (!confirmation) return
    setReopening(true)
    try {
      const reopened = await reopenSubmission(confirmation.id)
      form.loadDraft(reopened)
      setConfirmation(null)
      refreshList()
      setFeedback({ tone: 'info', text: 'Reopened as a draft. Fix the problem and submit again.' })
    } catch (cause) {
      setFeedback({ tone: 'error', text: `It could not be reopened. ${describe(cause)}` })
    } finally {
      setReopening(false)
    }
  }

  return (
    <>
      <div ref={topRef} />

      {feedback && <Notice tone={feedback.tone}>{feedback.text}</Notice>}

      {!canCreate && (
        <Notice tone="info">
          Your role can view submissions but not create or change them. Ask an owner or admin if you need to submit content.
        </Notice>
      )}

      {canCreate &&
        (confirmation ? (
          <SubmissionConfirmation
            submission={confirmation}
            onSubmitAnother={() => setConfirmation(null)}
            onReopen={() => void handleReopen()}
            reopening={reopening}
          />
        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <SubmissionForm
                form={form}
                formRef={formRef}
                busy={busy}
                removingId={removingId}
                onSubmit={() => void handleSubmit()}
                onSaveDraft={() => void handleSaveDraft()}
                onClear={handleClear}
                onRemoveSaved={(attachment) => void handleRemoveSaved(attachment)}
              />
            </div>
            <div className="lg:sticky lg:top-24">
              <SubmissionPreview values={form.values} pending={form.pending} saved={form.saved} draftId={form.draftId} />
            </div>
          </div>
        ))}

      <SubmissionHistory
        version={listVersion}
        activeDraftId={form.draftId}
        userId={userId}
        canCreate={canCreate}
        canManageAll={canManageAll}
        canViewAll={canViewAll}
        onEdit={handleEdit}
        onView={setViewId}
        onDelete={(item) => setDeleteTarget({ id: item.id, title: item.title })}
      />

      <ConfirmDialog
        open={clearOpen}
        title="Clear the form?"
        description="Everything you have entered, including selected files, will be removed from the form. Saved drafts are not deleted."
        confirmLabel="Clear form"
        onConfirm={confirmClear}
        onClose={() => setClearOpen(false)}
      />
      <ConfirmDialog
        open={pendingEditId !== null}
        title="Replace what is in the form?"
        description="Opening this draft will replace the content currently in the form. Anything you have not saved will be lost."
        confirmLabel="Open draft"
        onConfirm={() => pendingEditId && void loadDraftById(pendingEditId)}
        onClose={() => setPendingEditId(null)}
      />
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete this submission?"
        description={deleteTarget ? `“${deleteTarget.title}” and its attachments will be permanently removed.` : ''}
        confirmLabel="Delete"
        onConfirm={() => void confirmDelete()}
        onClose={() => setDeleteTarget(null)}
      />
      <SubmissionDetailDialog
        submissionId={viewId}
        userId={userId}
        canCreate={canCreate}
        canManageAll={canManageAll}
        onClose={() => setViewId(null)}
        onChanged={refreshList}
        onEdit={handleEdit}
        onDelete={(item) => setDeleteTarget({ id: item.id, title: item.title })}
      />
    </>
  )
}
