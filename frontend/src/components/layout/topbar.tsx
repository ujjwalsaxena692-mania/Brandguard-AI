import { Menu } from 'lucide-react'
import { Logo } from '@/components/brand/logo'
import { ApiStatus } from '@/components/layout/api-status'
import { UserMenu } from '@/components/layout/user-menu'
import { Button } from '@/components/ui/button'

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-card/95 px-4 backdrop-blur sm:px-6 lg:px-8">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMenuClick}
        aria-label="Open navigation"
        aria-controls="app-sidebar"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </Button>
      <div className="lg:hidden">
        <Logo />
      </div>
      <div className="ml-auto flex items-center gap-4">
        <ApiStatus />
        <UserMenu />
      </div>
    </header>
  )
}
