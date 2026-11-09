import * as React from 'react'
import { Input, type InputProps } from '@/components/ui/input'

export interface FormFieldProps extends Omit<InputProps, 'id'> {
  id: string
  label: string
  hint?: string
  error?: string
}

/** Label + input + hint/error, wired together for assistive technology. */
export const FormField = React.forwardRef<HTMLInputElement, FormFieldProps>(
  ({ id, label, hint, error, ...props }, ref) => {
    const hintId = `${id}-hint`
    const errorId = `${id}-error`
    const showHint = Boolean(hint) && !error
    const describedBy = error ? errorId : showHint ? hintId : undefined

    return (
      <div className="space-y-1.5">
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </label>
        <Input
          id={id}
          ref={ref}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...props}
        />
        {showHint && (
          <p id={hintId} className="text-xs text-muted-foreground">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} role="alert" className="text-xs font-medium text-destructive">
            {error}
          </p>
        )}
      </div>
    )
  },
)
FormField.displayName = 'FormField'
