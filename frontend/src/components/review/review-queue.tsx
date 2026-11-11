import { Inbox, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatDate } from '@/components/dashboard/format'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  DEFAULT_FILTERS,
  REVIEW_STATUS_LABELS,
  REVIEW_STATUSES,
  filterAndSortItems,
  hasActiveFilters,
  itemContentType,
  itemScore,
  itemSubmittedAt,
  itemTitle,
  itemUnresolved,
  type ReviewItem,
} from '@/lib/review'
import { CONTENT_TYPES, CONTENT_TYPE_LABELS } from '@/lib/submission'
import type { QueueFilters, ReviewSort, ReviewStatus } from '@/types/review'
import type { ContentType } from '@/types/submission'
import { FilterSelect } from './filter-select'
import { DemoRecordBadge, ReviewStatusBadge } from './review-badges'

const STATUS_OPTIONS: readonly { value: 'all' | ReviewStatus; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  ...REVIEW_STATUSES.map((status) => ({ value: status, label: REVIEW_STATUS_LABELS[status] })),
]

const TYPE_OPTIONS: readonly { value: 'all' | ContentType; label: string }[] = [
  { value: 'all', label: 'All content types' },
  ...CONTENT_TYPES.map((type) => ({ value: type.value, label: type.label })),
]

const SORT_OPTIONS: readonly { value: ReviewSort; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
]

const reviewLink = (reviewId: string) => `/reviews/${encodeURIComponent(reviewId)}`

function actionLabel(item: ReviewItem): string {
  const { status } = item.record
  return status === 'approved' || status === 'rejected' ? 'View decision' : 'Review'
}

function ScoreCell({ item }: { item: ReviewItem }) {
  const score = itemScore(item)
  if (score === null) return <span className="text-muted-foreground">Not available</span>
  return (
    <span className="tabular-nums" title="AI compliance score. It informs the reviewer and is not an approval.">
      {score}/100
    </span>
  )
}

function UnresolvedCell({ item }: { item: ReviewItem }) {
  const count = itemUnresolved(item)
  return count === null ? <span className="text-muted-foreground">Not available</span> : <span className="tabular-nums">{count}</span>
}

/** The review queue: search, filters and sorting over review-ready items. Items without analysis never reach it. */
export function ReviewQueue({ items }: { items: ReviewItem[] }) {
  const [filters, setFilters] = useState<QueueFilters>(DEFAULT_FILTERS)
  const visible = useMemo(() => filterAndSortItems(items, filters), [items, filters])
  const update = (patch: Partial<QueueFilters>) => setFilters((current) => ({ ...current, ...patch }))
  const filtered = hasActiveFilters(filters)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review queue</CardTitle>
        <CardDescription>
          Content that has an analysis result and correction data, ready for a human reviewer. An AI score never decides the outcome.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div role="search" aria-label="Filter the review queue" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_1fr_1fr_1fr]">
          <div className="space-y-1.5">
            <label htmlFor="review-search" className="text-xs font-medium text-muted-foreground">
              Search
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="review-search"
                type="search"
                value={filters.query}
                onChange={(event) => update({ query: event.target.value })}
                placeholder="Title, submission ID or submitter"
                className="pl-9"
                autoComplete="off"
              />
            </div>
          </div>
          <FilterSelect id="review-status" label="Status" value={filters.status} options={STATUS_OPTIONS} onChange={(status) => update({ status })} />
          <FilterSelect
            id="review-type"
            label="Content type"
            value={filters.contentType}
            options={TYPE_OPTIONS}
            onChange={(contentType) => update({ contentType })}
          />
          <FilterSelect id="review-sort" label="Sort by submission date" value={filters.sort} options={SORT_OPTIONS} onChange={(sort) => update({ sort })} />
        </div>

        <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
          {items.length === 0 ? 'Nothing in the queue.' : `Showing ${visible.length} of ${items.length} ${items.length === 1 ? 'item' : 'items'}.`}
        </p>

        {items.length === 0 ? (
          <EmptyState
            compact
            icon={Inbox}
            title="The review queue is empty"
            description="Content appears here once it has an analysis result and correction data. Your own submissions are not queued until then."
            action={
              <Button asChild size="sm" variant="outline">
                <Link to="/submit">Submit content</Link>
              </Button>
            }
          />
        ) : visible.length === 0 ? (
          <EmptyState
            compact
            icon={Search}
            title="No items match your filters"
            description={filtered ? 'Try a different search term, or clear the filters to see everything in the queue.' : undefined}
            action={
              <Button size="sm" variant="outline" onClick={() => setFilters(DEFAULT_FILTERS)}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <>
            {/* Wide screens: table. */}
            <div className="hidden rounded-md border border-border md:block">
              <Table>
                <caption className="sr-only">Review queue</caption>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Content</TableHead>
                    <TableHead>Submission ID</TableHead>
                    <TableHead>Submitted by</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>AI score</TableHead>
                    <TableHead>Unresolved</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((item) => {
                    const type = itemContentType(item)
                    const submittedAt = itemSubmittedAt(item)
                    return (
                      <TableRow key={item.record.id}>
                        <TableCell className="min-w-[14rem]">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link to={reviewLink(item.record.id)} className="font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                              {itemTitle(item)}
                            </Link>
                            {item.record.isDemo && <DemoRecordBadge />}
                          </div>
                          <p className="text-xs text-muted-foreground">{type ? CONTENT_TYPE_LABELS[type] : 'No content type'}</p>
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-xs">{item.record.submissionId}</TableCell>
                        <TableCell className="text-muted-foreground">{item.record.submittedBy}</TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">{submittedAt ? formatDate(submittedAt) : '—'}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          <ScoreCell item={item} />
                        </TableCell>
                        <TableCell>
                          <UnresolvedCell item={item} />
                        </TableCell>
                        <TableCell>
                          <ReviewStatusBadge status={item.record.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild size="sm" variant={item.record.status === 'pending' ? 'default' : 'outline'}>
                            <Link to={reviewLink(item.record.id)} aria-label={`${actionLabel(item)}: ${itemTitle(item)}`}>
                              {actionLabel(item)}
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Narrow screens: cards. */}
            <ul className="space-y-3 md:hidden">
              {visible.map((item) => {
                const type = itemContentType(item)
                const submittedAt = itemSubmittedAt(item)
                return (
                  <li key={item.record.id} className="space-y-3 rounded-md border border-border p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="break-words font-medium">{itemTitle(item)}</p>
                      {item.record.isDemo && <DemoRecordBadge />}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {type ? CONTENT_TYPE_LABELS[type] : 'No content type'} · <span className="font-mono">{item.record.submissionId}</span>
                    </p>
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                      <div>
                        <dt className="text-muted-foreground">Submitted by</dt>
                        <dd>{item.record.submittedBy}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Submitted</dt>
                        <dd>{submittedAt ? formatDate(submittedAt) : '—'}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">AI score</dt>
                        <dd>
                          <ScoreCell item={item} />
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Unresolved</dt>
                        <dd>
                          <UnresolvedCell item={item} />
                        </dd>
                      </div>
                    </dl>
                    <div className="flex items-center justify-between gap-2">
                      <ReviewStatusBadge status={item.record.status} />
                      <Button asChild size="sm" variant={item.record.status === 'pending' ? 'default' : 'outline'}>
                        <Link to={reviewLink(item.record.id)} aria-label={`${actionLabel(item)}: ${itemTitle(item)}`}>
                          {actionLabel(item)}
                        </Link>
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  )
}
