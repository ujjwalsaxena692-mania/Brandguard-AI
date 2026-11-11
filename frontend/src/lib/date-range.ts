import type { DateRangeFilter, DateRangePreset, ResolvedRange } from '@/types/insights'

const DAY = 24 * 60 * 60 * 1000

export const DEFAULT_RANGE: DateRangeFilter = { preset: 'all', customFrom: '', customTo: '' }

export const RANGE_OPTIONS: readonly { value: DateRangePreset; label: string }[] = [
  { value: 'last_7', label: 'Last 7 days' },
  { value: 'last_30', label: 'Last 30 days' },
  { value: 'last_90', label: 'Last 90 days' },
  { value: 'all', label: 'All available time' },
  { value: 'custom', label: 'Custom range' },
]

const PRESET_DAYS: Partial<Record<DateRangePreset, number>> = { last_7: 7, last_30: 30, last_90: 90 }

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/** Parses YYYY-MM-DD as a local calendar date. Returns null for anything that is not a real date. */
export function parseLocalDate(value: string): Date | null {
  const match = ISO_DATE.exec(value)
  if (!match) return null
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(year, month - 1, day)
  const valid = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
  return valid ? date : null
}

const displayFormatter = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

function formatDay(date: Date): string {
  return displayFormatter.format(date)
}

/**
 * Turns the filter into concrete bounds.
 *
 * Presets are "the last N days up to now": they have a lower bound only, so a record created after the
 * range was resolved is never excluded by a stale upper bound. A custom range covers the whole of both
 * end days. An incomplete or reversed custom range is not applied (it behaves as "all") and sets `error`,
 * so the page can say so instead of silently showing different data.
 */
export function resolveRange(filter: DateRangeFilter, nowMs: number): ResolvedRange {
  const days = PRESET_DAYS[filter.preset]
  if (days !== undefined) {
    const label = days === 7 ? 'Last 7 days' : days === 30 ? 'Last 30 days' : 'Last 90 days'
    return { preset: filter.preset, from: nowMs - days * DAY, to: null, label, error: null }
  }

  if (filter.preset === 'custom') {
    const from = parseLocalDate(filter.customFrom)
    const to = parseLocalDate(filter.customTo)
    const all = (error: string): ResolvedRange => ({
      preset: 'custom',
      from: null,
      to: null,
      label: 'All available time (custom range not applied)',
      error,
    })
    if (!from || !to) return all('Choose both a start and an end date to apply a custom range. Showing all available time until then.')
    if (from.getTime() > to.getTime()) return all('The start date is after the end date. Showing all available time until it is fixed.')
    const endOfDay = new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1).getTime() - 1
    return {
      preset: 'custom',
      from: from.getTime(),
      to: endOfDay,
      label: `${formatDay(from)} to ${formatDay(to)}`,
      error: null,
    }
  }

  return { preset: 'all', from: null, to: null, label: 'All available time', error: null }
}

/** Epoch milliseconds for an ISO string, or null when it is missing or not a valid date. */
export function toTime(iso: string | null | undefined): number | null {
  if (!iso) return null
  const value = Date.parse(iso)
  return Number.isNaN(value) ? null : value
}

/** True when the timestamp lies inside the range. An unusable timestamp is only "inside" an unbounded range. */
export function isInRange(iso: string | null | undefined, range: Pick<ResolvedRange, 'from' | 'to'>): boolean {
  if (range.from === null && range.to === null) return true
  const time = toTime(iso)
  if (time === null) return false
  if (range.from !== null && time < range.from) return false
  if (range.to !== null && time > range.to) return false
  return true
}

export function isRangeActive(filter: DateRangeFilter): boolean {
  return filter.preset !== 'all'
}
