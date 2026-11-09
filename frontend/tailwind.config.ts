import type { Config } from 'tailwindcss'

/**
 * Maps Tailwind utilities to the design tokens in src/styles/tokens.css.
 * Change colours, radius or shadows THERE, not here.
 */
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: token('background'),
        foreground: token('foreground'),
        border: token('border'),
        input: token('input'),
        ring: token('ring'),
        card: { DEFAULT: token('card'), foreground: token('card-foreground') },
        muted: { DEFAULT: token('muted'), foreground: token('muted-foreground') },
        primary: {
          DEFAULT: token('primary'),
          hover: token('primary-hover'),
          active: token('primary-active'),
          soft: token('primary-soft'),
          'soft-foreground': token('primary-soft-foreground'),
          foreground: token('primary-foreground'),
        },
        success: { DEFAULT: token('success'), soft: token('success-soft') },
        warning: { DEFAULT: token('warning'), soft: token('warning-soft') },
        destructive: { DEFAULT: token('destructive'), foreground: token('primary-foreground') },
        // Aliases so components added later with the shadcn CLI resolve to brand tokens.
        secondary: { DEFAULT: token('primary-soft'), foreground: token('primary-soft-foreground') },
        accent: { DEFAULT: token('muted'), foreground: token('foreground') },
        popover: { DEFAULT: token('card'), foreground: token('card-foreground') },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        elevated: 'var(--shadow-elevated)',
      },
      fontFamily: { sans: ['var(--font-sans)'] },
      keyframes: {
        'overlay-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'dialog-in': {
          from: { opacity: '0', transform: 'translate(-50%, -48%) scale(0.97)' },
          to: { opacity: '1', transform: 'translate(-50%, -50%) scale(1)' },
        },
      },
      animation: {
        'overlay-in': 'overlay-in 150ms ease-out',
        'dialog-in': 'dialog-in 180ms ease-out',
      },
    },
  },
} satisfies Config
