import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { getHealth } from '@/services/system'
import { useApiQuery } from '@/hooks/use-api-query'

/** Real backend reachability, from GET /health. Icon + text, never colour alone. */
export function ApiStatus() {
  const { data, error, loading } = useApiQuery(getHealth)

  let icon = <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
  let label = 'API online'
  if (loading) {
    icon = <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
    label = 'Checking API…'
  } else if (error || !data) {
    icon = <AlertCircle className="h-4 w-4 text-destructive" aria-hidden="true" />
    label = 'API unreachable'
  }

  return (
    <div role="status" className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      {icon}
      <span className="hidden sm:inline">{label}</span>
      <span className="sr-only sm:hidden">{label}</span>
    </div>
  )
}
