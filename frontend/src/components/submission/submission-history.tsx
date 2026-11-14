import { ChevronLeft, ChevronRight, FileText, Pencil, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { formatDate } from '@/components/dashboard/format'
import { SelectField } from '@/components/knowledge/fields'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { FormField } from '@/components/ui/form-field'
import { LoadingState } from '@/components/ui/loading-state'
import { useApiQuery } from '@/hooks/use-api-query'
import { STATUS_FILTERS, canEdit, shortId } from '@/lib/content-submission'
import { CONTENT_TYPE_LABELS } from '@/lib/submission'
import { listSubmissions } from '@/services/submissions'
import type { ApiSubmission, SubmissionStatus } from '@/types/content-submission'
import { SubmissionStatusBadge } from './submission-status'

const PAGE_SIZE = 8

interface SubmissionHistoryProps {
  /** Bump to reload the list after a change made elsewhere on the page. */
  version: number
  activeDraftId: string | null
  userId: string | null
  /** Holds submissions:create. */
  canCreate: boolean
  /** Holds submissions:manage_all (may act on other members' submissions). */
  canManageAll: boolean
  /** Holds submissions:view_all (sees everyone's submissions, not only their own). */
  canViewAll: boolean
  onEdit: (id: string) => void
  onView: (id: string) => void
  onDelete: (item: ApiSubmission) => void
}

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}

export function SubmissionHistory({
  version,
  activeDraftId,
  userId,
  canCreate,
  canManageAll,
  canViewAll,
  onEdit,
  onView,
  onDelete,
}: SubmissionHistoryProps) {
  const [page, setPage] = useState(0)
  const [status, setStatus] = useState<SubmissionStatus | ''>('')
  const [search, setSearch] = useState('')
  const [mine, setMine] = useState(false)
  const q = useDebounced(search.trim(), 300)

  const fetcher = useCallback(
    (signal: AbortSignal) =>
      listSubmissions(
        { limit: PAGE_SIZE, offset: page * PAGE_SIZE, status: status || undefined, q: q || undefined, mine },
        signal,
      ),
    // `version` is intentionally a dependency: bumping it reloads the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [page, status, q, mine, version],
  )
  const { data, error, loading, refetch } = useApiQuery(fetcher)

  // Filters change the result set, so go back to the first page.
  useEffect(() => setPage(0), [status, q, mine])
  // After deleting the last item on a page, step back instead of showing an empty page.
  useEffect(() => {
    if (data && data.items.length === 0 && data.total > 0 && page > 0) setPage((current) => current - 1)
  }, [data, page])

  const filtered = status !== '' || q !== '' || mine
  const total = data?.total ?? 0
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1
  const to = Math.min((page + 1) * PAGE_SIZE, total)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Drafts and submissions</CardTitle>
        <CardDescription>
          {canViewAll
            ? 'Everything submitted in your organisation.'
            : 'Your drafts and submissions.'}{' '}
          &ldquo;Ready for analysis&rdquo; means the content is prepared; nothing has been analysed, scored or approved.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-0 sm:pt-0">
        <div className="grid items-end gap-3 sm:grid-cols-3">
          <FormField
            id="history-search"
            label="Search by title"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            maxLength={100}
          />
          <SelectField
            id="history-status"
            label="Status"
            value={status}
            onChange={(event) => setStatus(event.target.value as SubmissionStatus | '')}
            options={STATUS_FILTERS}
            placeholder="All statuses"
          />
          {canViewAll && (
            <label className="flex h-10 items-center gap-2 text-sm">
              <input type="checkbox" checked={mine} onChange={(event) => setMine(event.target.checked)} className="h-4 w-4" />
              Only my submissions
            </label>
          )}
        </div>

        {loading && !data ? (
          <LoadingState label="Loading submissions…" />
        ) : error ? (
          <ErrorState title="Could not load submissions" message={error.message} onRetry={refetch} />
        ) : data && data.items.length === 0 ? (
          <EmptyState
            compact
            icon={FileText}
            title={filtered ? 'No matching submissions' : 'Nothing here yet'}
            description={
              filtered
                ? 'Try a different search or clear the filters.'
                : canCreate
                  ? 'Drafts you save and content you submit will be listed here.'
                  : 'Submissions from your organisation will be listed here.'
            }
          />
        ) : (
          <>
            <ul className="divide-y divide-border" aria-busy={loading}>
              {data?.items.map((item) => {
                const mayAct = canCreate && (item.submitted_by === userId || canManageAll)
                const editable = mayAct && canEdit(item.status)
                return (
                  <li key={item.id} className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="break-words font-medium">
                        {item.title}
                        {item.id === activeDraftId && <span className="ml-2 text-xs font-normal text-primary">Editing now</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.content_type ? CONTENT_TYPE_LABELS[item.content_type] : 'No type chosen'} ·{' '}
                        {item.submitted_at ? `Submitted ${formatDate(item.submitted_at)}` : `Saved ${formatDate(item.updated_at)}`} ·{' '}
                        <span className="font-mono">{shortId(item.id)}</span>
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <SubmissionStatusBadge status={item.status} />
                      {editable && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => onEdit(item.id)} aria-label={`Edit draft ${item.title}`}>
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                            Edit
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => onDelete(item)} aria-label={`Delete draft ${item.title}`}>
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </>
                      )}
                      {!editable && (
                        <Button variant="outline" size="sm" onClick={() => onView(item.id)} aria-label={`View submission ${item.title}`}>
                          View
                        </Button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>

            <div className="flex items-center justify-between gap-3 pt-2 text-sm text-muted-foreground">
              <span>
                Showing {from}–{to} of {total}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page === 0 || loading}>
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  Previous
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={to >= total || loading}>
                  Next
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
