import { Inbox } from 'lucide-react'
import * as React from 'react'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'

export const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="w-full overflow-x-auto">
      <table ref={ref} className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  ),
)
Table.displayName = 'Table'

export const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <thead ref={ref} className={cn('border-b border-border bg-muted/60', className)} {...props} />
  ),
)
TableHeader.displayName = 'TableHeader'

export const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <tbody ref={ref} className={cn('[&_tr:last-child]:border-0', className)} {...props} />,
)
TableBody.displayName = 'TableBody'

export const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr ref={ref} className={cn('border-b border-border transition-colors hover:bg-muted/40', className)} {...props} />
  ),
)
TableRow.displayName = 'TableRow'

export const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      scope="col"
      className={cn('h-10 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground', className)}
      {...props}
    />
  ),
)
TableHead.displayName = 'TableHead'

export const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => <td ref={ref} className={cn('px-4 py-3 align-middle', className)} {...props} />,
)
TableCell.displayName = 'TableCell'

/** A full-width row that shows an empty state inside a table body. */
export function TableEmptyRow({ colSpan, title, description }: { colSpan: number; title: string; description?: string }) {
  return (
    <tr>
      <td colSpan={colSpan}>
        <EmptyState compact icon={Inbox} title={title} description={description} />
      </td>
    </tr>
  )
}
