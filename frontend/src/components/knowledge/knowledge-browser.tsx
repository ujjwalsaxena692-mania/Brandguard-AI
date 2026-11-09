import { BookOpen, Eye, Pencil, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { formatDate } from '@/components/dashboard/format'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CATEGORIES, CATEGORY_LABELS, STATUSES, STATUS_LABELS, SUBTYPES } from '@/lib/knowledge'
import { cn } from '@/lib/utils'
import type { KnowledgeCategory, KnowledgeEntry, KnowledgeStatus } from '@/types/knowledge'
import { CATEGORY_META } from './categories'
import { FilterSelect } from './fields'
import { KnowledgeStatusCell } from './status'

type CategoryFilter = 'all' | KnowledgeCategory
type StatusFilter = 'all' | KnowledgeStatus
type SortKey = 'updated_desc' | 'updated_asc' | 'title_asc' | 'title_desc'

const SORT_OPTIONS: readonly { value: SortKey; label: string }[] = [
  { value: 'updated_desc', label: 'Recently updated' },
  { value: 'updated_asc', label: 'Least recently updated' },
  { value: 'title_asc', label: 'Title A to Z' },
  { value: 'title_desc', label: 'Title Z to A' },
]

interface KnowledgeBrowserProps {
  entries: KnowledgeEntry[]
  onAdd: () => void
  onView: (entry: KnowledgeEntry) => void
  onEdit: (entry: KnowledgeEntry) => void
  onDelete: (entry: KnowledgeEntry) => void
}

function RowActions({ entry, onView, onEdit, onDelete }: Omit<KnowledgeBrowserProps, 'entries' | 'onAdd'> & { entry: KnowledgeEntry }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Button variant="ghost" size="icon" onClick={() => onView(entry)} aria-label={`View ${entry.title}`}>
        <Eye className="h-4 w-4" aria-hidden="true" />
      </Button>
      <Button variant="ghost" size="icon" onClick={() => onEdit(entry)} aria-label={`Edit ${entry.title}`}>
        <Pencil className="h-4 w-4" aria-hidden="true" />
      </Button>
      <Button variant="ghost" size="icon" onClick={() => onDelete(entry)} aria-label={`Delete ${entry.title}`}>
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  )
}

export function KnowledgeBrowser({ entries, onAdd, onView, onEdit, onDelete }: KnowledgeBrowserProps) {
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [subtype, setSubtype] = useState('all')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('updated_desc')

  const categoryCounts = useMemo(() => {
    const counts: Record<CategoryFilter, number> = { all: entries.length, guidelines: 0, facts: 0, claims: 0, terminology: 0, assets: 0 }
    for (const entry of entries) counts[entry.category] += 1
    return counts
  }, [entries])

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase()
    const filtered = entries.filter(
      (entry) =>
        (category === 'all' || entry.category === category) &&
        (subtype === 'all' || entry.subtype === subtype) &&
        (status === 'all' || entry.status === status) &&
        (term === '' ||
          `${entry.title} ${entry.description} ${entry.subtype} ${entry.source} ${entry.evidence}`.toLowerCase().includes(term)),
    )
    return [...filtered].sort((a, b) => {
      switch (sort) {
        case 'updated_asc':
          return a.updatedAt.localeCompare(b.updatedAt)
        case 'title_asc':
          return a.title.localeCompare(b.title)
        case 'title_desc':
          return b.title.localeCompare(a.title)
        default:
          return b.updatedAt.localeCompare(a.updatedAt)
      }
    })
  }, [entries, category, subtype, status, query, sort])

  const filtersActive = category !== 'all' || subtype !== 'all' || status !== 'all' || query.trim() !== ''

  const clearFilters = () => {
    setCategory('all')
    setSubtype('all')
    setStatus('all')
    setQuery('')
  }

  const selectCategory = (next: CategoryFilter) => {
    setCategory(next)
    setSubtype('all') // a type from another category would match nothing
  }

  const tabs: readonly CategoryFilter[] = ['all', ...CATEGORIES]
  const actions = { onView, onEdit, onDelete }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Knowledge entries</CardTitle>
        <CardDescription>
          Only approved, in-date entries count as authoritative brand evidence. Drafts and entries pending review do not.
        </CardDescription>

        <div role="tablist" aria-label="Knowledge categories" className="-mx-1 mt-3 flex gap-1 overflow-x-auto px-1 pb-1">
          {tabs.map((tab) => {
            const selected = category === tab
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => selectCategory(tab)}
                className={cn(
                  'shrink-0 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  selected ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted',
                )}
              >
                {tab === 'all' ? 'All' : CATEGORY_LABELS[tab]}
                <span className="ml-1.5 tabular-nums opacity-80">({categoryCounts[tab]})</span>
              </button>
            )
          })}
        </div>
        {category !== 'all' && <p className="mt-2 text-sm text-muted-foreground">{CATEGORY_META[category].description}</p>}

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search title, text or source"
              aria-label="Search knowledge entries"
              className="pl-9"
            />
          </div>
          <FilterSelect
            aria-label="Filter by knowledge type"
            value={subtype}
            onChange={(event) => setSubtype(event.target.value)}
            disabled={category === 'all'}
            className="lg:w-48"
          >
            <option value="all">{category === 'all' ? 'Type (pick a category)' : 'All types'}</option>
            {category !== 'all' &&
              SUBTYPES[category].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
          </FilterSelect>
          <FilterSelect
            aria-label="Filter by status"
            value={status}
            onChange={(event) => setStatus(event.target.value as StatusFilter)}
            className="lg:w-44"
          >
            <option value="all">All statuses</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABELS[value]}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect aria-label="Sort entries" value={sort} onChange={(event) => setSort(event.target.value as SortKey)} className="lg:w-48">
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </FilterSelect>
        </div>

        {entries.length > 0 && (
          <p className="mt-1 text-xs text-muted-foreground" role="status">
            Showing {visible.length} of {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
            {filtersActive && (
              <>
                {' · '}
                <button type="button" onClick={clearFilters} className="font-medium text-primary underline-offset-4 hover:underline">
                  Clear filters
                </button>
              </>
            )}
          </p>
        )}
      </CardHeader>

      <CardContent className="px-0 pb-2 sm:px-0">
        {entries.length === 0 ? (
          <EmptyState
            compact
            icon={BookOpen}
            title="No knowledge yet"
            description="Add your first guideline, fact, claim, term or asset to start building your approved brand knowledge."
            action={<Button size="sm" onClick={onAdd}>Add Knowledge</Button>}
          />
        ) : visible.length === 0 ? (
          <EmptyState
            compact
            icon={Search}
            title="No matching entries"
            description="Try a different search term, category or status."
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
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="max-w-sm">
                        <button
                          type="button"
                          onClick={() => onView(entry)}
                          className="text-left font-medium hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {entry.title}
                        </button>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{entry.description}</p>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <p>{CATEGORY_LABELS[entry.category]}</p>
                        <p className="text-xs text-muted-foreground">{entry.subtype}</p>
                      </TableCell>
                      <TableCell>
                        <KnowledgeStatusCell entry={entry} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(entry.updatedAt)}</TableCell>
                      <TableCell>
                        <RowActions entry={entry} {...actions} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <ul className="divide-y divide-border md:hidden">
              {visible.map((entry) => (
                <li key={entry.id} className="space-y-2 px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <button type="button" onClick={() => onView(entry)} className="min-w-0 text-left font-medium hover:text-primary">
                      {entry.title}
                    </button>
                    <KnowledgeStatusCell entry={entry} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {CATEGORY_LABELS[entry.category]} · {entry.subtype} · Updated {formatDate(entry.updatedAt)}
                  </p>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{entry.description}</p>
                  <RowActions entry={entry} {...actions} />
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  )
}
