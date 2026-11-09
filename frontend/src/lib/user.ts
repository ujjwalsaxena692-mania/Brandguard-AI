import type { User } from '@supabase/supabase-js'

export function getDisplayName(user: User | null): string | null {
  if (!user) return null
  const fullName = user.user_metadata?.full_name
  if (typeof fullName === 'string' && fullName.trim()) return fullName.trim()
  return user.email ?? null
}

export function getInitials(name: string | null): string {
  if (!name) return '?'
  const parts = name.split(/[\s@._-]+/).filter(Boolean)
  const letters = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '')
  return letters.join('') || '?'
}
