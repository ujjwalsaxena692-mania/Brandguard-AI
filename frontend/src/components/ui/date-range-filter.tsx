import { FilterSelect } from '@/components/review/filter-select'
import { Input } from '@/components/ui/input'
import { RANGE_OPTIONS } from '@/lib/date-range'
import type { DateRangeFilter as DateRangeValue, DateRangePreset } from '@/types/insights'

interface DateRangeFilterProps {
  idPrefix: string
  value: DateRangeValue
  onChange: (value: DateRangeValue) => void
  /** Message about an incomplete custom range, shown next to the inputs. */
  error?: string | null
}

/**
 * Date range selector: presets, plus two native date inputs for a custom range.
 * The project has no calendar-popover component, so native inputs are used: they keep keyboard
 * and screen-reader behaviour, and the value is always a plain YYYY-MM-DD string.
 */
export function DateRangeFilter({ idPrefix, value, onChange, error }: DateRangeFilterProps) {
  const custom = value.preset === 'custom'
  const describedBy = error ? `${idPrefix}-range-error` : undefined

  return (
    <>
      <FilterSelect<DateRangePreset>
        id={`${idPrefix}-range`}
        label="Date range"
        value={value.preset}
        options={RANGE_OPTIONS}
        onChange={(preset) => onChange({ ...value, preset })}
      />
      {custom && (
        <>
          <div className="space-y-1.5">
            <label htmlFor={`${idPrefix}-from`} className="text-xs font-medium text-muted-foreground">
              From
            </label>
            <Input
              id={`${idPrefix}-from`}
              type="date"
              value={value.customFrom}
              max={value.customTo || undefined}
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy}
              onChange={(event) => onChange({ ...value, customFrom: event.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`${idPrefix}-to`} className="text-xs font-medium text-muted-foreground">
              To
            </label>
            <Input
              id={`${idPrefix}-to`}
              type="date"
              value={value.customTo}
              min={value.customFrom || undefined}
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy}
              onChange={(event) => onChange({ ...value, customTo: event.target.value })}
            />
          </div>
        </>
      )}
    </>
  )
}
