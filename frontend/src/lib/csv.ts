/**
 * Minimal CSV writer (RFC 4180), with no dependencies.
 *
 * - Fields containing a comma, a double quote, a CR or an LF are wrapped in quotes, and inner quotes are doubled.
 * - Text that a spreadsheet would read as a formula (starts with = + - @ tab or CR) is prefixed with an
 *   apostrophe, so content such as a title beginning with "=" cannot execute when the file is opened.
 * - Numbers are written as-is, so a negative number is not mistaken for text.
 */
export type CsvValue = string | number | boolean | null | undefined

const FORMULA_START = /^[=+\-@\t\r]/

export function escapeCsvField(value: CsvValue): string {
  if (value === null || value === undefined) return ''
  let text: string
  if (typeof value === 'number') {
    text = Number.isFinite(value) ? String(value) : ''
  } else if (typeof value === 'boolean') {
    text = value ? 'true' : 'false'
  } else {
    text = FORMULA_START.test(value) ? `'${value}` : value
  }
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** Header row plus data rows, joined with CRLF and ending with a final CRLF. */
export function toCsv(headers: readonly string[], rows: readonly (readonly CsvValue[])[]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvField).join(','))
  return `${lines.join('\r\n')}\r\n`
}

/** Letters, digits and hyphens only, so it is safe in a filename. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** YYYY-MM-DD in local time. */
export function dateStamp(date: Date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** Triggers a browser download. Returns false when the environment cannot do it. */
export function downloadTextFile(filename: string, content: string): boolean {
  if (typeof document === 'undefined' || typeof Blob === 'undefined' || typeof URL.createObjectURL !== 'function') return false
  try {
    // The BOM makes Excel read the file as UTF-8, so accented characters survive.
    const blob = new Blob(['\uFEFF', content], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.rel = 'noopener'
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    return true
  } catch {
    return false
  }
}
