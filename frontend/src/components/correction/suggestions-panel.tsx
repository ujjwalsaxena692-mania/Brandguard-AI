import { SearchX, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Notice } from '@/components/ui/notice'
import type { CorrectionActions } from '@/hooks/use-correction-store'
import { countStatuses, filterSuggestions, findOverlaps, getApplicability } from '@/lib/correction'
import type { ActionResult, CorrectionCase, EditorSession, SuggestionFilter } from '@/types/correction'
import { CorrectionSuggestionCard } from './correction-suggestion-card'
import { SuggestionDetailDialog } from './suggestion-detail-dialog'
import { SuggestionFilters } from './suggestion-filters'

interface Feedback {
  tone: 'success' | 'error' | 'info'
  message: string
}

interface SuggestionsPanelProps {
  correctionCase: CorrectionCase
  session: EditorSession
  actions: CorrectionActions
}

export function SuggestionsPanel({ correctionCase, session, actions }: SuggestionsPanelProps) {
  const { suggestions, isDemo, originalContent } = correctionCase
  const [filter, setFilter] = useState<SuggestionFilter>('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  const counts = countStatuses(suggestions, session.statuses)
  const visible = filterSuggestions(suggestions, session.statuses, filter)
  const overlaps = useMemo(() => findOverlaps(originalContent, suggestions), [originalContent, suggestions])
  const titleOf = (id: string) => suggestions.find((item) => item.id === id)?.originalText.trim() ?? id
  const openSuggestion = suggestions.find((item) => item.id === openId) ?? null

  const report = (result: ActionResult, success: string) =>
    setFeedback(result.ok ? { tone: 'success', message: success } : { tone: 'error', message: result.message })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
          {isDemo ? 'Demo suggestions' : 'Suggestions'}
        </CardTitle>
        <CardDescription>
          {isDemo
            ? 'Hand-written examples, not AI output. Nothing is applied unless you accept it.'
            : 'Nothing is applied unless you accept it.'}
        </CardDescription>
        <div className="mt-3">
          <SuggestionFilters filter={filter} onChange={setFilter} counts={counts} total={suggestions.length} />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {feedback && <Notice tone={feedback.tone}>{feedback.message}</Notice>}

        {suggestions.length === 0 ? (
          <EmptyState compact icon={SearchX} title="No suggestions for this content" description="There is nothing to correct automatically. You can still edit the corrected content by hand." />
        ) : visible.length === 0 ? (
          <EmptyState
            compact
            icon={SearchX}
            title={`No ${filter} suggestions`}
            description="Choose another filter to see the rest."
            action={
              <Button variant="outline" size="sm" onClick={() => setFilter('all')}>
                Show all suggestions
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {visible.map((suggestion) => {
              const status = session.statuses[suggestion.id] ?? 'pending'
              return (
                <CorrectionSuggestionCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  status={status}
                  applicability={getApplicability(session.text, suggestion)}
                  isDemo={isDemo}
                  overlapTitles={(overlaps[suggestion.id] ?? []).map(titleOf)}
                  appliedTextPresent={suggestion.suggestedText === '' || session.text.includes(suggestion.suggestedText)}
                  onAccept={(id) => report(actions.accept(id), 'Suggestion accepted and applied to the corrected content. You can still edit it or undo the last correction.')}
                  onReject={(id) => report(actions.reject(id), 'Suggestion rejected. The corrected content was not changed.')}
                  onReconsider={(id) => report(actions.reconsider(id), 'Suggestion is pending again. The corrected content was not changed.')}
                  onDetails={setOpenId}
                />
              )
            })}
          </div>
        )}
      </CardContent>

      <SuggestionDetailDialog
        suggestion={openSuggestion}
        status={openSuggestion ? (session.statuses[openSuggestion.id] ?? 'pending') : 'pending'}
        applicability={openSuggestion ? getApplicability(session.text, openSuggestion) : { state: 'applicable' }}
        isDemo={isDemo}
        onClose={() => setOpenId(null)}
      />
    </Card>
  )
}
