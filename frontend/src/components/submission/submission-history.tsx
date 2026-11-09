import { FileText, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { formatDate } from '@/components/dashboard/format'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { CONTENT_TYPE_LABELS } from '@/lib/submission'
import type { ContentSubmission } from '@/types/submission'
import { SubmissionStatusBadge } from './submission-status'

interface SubmissionHistoryProps {
  submissions: ContentSubmission[]
  activeDraftId: string | null
  onEditDraft: (record: ContentSubmission) => void
  onDeleteDraft: (record: ContentSubmission) => void
  onView: (record: ContentSubmission) => void
}

const INITIAL_COUNT = 6

export function SubmissionHistory({ submissions, activeDraftId, onEditDraft, onDeleteDraft, onView }: SubmissionHistoryProps) {
  const [showAll, setShowAll] = useState(false)
  const sorted = [...submissions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const visible = showAll ? sorted : sorted.slice(0, INITIAL_COUNT)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent drafts and submissions</CardTitle>
        <CardDescription>
          Stored in this browser session only. Submitted items are waiting for analysis, which is not available yet; none has a
          score or approval.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0 sm:pt-0">
        {sorted.length === 0 ? (
          <EmptyState compact icon={FileText} title="Nothing here yet" description="Drafts you save and content you submit will be listed here." />
        ) : (
          <>
            <ul className="divide-y divide-border">
              {visible.map((record) => {
                const isDraft = record.status === 'draft'
                const dateLabel = isDraft ? `Saved ${formatDate(record.updatedAt)}` : `Submitted ${formatDate(record.submittedAt ?? record.updatedAt)}`
                return (
                  <li key={record.id} className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="break-words font-medium">
                        {record.title}
                        {record.id === activeDraftId && <span className="ml-2 text-xs font-normal text-primary">Editing now</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {record.contentType ? CONTENT_TYPE_LABELS[record.contentType] : 'No type chosen'} · {dateLabel} ·{' '}
                        <span className="font-mono">{record.id}</span>
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <SubmissionStatusBadge status={record.status} />
                      {isDraft ? (
                        <>
                          <Button variant="outline" size="sm" onClick={() => onEditDraft(record)} aria-label={`Edit draft ${record.title}`}>
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                            Edit
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => onDeleteDraft(record)} aria-label={`Delete draft ${record.title}`}>
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => onView(record)} aria-label={`View submission ${record.title}`}>
                          View
                        </Button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
            {sorted.length > INITIAL_COUNT && (
              <div className="mt-4">
                <Button variant="ghost" size="sm" onClick={() => setShowAll((value) => !value)}>
                  {showAll ? 'Show fewer' : `Show all (${sorted.length})`}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
