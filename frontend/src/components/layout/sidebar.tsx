import { X } from 'lucide-react'
import { Logo } from '@/components/brand/logo'
import { SidebarItem } from '@/components/layout/sidebar-item'
import { Button } from '@/components/ui/button'
import { NAV_ITEMS } from '@/lib/navigation'
import { cn } from '@/lib/utils'

interface SidebarProps {
  /** Only affects screens narrower than lg; on desktop the sidebar is always shown. */
  open: boolean
  onClose: () => void
}

export function Sidebar({ open, onClose }: SidebarProps) {
  return (
    <>
      {open && (
        <div className="fixed inset-0 z-30 bg-foreground/40 lg:hidden" onClick={onClose} aria-hidden="true" />
      )}
      <aside
        id="app-sidebar"
        aria-label="Sidebar"
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-card transition-[transform,visibility] duration-200 lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full max-lg:invisible',
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-border px-5">
          <Logo />
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={onClose} aria-label="Close navigation">
            <X className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>
        <nav aria-label="Main navigation" className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV_ITEMS.map((item) => (
            <SidebarItem key={item.to} {...item} />
          ))}
        </nav>
        <p className="border-t border-border px-5 py-4 text-xs text-muted-foreground">
          One Brand. Every Voice. Zero Compromise.
        </p>
      </aside>
    </>
  )
}
