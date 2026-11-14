import type { ReactNode } from 'react'
import { CheckCircle2, Circle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate } from '@/components/dashboard/format'
import { CONTENT_TYPE_LABELS, LIMITS, countWords } from '@/lib/submission'
import type { ApiAttachment } from '@/types/content-submission'
import type { SubmissionFormValues } from '@/types/submission'
import type { PendingFile } from './use-submission-form'

interface SubmissionPreviewProps {
  values: SubmissionFormValues
  pending: PendingFile[]
  saved: ApiAttachment[]
  draftId: string | null
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-right font-medium">{children}</dd>
    </div>
  )
}

function Check({ done, label }: { done: boolean; label: string }) {
  const Icon = done ? CheckCircle2 : Circle
  return (
    <li className="flex items-center gap-2 text-sm">
      <Icon className={done ? 'h-4 w-4 text-success' : 'h-4 w-4 text-muted-foreground'} aria-hidden="true" />
      <span className={done ? '' : 'text-muted-foreground'}>{label}</span>
      <span className="sr-only">{done ? '(done)' : '(still needed)'}</span>
    </li>
  )
}

export function SubmissionPreview({ values, pending, saved, draftId }: SubmissionPreviewProps) {
  const words = countWords(values.contentText)
  const text = values.contentText.trim()
  const dash = <span className="font-normal text-muted-foreground">Not set</span>
  const readableAttachments = saved.filter((item) => item.status === 'ready').length + pending.length
  const failedAttachments = saved.filter((item) => item.status === 'failed').length
  const textOk =
    values.contentText.length <= LIMITS.contentMax && (text.length >= LIMITS.contentMin || readableAttachments > 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Submission preview</CardTitle>
        <CardDescription>Updates as you type. Nothing is submitted until you choose Submit.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="break-words text-base font-semibold">{values.title.trim() || <span className="text-muted-foreground">Untitled content</span>}</p>
          {text && <p className="mt-1 line-clamp-3 break-words text-sm text-muted-foreground">{text}</p>}
        </div>

        <dl className="space-y-2 border-t border-border pt-4">
          <Row label="Content type">{values.contentType ? CONTENT_TYPE_LABELS[values.contentType] : dash}</Row>
          <Row label="Word count">{words.toLocaleString()}</Row>
          <Row label="Attached files">
            {saved.length + pending.length}
            {pending.length > 0 && <span className="font-normal text-muted-foreground"> ({pending.length} upload on save)</span>}
            {failedAttachments > 0 && <span className="font-normal text-destructive"> ({failedAttachments} unreadable)</span>}
          </Row>
          <Row label="Campaign">{values.campaignName.trim() || dash}</Row>
          <Row label="Target audience">{values.targetAudience.trim() || dash}</Row>
          <Row label="Platform">{values.platform || dash}</Row>
          <Row label="Publishing date">{values.publishingDate ? formatDate(values.publishingDate) : dash}</Row>
          <Row label="Status">{draftId ? 'Saved draft' : 'Not yet saved'}</Row>
        </dl>

        <div className="border-t border-border pt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Needed to submit</p>
          <ul className="space-y-1.5">
            <Check done={values.title.trim().length >= LIMITS.titleMin} label="Content title" />
            <Check done={values.contentType !== ''} label="Content type" />
            <Check done={textOk} label="Content text or a readable document" />
            <Check done={failedAttachments === 0} label="No unreadable attachments" />
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
