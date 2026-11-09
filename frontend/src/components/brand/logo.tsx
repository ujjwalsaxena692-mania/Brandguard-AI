import { ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LogoProps {
  /** Use on a red background: white mark and white text. */
  inverted?: boolean
  className?: string
}

export function Logo({ inverted, className }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-lg',
          inverted ? 'bg-primary-foreground text-primary' : 'bg-primary text-primary-foreground',
        )}
      >
        <ShieldCheck className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className={cn('text-lg font-semibold tracking-tight', inverted ? 'text-primary-foreground' : 'text-foreground')}>
        BrandGuard <span className={inverted ? 'text-primary-foreground' : 'text-primary'}>AI</span>
      </span>
    </span>
  )
}
