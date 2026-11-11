import {
  BarChart3,
  BookOpen,
  Building2,
  ClipboardCheck,
  FileSearch,
  PenLine,
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
  { to: '/corrections', label: 'Correction Editor', icon: PenLine },
  { to: '/reviews', label: 'Review & Approval', icon: ClipboardCheck },
  { to: '/history', label: 'Content History', icon: History },
  { to: '/analytics', label: 'Brand Analytics', icon: BarChart3 },
  { to: '/organisation', label: 'Organisation', icon: Building2 },
  { to: '/settings', label: 'Settings', icon: Settings },
]
