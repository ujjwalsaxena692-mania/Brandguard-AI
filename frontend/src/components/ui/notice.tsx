import { AlertCircle, CheckCircle2, Info, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type NoticeTone = 'info' | 'success' | 'error'

const TONES: Record<NoticeTone, { icon: LucideIcon; classes: string; role: 'status' | 'alert' }> = {
  info: { icon: Info, classes: 'border-border bg-muted text-foreground', role: 'status' },
  success: { icon: CheckCircle2, classes: 'border-success/30 bg-success-soft text-success', role: 'status' },
  error: { icon: AlertCircle, classes: 'border-primary/30 bg-primary-soft text-primary-soft-foreground', role: 'alert' },
}

/** Inline message with an icon, so tone is never conveyed by colour alone. */
export function Notice({ tone = 'info', children, className }: { tone?: NoticeTone; children: ReactNode; className?: string }) {
  const { icon: Icon, classes, role } = TONES[tone]
  return (
    <div role={role} className={cn('flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm', classes, className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  )
}
