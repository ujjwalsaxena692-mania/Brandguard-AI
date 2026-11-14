import { useCallback, useState, type ReactNode } from 'react'
import { formatDate } from '@/components/dashboard/format'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ErrorState } from '@/components/ui/error-state'
import { LoadingState } from '@/components/ui/loading-state'
import { Notice } from '@/components/ui/notice'
import { useApiQuery } from '@/hooks/use-api-query'
import { ATTACHMENT_LABELS, STATUS_META, canCancel, canDelete, canEdit, canReopen, shortId } from '@/lib/content-submission'
import { formatBytes } from '@/lib/files'
import { CONTENT_TYPE_LABELS } from '@/lib/submission'
import { ApiError } from '@/services/api'
import { cancelSubmission, getSubmission, reopenSubmission } from '@/services/submissions'
import type { ApiSubmission, ApiSubmissionDetail } from '@/types/content-submission'
import { ConfirmDialog } from './confirm-dialog'
import { SubmissionStatusBadge } from './submission-status'

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="break-words text-sm">{children}</dd>
    </div>
  )
}

const none = <span className="text-muted-foreground">Not provided</span>

interface SubmissionDetailDialogProps {
  /** The submission to show, or null when closed. */
  submissionId: string | null
  userId: string | null
  canCreate: boolean
  canManageAll: boolean
  onClose: () => void
  /** Called after this dialog changed the submission, so the list can reload. */
  onChanged: () => void
  onEdit: (id: string) => void
  onDelete: (item: ApiSubmission) => void
}

export function SubmissionDetailDialog({ submissionId, onClose, ...rest }: SubmissionDetailDialogProps) {
  return (
    <Dialog open={submissionId !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        {submissionId && <DetailBody key={submissionId} submissionId={submissionId} onClose={onClose} {...rest} />}
      </DialogContent>
    </Dialog>
  )
}

function DetailBody({
  submissionId,
  userId,
  canCreate,
  canManageAll,
  onClose,
  onChanged,
  onEdit,
  onDelete,
}: Omit<SubmissionDetailDialogProps, 'submissionId'> & { submissionId: string }) {
  const fetcher = useCallback((signal: AbortSignal) => getSubmission(submissionId, signal), [submissionId])
  const { data, error, loading, refetch } = useApiQuery<ApiSubmissionDetail>(fetcher)
  const [busy, setBusy] = useState<'cancel' | 'reopen' | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)

  if (loading && !data) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Submission</DialogTitle>
          <DialogDescription>Loading details…</DialogDescription>
        </DialogHeader>
        <LoadingState label="Loading submission…" />
      </>
    )
  }
  if (error || !data) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Submission</DialogTitle>
          <DialogDescription>The details could not be loaded.</DialogDescription>
        </DialogHeader>
        <ErrorState title="Could not load this submission" message={error?.message ?? 'Please try again.'} onRetry={refetch} />
      </>
    )
  }

  const mayAct = canCreate && (data.submitted_by === userId || canManageAll)

  const run = async (action: 'cancel' | 'reopen') => {
    setBusy(action)
    setActionError(null)
    try {
      if (action === 'cancel') await cancelSubmission(data.id)
      else await reopenSubmission(data.id)
      onChanged()
      refetch()
    } catch (cause) {
      setActionError(cause instanceof ApiError ? cause.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{data.title}</DialogTitle>
        <DialogDescription>
          <span className="font-mono">{shortId(data.id)}</span> · {data.content_type ? CONTENT_TYPE_LABELS[data.content_type] : 'No type'}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-2">
        <SubmissionStatusBadge status={data.status} />
        <p className="text-sm text-muted-foreground">{STATUS_META[data.status].description}</p>
      </div>
      {data.status === 'failed' && data.error_message && <Notice tone="error">{data.error_message}</Notice>}
      <Notice tone="info">Not analysed and not approved. No compliance score exists for this content.</Notice>
      {actionError && <Notice tone="error">{actionError}</Notice>}

      <section aria-label="Submitted content">
        <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Content</h3>
        {data.content_text ? (
          <p className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words text-sm leading-relaxed">{data.content_text}</p>
        ) : (
          <p className="text-sm text-muted-foreground">No typed content. The attached documents hold the text.</p>
        )}
      </section>

      <dl className="grid gap-4 sm:grid-cols-2">
        <Item label="Submitted">{data.submitted_at ? formatDate(data.submitted_at) : '—'}</Item>
        <Item label="Text prepared">{data.analysis_text_length !== null ? `${data.analysis_text_length.toLocaleString()} characters` : '—'}</Item>
        <Item label="Campaign">{data.campaign_name || none}</Item>
        <Item label="Target audience">{data.target_audience || none}</Item>
        <Item label="Platform">{data.platform || none}</Item>
        <Item label="Publishing date">{data.publishing_date ? formatDate(data.publishing_date) : none}</Item>
        <div className="sm:col-span-2">
          <Item label="Attached files">
            {data.attachments.length === 0 ? (
              none
            ) : (
              <ul className="space-y-1">
                {data.attachments.map((file) => (
                  <li key={file.id}>
                    {file.original_filename} ({formatBytes(file.size_bytes)}) ·{' '}
                    <span className="text-muted-foreground">{ATTACHMENT_LABELS[file.status]}</span>
                  </li>
                ))}
              </ul>
            )}
          </Item>
        </div>
        <div className="sm:col-span-2">
          <Item label="Context for the reviewer">{data.reviewer_context || none}</Item>
        </div>
      </dl>

      <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
        {mayAct && canEdit(data.status) && (
          <Button
            variant="outline"
            onClick={() => {
              onClose()
              onEdit(data.id)
            }}
          >
            Edit draft
          </Button>
        )}
        {mayAct && canReopen(data.status) && (
          <Button variant="outline" onClick={() => void run('reopen')} disabled={busy !== null}>
            {busy === 'reopen' ? 'Reopening…' : 'Reopen as draft'}
          </Button>
        )}
        {mayAct && canCancel(data.status) && (
          <Button variant="outline" onClick={() => setConfirmCancel(true)} disabled={busy !== null}>
            Cancel submission
          </Button>
        )}
        {mayAct && canDelete(data.status) && (
          <Button
            variant="outline"
            onClick={() => {
              onClose()
              onDelete(data)
            }}
          >
            Delete
          </Button>
        )}
        <DialogClose asChild>
          <Button variant="outline">Close</Button>
        </DialogClose>
      </div>

      <ConfirmDialog
        open={confirmCancel}
        title="Cancel this submission?"
        description="It will be withdrawn and will not be analysed. This cannot be undone."
        confirmLabel="Cancel submission"
        onConfirm={() => {
          setConfirmCancel(false)
          void run('cancel')
        }}
        onClose={() => setConfirmCancel(false)}
      />
    </>
  )
}
