import { FileSearch, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { ContentCheck, ContentCheckStatus } from '@/types/dashboard'
import { formatDate } from './format'
import { CONTENT_STATUS_LABELS, ContentStatusBadge, scoreBarClass } from './status'

type Filter = 'all' | ContentCheckStatus

const FILTERS: readonly Filter[] = ['all', 'compliant', 'needs_review', 'critical']

// The per-report route does not exist yet; reports open on the Analysis Reports page.
const REPORTS_ROUTE = '/reports'

function ScoreMeter({ check }: { check: ContentCheck }) {
  const score = Math.max(0, Math.min(100, Math.round(check.score)))
  return (
    <div className="flex items-center gap-3">
      <span className="w-8 font-semibold tabular-nums">{score}</span>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div className={cn('h-full rounded-full', scoreBarClass(check.status))} style={{ width: `${score}%` }} />
      </div>
    </div>
  )
}

function ViewReportButton({ title }: { title: string }) {
  return (
    <Button asChild variant="outline" size="sm">
      <Link to={REPORTS_ROUTE} aria-label={`View report for ${title}`}>
        View report
      </Link>
    </Button>
  )
}

export function RecentChecks({ checks }: { checks: ContentCheck[] }) {
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')

  const counts = useMemo(
    () => ({
      all: checks.length,
      compliant: checks.filter((check) => check.status === 'compliant').length,
      needs_review: checks.filter((check) => check.status === 'needs_review').length,
      critical: checks.filter((check) => check.status === 'critical').length,
    }),
    [checks],
  )

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase()
    return checks.filter(
      (check) =>
        (filter === 'all' || check.status === filter) &&
        (term === '' || `${check.title} ${check.contentType}`.toLowerCase().includes(term)),
    )
  }, [checks, filter, query])

  const clearFilters = () => {
    setFilter('all')
    setQuery('')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent content checks</CardTitle>
        <CardDescription>The latest content checked against your brand guidelines.</CardDescription>
        {checks.length > 0 && (
          <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-2">
              {FILTERS.map((value) => (
                <Button
                  key={value}
                  size="sm"
                  variant={filter === value ? 'default' : 'outline'}
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                >
                  {value === 'all' ? 'All' : CONTENT_STATUS_LABELS[value]}
                  <span className="tabular-nums opacity-80">({counts[value]})</span>
                </Button>
              ))}
            </div>
            <div className="relative w-full lg:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search title or type"
                aria-label="Search recent content checks"
                className="pl-9"
              />
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent className="px-0 pb-2 sm:px-0">
        {checks.length === 0 ? (
          <EmptyState
            compact
            icon={FileSearch}
            title="No content checked yet"
            description="Submit your first piece of content to see its compliance result here."
            action={
              <Button asChild size="sm">
                <Link to="/submit">Check New Content</Link>
              </Button>
            }
          />
        ) : visible.length === 0 ? (
          <EmptyState
            compact
            icon={Search}
            title="No matching checks"
            description="Try a different status or search term."
            action={
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Content</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last checked</TableHead>
                    <TableHead className="text-right">Report</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((check) => (
                    <TableRow key={check.id}>
                      <TableCell className="font-medium">{check.title}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{check.contentType}</TableCell>
                      <TableCell>
                        <ScoreMeter check={check} />
                      </TableCell>
                      <TableCell>
                        <ContentStatusBadge status={check.status} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(check.checkedAt)}</TableCell>
                      <TableCell className="text-right">
                        <ViewReportButton title={check.title} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <ul className="divide-y divide-border md:hidden">
              {visible.map((check) => (
                <li key={check.id} className="space-y-3 px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{check.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {check.contentType} · {formatDate(check.checkedAt)}
                      </p>
                    </div>
                    <ContentStatusBadge status={check.status} />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <ScoreMeter check={check} />
                    <ViewReportButton title={check.title} />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  )
}
