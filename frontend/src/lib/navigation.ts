import {
  BarChart3,
  BookOpen,
  ClipboardCheck,
  FileSearch,
  FileUp,
  History,
  LayoutDashboard,
  Settings,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/knowledge-hub', label: 'Brand Knowledge Hub', icon: BookOpen },
  { to: '/submit', label: 'Content Submission', icon: FileUp },
  { to: '/reports', label: 'Analysis Reports', icon: FileSearch },
  { to: '/approvals', label: 'Approval Queue', icon: ClipboardCheck },
  { to: '/history', label: 'Revision History', icon: History },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
]
