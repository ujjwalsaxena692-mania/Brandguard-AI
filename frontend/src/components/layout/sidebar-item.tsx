import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import type { NavItem } from '@/lib/navigation'

/** Active route gets the solid brand red; NavLink sets aria-current="page". */
export function SidebarItem({ to, label, icon: Icon, end }: NavItem) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
          isActive
            ? 'bg-primary text-primary-foreground'
            : 'text-foreground hover:bg-muted',
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </NavLink>
  )
}
