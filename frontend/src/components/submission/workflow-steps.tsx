import { cn } from '@/lib/utils'

const STEPS = [
  { title: 'Submit content', note: 'You are here' },
  { title: 'AI brand analysis', note: 'Next step, not started' },
  { title: 'Human review and approval', note: 'After analysis' },
] as const

/** Shows where this page sits in the workflow. Only step 1 is active. */
export function WorkflowSteps() {
  return (
    <ol aria-label="Review workflow" className="mb-6 grid gap-2 sm:grid-cols-3">
      {STEPS.map((step, index) => {
        const current = index === 0
        return (
          <li
            key={step.title}
            aria-current={current ? 'step' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-lg border px-4 py-3',
              current ? 'border-primary bg-primary-soft' : 'border-border bg-card',
            )}
          >
            <span
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                current ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
              )}
            >
              {index + 1}
            </span>
            <span className="min-w-0">
              <span className={cn('block text-sm font-medium', !current && 'text-muted-foreground')}>{step.title}</span>
              <span className="block text-xs text-muted-foreground">{step.note}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}
