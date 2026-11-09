import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'
import { useAuth } from '@/hooks/use-auth'

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { pathname } = useLocation()
  const { status } = useAuth()

  // Close the mobile drawer after navigating.
  useEffect(() => setSidebarOpen(false), [pathname])

  useEffect(() => {
    if (!sidebarOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSidebarOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [sidebarOpen])

  return (
    <div className="min-h-screen bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to main content
      </a>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:pl-64">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />
        {status === 'unconfigured' && (
          <div
            role="status"
            className="border-b border-border bg-primary-soft px-4 py-2 text-center text-sm text-primary-soft-foreground sm:px-6 lg:px-8"
          >
            Development preview: sign-in is not configured, so no account is in use. Add your Supabase keys to{' '}
            <code className="font-mono">frontend/.env.local</code> to enable it.
          </div>
        )}
        <main id="main-content" className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
