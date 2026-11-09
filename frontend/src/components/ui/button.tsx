import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import * as React from 'react'
import { cn } from '@/lib/utils'

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active',
        outline: 'border border-input bg-card text-foreground hover:bg-muted',
        secondary: 'bg-primary-soft text-primary-soft-foreground hover:bg-primary-soft/70',
        ghost: 'text-foreground hover:bg-muted',
        destructive: 'border border-destructive bg-card text-destructive hover:bg-primary-soft',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 px-3',
        lg: 'h-11 px-6',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Render the child element (e.g. a router Link) with button styling. */
  asChild?: boolean
  /** Shows a spinner and disables the button. Ignored with asChild. */
  loading?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, type, children, ...props }, ref) => {
    const classes = cn(buttonVariants({ variant, size }), className)

    if (asChild) {
      return (
        <Slot ref={ref} className={classes} {...props}>
          {children}
        </Slot>
      )
    }

    return (
      <button
        ref={ref}
        type={type ?? 'button'}
        className={classes}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {children}
      </button>
    )
  },
)
Button.displayName = 'Button'
