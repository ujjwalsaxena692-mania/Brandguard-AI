import { Download, History, RotateCcw, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { HistoryEventDialog } from '@/components/history/history-event-dialog'
import { HistoryTimeline } from '@/components/history/history-timeline'
import { FilterSelect } from '@/components/review/filter-select'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DateRangeFilter } from '@/components/ui/date-range-filter'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Notice } from '@/components/ui/notice'
import { PageHeader } from '@/components/ui/page-header'
import { useHistoryEvents } from '@/hooks/use-insights-source'
import { downloadTextFile } from '@/lib/csv'
import { resolveRange } from '@/lib/date-range'
import {
  contentTypesPresent,
  DEFAULT_HISTORY_FILTERS,
  filterHistoryEvents,
  groupByDay,
  HISTORY_CATEGORIES,
  HISTORY_CATEGORY_LABELS,
  hasActiveHistoryFilters,
} from '@/lib/history'
import { historyCsv, historyFileName } from '@/lib/insights-export'
import { CONTENT_TYPE_LABELS } from '@/lib/submission'
import type { DateRangeFilter as DateRangeValue, HistoryEvent, HistoryFilters } from '@/types/insights'

interface Feedback {
  tone: 'success' | 'error' | 'info'
  message: string
}

/**
 * Content History (route: /history).
 *
 * A searchable timeline built from timestamps that already exist in the in-memory stores. It never
 * creates events: records with no timestamp, and changes the stores do not time-stamp, do not appear.
 */
export function ContentHistoryPage() {
  const { events } = useHistoryEvents()
  const [filters, setFilters] = useState<HistoryFilters>(DEFAULT_HISTORY_FILTERS)
  const [selected, setSelected] = useState<HistoryEvent | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  // Recomputed when the stores or the filters change. `Date.now()` only matters for "last N days" presets.
  const { visible, range } = useMemo(() => {
    const nowMs = Date.now()
    return { visible: filterHistoryEvents(events, filters, nowMs), range: resolveRange(filters.range, nowMs) }
  }, [events, filters])

  const groups = useMemo(() => groupByDay(visible), [visible])
  const present = useMemo(() => contentTypesPresent(events), [events])
  const active = hasActiveHistoryFilters(filters)

  const update = (patch: Partial<HistoryFilters>) => {
    setFilters((current) => ({ ...current, ...patch }))
    setFeedback(null)
  }
  const reset = () => {
    setFilters(DEFAULT_HISTORY_FILTERS)
    setFeedback(null)
  }

  const exportCsv = () => {
    if (visible.length === 0) {
      setFeedback({ tone: 'info', message: 'Nothing to export: no events match the current filters.' })
      return
    }
    const ok = downloadTextFile(historyFileName(range.label), historyCsv(visible))
    setFeedback(
      ok
        ? { tone: 'success', message: `Exported ${visible.length} ${visible.length === 1 ? 'event' : 'events'} to CSV.` }
        : { tone: 'error', message: 'The export could not be started in this browser.' },
    )
  }

  const contentTypeOptions = [
    { value: 'all' as const, label: 'All content types' },
    ...present.types.map((type) => ({ value: type, label: CONTENT_TYPE_LABELS[type] })),
    ...(present.hasUnspecified ? [{ value: 'unspecified' as const, label: 'Not specified' }] : []),
  ]

  return (
    <>
      <PageHeader
        title="Content History"
        description="A timeline of submissions, analyses, corrections and review decisions, built from the data currently held in this browser tab."
        actions={
          <Button variant="outline" onClick={exportCsv}>
            <Download className="h-4 w-4" aria-hidden="true" />
            Export history (CSV)
          </Button>
        }
      />

      <Notice className="mb-4">
        History is read from temporary in-memory data and resets when you refresh the page. It is not a persistent audit log. Entries marked
        “Demo” are sample data, not real activity. Changes that carry no timestamp in the stores (such as individual suggestion accept or reject
        choices) are not listed.
      </Notice>

      {feedback && (
        <Notice tone={feedback.tone === 'info' ? 'info' : feedback.tone} className="mb-4">
          {feedback.message}
        </Notice>
      )}

      <Card className="mb-6 p-4">
        <form role="search" aria-label="Filter content history" onSubmit={(event) => event.preventDefault()}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
              <label htmlFor="history-search" className="text-xs font-medium text-muted-foreground">
                Search by content title or submission ID
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="history-search"
                  type="search"
                  className="pl-9"
                  placeholder="e.g. Autumn Campaign or SUB-DEMO-0101"
                  value={filters.query}
                  onChange={(event) => update({ query: event.target.value })}
                />
              </div>
            </div>
            <FilterSelect
              id="history-category"
              label="Event category"
              value={filters.category}
              options={[{ value: 'all', label: 'All categories' }, ...HISTORY_CATEGORIES.map((value) => ({ value, label: HISTORY_CATEGORY_LABELS[value] }))]}
              onChange={(category) => update({ category })}
            />
            <FilterSelect
              id="history-type"
              label="Content type"
              value={filters.contentType}
              options={contentTypeOptions}
              onChange={(contentType) => update({ contentType })}
            />
            <FilterSelect
              id="history-sort"
              label="Sort"
              value={filters.sort}
              options={[
                { value: 'newest', label: 'Newest first' },
                { value: 'oldest', label: 'Oldest first' },
              ]}
              onChange={(sort) => update({ sort })}
            />
            <DateRangeFilter
              idPrefix="history"
              value={filters.range}
              error={range.error}
              onChange={(value: DateRangeValue) => update({ range: value })}
            />
          </div>
          {range.error && (
            <p id="history-range-error" role="alert" className="mt-3 text-sm text-primary">
              {range.error}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
              Showing {visible.length} of {events.length} {events.length === 1 ? 'event' : 'events'} · {range.label}
            </p>
            <Button type="button" variant="ghost" size="sm" onClick={reset} disabled={!active}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Reset filters
            </Button>
          </div>
        </form>
      </Card>

      {events.length === 0 ? (
        <Card>
          <EmptyState
            icon={History}
            title="No history yet"
            description="Events appear here once content is submitted, analysed, corrected or reviewed. Nothing is shown for records that have no timestamp."
          />
        </Card>
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={Search}
            title="No events match these filters"
            description="Try a different search, widen the date range, or reset the filters."
            action={
              <Button variant="outline" onClick={reset}>
                Reset filters
              </Button>
            }
          />
        </Card>
      ) : (
        <HistoryTimeline groups={groups} onOpen={setSelected} />
      )}

      <HistoryEventDialog event={selected} onClose={() => setSelected(null)} />
    </>
  )
}
