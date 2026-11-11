import { Link } from 'react-router-dom'
import { CategoryBadge, EventOriginBadge, EventStatusBadge } from '@/components/history/event-badges'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Notice } from '@/components/ui/notice'
import { formatDateTime } from '@/lib/review'
import { CONTENT_TYPE_LABELS } from '@/lib/submission'
import type { HistoryEvent } from '@/types/insights'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[9rem_1fr] sm:gap-3">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  )
}

/** Full detail for one event. Everything shown comes from the source record: nothing is added. */
export function HistoryEventDialog({ event, onClose }: { event: HistoryEvent | null; onClose: () => void }) {
  return (
    <Dialog open={event !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        {event && (
          <>
            <DialogHeader>
              <DialogTitle>{event.title}</DialogTitle>
              <DialogDescription>{event.contentTitle}</DialogDescription>
            </DialogHeader>

            <div className="flex flex-wrap gap-1.5">
              <CategoryBadge category={event.category} />
              <EventStatusBadge event={event} />
              <EventOriginBadge origin={event.origin} />
            </div>

            {event.originNote && <Notice>{event.originNote}</Notice>}

            <dl className="space-y-2.5">
              <Field label="Submission ID">
                <span className="font-mono">{event.submissionId}</span>
              </Field>
              <Field label="Content type">{event.contentType ? CONTENT_TYPE_LABELS[event.contentType] : 'Not specified'}</Field>
              <Field label="Date and time">
                <time dateTime={event.at}>{formatDateTime(event.at)}</time>
              </Field>
              <Field label="User">{event.user ?? 'Not recorded'}</Field>
              <Field label="Status">{event.status}</Field>
            </dl>

            {event.comment && (
              <div>
                <h3 className="mb-1 text-xs font-medium text-muted-foreground">Reviewer comment</h3>
                <p className="whitespace-pre-wrap rounded-md border border-border bg-muted p-3 text-sm">{event.comment}</p>
              </div>
            )}

            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {event.details.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>

            <p className="text-xs text-muted-foreground">
              This entry comes from in-memory data and resets when the page is refreshed. It is not a persistent audit log.
            </p>

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              {event.link && (
                <Button asChild>
                  <Link to={event.link.to}>{event.link.label}</Link>
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
