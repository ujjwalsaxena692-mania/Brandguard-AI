/** Resolve a design-token CSS variable (RGB channels) into a CSS colour string. */
export function cssColor(variable: string): string {
  const channels = getComputedStyle(document.documentElement).getPropertyValue(variable).trim()
  return channels ? `rgb(${channels})` : 'currentColor'
}
