import { LogOut } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Notice } from '@/components/ui/notice'
import { useAuth } from '@/hooks/use-auth'
import { getDisplayName, getInitials } from '@/lib/user'

export function UserMenu() {
  const { status, user, signOut } = useAuth()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (status !== 'signed_in') {
    return (
      <div className="flex items-center gap-2">
        <span className="hidden text-sm text-muted-foreground sm:inline">Not signed in</span>
        <Button asChild size="sm">
          <Link to="/login">Sign in</Link>
        </Button>
      </div>
    )
  }

  const name = getDisplayName(user)

  async function handleSignOut() {
    setSigningOut(true)
    setError(null)
    const result = await signOut()
    setSigningOut(false)
    // On success the auth state changes and the route guard redirects to /login.
    if (result.error) setError(result.error)
    else setConfirmOpen(false)
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
        >
          {getInitials(name)}
        </span>
        <div className="hidden min-w-0 sm:block">
          <p className="max-w-[12rem] truncate text-sm font-medium">{name}</p>
          {user?.email && name !== user.email && (
            <p className="max-w-[12rem] truncate text-xs text-muted-foreground">{user.email}</p>
          )}
        </div>
        <Button variant="ghost" size="icon" aria-label="Sign out" onClick={() => setConfirmOpen(true)}>
          <LogOut className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign out of BrandGuard AI?</DialogTitle>
            <DialogDescription>You will need to sign in again to access your workspace.</DialogDescription>
          </DialogHeader>
          {error && <Notice tone="error">{error}</Notice>}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button loading={signingOut} onClick={handleSignOut}>
              Sign out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
