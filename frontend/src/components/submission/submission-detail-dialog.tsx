import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Notice } from '@/components/ui/notice'
import { formatBytes } from '@/lib/files'
import { CONTENT_TYPE_LABELS } from '@/lib/submission'
import { formatDate } from '@/components/dashboard/format'
import type { ContentSubmission } from '@/types/submission'
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

export function SubmissionDetailDialog({ record, onClose }: { record: ContentSubmission | null; onClose: () => void }) {
  return (
    <Dialog open={record !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        {record && (
          <>
            <DialogHeader>
              <DialogTitle>{record.title}</DialogTitle>
              <DialogDescription>
                <span className="font-mono">{record.id}</span> · {record.contentType ? CONTENT_TYPE_LABELS[record.contentType] : 'No type'}
              </DialogDescription>
            </DialogHeader>

            <SubmissionStatusBadge status={record.status} />
            <Notice tone="info">Not analysed and not approved. No compliance score exists for this content.</Notice>

            <section aria-label="Submitted content">
              <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Content</h3>
              <p className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words text-sm leading-relaxed">{record.contentText}</p>
            </section>

            <dl className="grid gap-4 sm:grid-cols-2">
              <Item label="Submitted">{record.submittedAt ? formatDate(record.submittedAt) : '—'}</Item>
              <Item label="Campaign">{record.campaignName || none}</Item>
              <Item label="Target audience">{record.targetAudience || none}</Item>
              <Item label="Platform">{record.platform || none}</Item>
              <Item label="Publishing date">{record.publishingDate ? formatDate(record.publishingDate) : none}</Item>
              <Item label="Selected files">
                {record.attachments.length === 0
                  ? none
                  : record.attachments.map((file) => `${file.name} (${formatBytes(file.size)})`).join(', ')}
              </Item>
              <div className="sm:col-span-2">
                <Item label="Context for the reviewer">{record.reviewerContext || none}</Item>
              </div>
            </dl>

            <div className="flex justify-end border-t border-border pt-4">
              <DialogClose asChild>
                <Button variant="outline">Close</Button>
              </DialogClose>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
