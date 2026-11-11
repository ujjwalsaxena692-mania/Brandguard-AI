import { FILTER_LABELS, FILTERS } from '@/lib/correction'
import { cn } from '@/lib/utils'
import type { SuggestionFilter, SuggestionStatus } from '@/types/correction'

interface SuggestionFiltersProps {
  filter: SuggestionFilter
  onChange: (filter: SuggestionFilter) => void
  counts: Record<SuggestionStatus, number>
  total: number
}

export function SuggestionFilters({ filter, onChange, counts, total }: SuggestionFiltersProps) {
  const countFor = (value: SuggestionFilter) => (value === 'all' ? total : counts[value])
  return (
    <div className="space-y-2">
      <p className="text-sm tabular-nums" role="status">
        <span className="font-semibold">{counts.pending}</span> pending · <span className="font-semibold">{counts.accepted}</span> accepted ·{' '}
        <span className="font-semibold">{counts.rejected}</span> rejected
      </p>
      <div role="tablist" aria-label="Filter suggestions by status" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {FILTERS.map((value) => {
          const selected = filter === value
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(value)}
              className={cn(
                'shrink-0 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                selected ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted',
              )}
            >
              {FILTER_LABELS[value]}
              <span className="ml-1.5 tabular-nums opacity-80">({countFor(value)})</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
