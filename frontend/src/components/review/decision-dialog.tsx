import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Notice } from '@/components/ui/notice'
import { Textarea } from '@/components/ui/textarea'
import { COMMENT_LIMITS, DEMO_STATE_NOTICE, requiresComment, validateComment } from '@/lib/review'
import type { ReviewDecisionKind } from '@/types/review'

interface DialogCopy {
  title: string
  description: (contentTitle: string) => string
  commentLabel: string
  commentHint: string
  confirmLabel: string
  destructive?: boolean
}

const COPY: Record<ReviewDecisionKind, DialogCopy> = {
  approve: {
    title: 'Approve this content?',
    description: (title) =>
      `You are recording your own decision to approve “${title}”. The AI score and suggestions do not approve content; this decision does.`,
    commentLabel: 'Reviewer comment (optional)',
    commentHint: 'Anything the submitter or the next reviewer should know.',
    confirmLabel: 'Approve content',
  },
  reject: {
    title: 'Reject this content?',
    description: (title) => `“${title}” will be marked as rejected. The submitter needs to know why.`,
    commentLabel: 'Reason for rejection (required)',
    commentHint: 'Explain what is wrong with the content.',
    confirmLabel: 'Reject content',
    destructive: true,
  },
  request_changes: {
    title: 'Request changes?',
    description: (title) => `“${title}” will be marked as changes requested and sent back to the submitter.`,
    commentLabel: 'Changes required (required)',
    commentHint: 'Describe clearly what must change before this can be approved.',
    confirmLabel: 'Request changes',
  },
  keep_pending: {
    title: 'Keep this item pending?',
    description: (title) => `“${title}” stays in the pending queue and its status does not change. Your note is added to the history.`,
    commentLabel: 'Note (optional)',
    commentHint: 'For example, what you are waiting for.',
    confirmLabel: 'Keep pending',
  },
}

interface DecisionDialogProps {
  decision: ReviewDecisionKind
  contentTitle: string
  /** Facts the reviewer should see before approving, such as unresolved suggestions. */
  cautions: string[]
  /** Records the decision. Returns an error message to show here, or null on success. */
  onConfirm: (comment: string) => string | null
  onClose: () => void
}

/**
 * One dialog for all four decisions. Mount it with `key={decision}` so its state is fresh each time.
 * Required comments are validated here and again when the decision is recorded.
 */
export function DecisionDialog({ decision, contentTitle, cautions, onConfirm, onClose }: DecisionDialogProps) {
  const copy = COPY[decision]
  const [comment, setComment] = useState('')
  const [touched, setTouched] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  // A ref blocks a second click before React has re-rendered, which `disabled` alone cannot.
  const submitting = useRef(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const validationError = validateComment(decision, comment)
  const shownError = touched ? validationError : null
  const required = requiresComment(decision)
  const errorId = 'decision-comment-error'
  const hintId = 'decision-comment-hint'

  const submit = () => {
    if (submitting.current) return
    setTouched(true)
    if (validationError) {
      textareaRef.current?.focus()
      return
    }
    submitting.current = true
    const error = onConfirm(comment)
    if (error) {
      setSubmitError(error)
      submitting.current = false
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description(contentTitle)}</DialogDescription>
        </DialogHeader>

        {cautions.length > 0 && (
          <Notice tone="info">
            <ul className="list-disc space-y-1 pl-4">
              {cautions.map((caution) => (
                <li key={caution}>{caution}</li>
              ))}
            </ul>
          </Notice>
        )}

        <div className="space-y-1.5">
          <label htmlFor="decision-comment" className="text-sm font-medium">
            {copy.commentLabel}
          </label>
          <Textarea
            id="decision-comment"
            ref={textareaRef}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            onBlur={() => comment !== '' && setTouched(true)}
            maxLength={COMMENT_LIMITS.max + 200}
            aria-required={required}
            aria-invalid={shownError ? true : undefined}
            aria-describedby={shownError ? errorId : hintId}
          />
          <div className="flex items-start justify-between gap-3">
            {shownError ? (
              <p id={errorId} role="alert" className="text-xs font-medium text-destructive">
                {shownError}
              </p>
            ) : (
              <p id={hintId} className="text-xs text-muted-foreground">
                {copy.commentHint}
              </p>
            )}
            <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {comment.trim().length}/{COMMENT_LIMITS.max}
            </p>
          </div>
        </div>

        {submitError && <Notice tone="error">{submitError}</Notice>}

        <p className="text-xs text-muted-foreground">{DEMO_STATE_NOTICE}</p>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button variant={copy.destructive ? 'destructive' : 'default'} onClick={submit}>
            {copy.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
