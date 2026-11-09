import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LoadingStateProps {
  label?: string
  /** Centre within the full viewport (used while the app is booting). */
  fullPage?: boolean
  className?: string
}

export function LoadingState({ label = 'Loading…', fullPage, className }: LoadingStateProps) {
  return (
    <div
      role="status"
      className={cn(
        'flex items-center justify-center gap-2 text-sm text-muted-foreground',
        fullPage ? 'min-h-screen' : 'py-10',
        className,
      )}
    >
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('animate-pulse rounded-md bg-muted', className)} />
}
