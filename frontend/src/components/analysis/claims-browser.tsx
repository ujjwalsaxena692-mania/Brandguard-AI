import { Search, SearchX } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { FilterSelect } from '@/components/knowledge/fields'
import {
  CLASSIFICATIONS,
  CLASSIFICATION_DESCRIPTIONS,
  CLASSIFICATION_LABELS,
  SEVERITIES,
  SEVERITY_LABELS,
  countClaims,
  filterClaims,
  sortBySeverity,
} from '@/lib/analysis'
import { cn } from '@/lib/utils'
import type { AnalysisClaim, ClaimClassification, ClaimSeverity } from '@/types/analysis'
import { ClaimCard } from './claim-card'
import { ClaimDetailDialog } from './claim-detail-dialog'

type Tab = 'all' | ClaimClassification

// Contradicted claims first: they are the ones a reviewer must act on.
const GROUP_ORDER: readonly ClaimClassification[] = ['contradicted', 'unsupported', 'supported']

interface ClaimsBrowserProps {
  claims: AnalysisClaim[]
  isDemo: boolean
}

export function ClaimsBrowser({ claims, isDemo }: ClaimsBrowserProps) {
  const [tab, setTab] = useState<Tab>('all')
  const [severity, setSeverity] = useState<'all' | ClaimSeverity>('all')
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  // Tab counts reflect the severity and search filters, so each count matches what that tab would show.
  const filtered = useMemo(() => filterClaims(claims, { severity, query }), [claims, severity, query])
  const counts = useMemo(() => countClaims(filtered), [filtered])
  const visible = tab === 'all' ? filtered : filtered.filter((claim) => claim.classification === tab)
  const filtersActive = severity !== 'all' || query.trim() !== '' || tab !== 'all'
  const openClaim = claims.find((claim) => claim.id === openId) ?? null

  const clearFilters = () => {
    setTab('all')
    setSeverity('all')
    setQuery('')
  }

  const tabs: readonly Tab[] = ['all', ...CLASSIFICATIONS]
  const tabCount = (value: Tab) => (value === 'all' ? filtered.length : counts[value])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Claims found in the content</CardTitle>
        <CardDescription>
          Each claim is classified against approved brand knowledge. Unsupported does not mean false.
        </CardDescription>

        <div role="tablist" aria-label="Claim classification" className="-mx-1 mt-3 flex gap-1 overflow-x-auto px-1 pb-1">
          {tabs.map((value) => {
            const selected = tab === value
            return (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setTab(value)}
                className={cn(
                  'shrink-0 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  selected ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted',
                )}
              >
                {value === 'all' ? 'All' : CLASSIFICATION_LABELS[value]}
                <span className="ml-1.5 tabular-nums opacity-80">({tabCount(value)})</span>
              </button>
            )
          })}
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search claims, knowledge or references"
              aria-label="Search claims"
              className="pl-9"
            />
          </div>
          <FilterSelect
            aria-label="Filter by severity"
            value={severity}
            onChange={(event) => setSeverity(event.target.value as 'all' | ClaimSeverity)}
            className="sm:w-44"
          >
            <option value="all">All severities</option>
            {SEVERITIES.map((value) => (
              <option key={value} value={value}>
                {SEVERITY_LABELS[value]}
              </option>
            ))}
          </FilterSelect>
        </div>

        <p className="mt-1 text-xs text-muted-foreground" role="status">
          Showing {visible.length} of {claims.length} {claims.length === 1 ? 'claim' : 'claims'}
          {filtersActive && (
            <>
              {' · '}
              <button type="button" onClick={clearFilters} className="font-medium text-primary underline-offset-4 hover:underline">
                Clear filters
              </button>
            </>
          )}
        </p>
      </CardHeader>

      <CardContent className="space-y-8">
        {claims.length === 0 ? (
          <EmptyState compact icon={SearchX} title="No claims were identified" description="The analysis did not find any checkable claims in this content." />
        ) : visible.length === 0 ? (
          <EmptyState
            compact
            icon={Search}
            title="No matching claims"
            description="Try a different search, severity or classification."
            action={
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          GROUP_ORDER.map((group) => {
            const items = sortBySeverity(visible.filter((claim) => claim.classification === group))
            if (items.length === 0) return null
            return (
              <section key={group} aria-labelledby={`group-${group}`} className="space-y-3">
                <div>
                  <h3 id={`group-${group}`} className="text-base font-semibold">
                    {CLASSIFICATION_LABELS[group]} claims ({items.length})
                  </h3>
                  <p className="text-sm text-muted-foreground">{CLASSIFICATION_DESCRIPTIONS[group]}</p>
                </div>
                <div className="space-y-3">
                  {items.map((claim) => (
                    <ClaimCard key={claim.id} claim={claim} isDemo={isDemo} onOpen={(next) => setOpenId(next.id)} />
                  ))}
                </div>
              </section>
            )
          })
        )}
      </CardContent>

      <ClaimDetailDialog claim={openClaim} isDemo={isDemo} onClose={() => setOpenId(null)} />
    </Card>
  )
}
