/**
 * The organisation a user has chosen when they belong to several.
 *
 * This is only a *selector* sent as `X-Organisation-Id`. It is not a credential and grants
 * nothing: the backend looks the caller's membership up from the verified token and answers 403
 * for any organisation they are not an active member of. Kept in localStorage so the choice
 * survives a reload; cleared on sign-out.
 */
const STORAGE_KEY = 'brandguard.activeOrganisationId'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function readStored(): string | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    return value && UUID.test(value) ? value : null
  } catch {
    return null // storage can be unavailable (private mode, blocked cookies)
  }
}

let current: string | null = readStored()

export function getActiveOrganisationId(): string | null {
  return current
}

export function setActiveOrganisationId(id: string | null): void {
  current = id && UUID.test(id) ? id : null
  try {
    if (current) window.localStorage.setItem(STORAGE_KEY, current)
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* the in-memory value still applies for this session */
  }
}
