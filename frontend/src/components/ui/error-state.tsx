import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ErrorStateProps {
  title?: string
  message: string
  onRetry?: () => void
  fullPage?: boolean
  className?: string
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  fullPage,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 text-center',
        fullPage ? 'min-h-screen' : 'py-10',
        className,
      )}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground">
        <AlertTriangle className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}
