/**
 * ResponsiveTable Component
 *
 * Automatically converts table layout to card-based layout on mobile devices.
 * Provides better UX on small screens while maintaining table structure on desktop.
 *
 * Usage:
 * ```tsx
 * <ResponsiveTable
 *   columns={[
 *     { key: 'name', label: 'Name', className: 'font-medium' },
 *     { key: 'status', label: 'Status', render: (item) => <Badge>{item.status}</Badge> },
 *   ]}
 *   data={items}
 *   keyExtractor={(item) => item.id}
 *   onRowClick={(item) => navigate(`/item/${item.id}`)}
 * />
 * ```
 */

import React, { ReactNode } from "react";
import { Card } from "./card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "./table";

export interface ResponsiveTableColumn<T> {
  key: string;
  label: string;
  className?: string;
  headerClassName?: string;
  render?: (item: T, index: number) => ReactNode;
  mobileLabel?: string; // Custom label for mobile view (defaults to label)
  hideOnMobile?: boolean; // Hide this column on mobile
}

export interface ResponsiveTableProps<T> {
  columns: ResponsiveTableColumn<T>[];
  data: T[];
  keyExtractor: (item: T, index: number) => string | number;
  onRowClick?: (item: T, index: number) => void;
  emptyState?: ReactNode;
  loading?: boolean;
  loadingRows?: number;
  className?: string;
  cardClassName?: string;
}

export function ResponsiveTable<T extends Record<string, any>>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  emptyState,
  loading = false,
  loadingRows = 3,
  className = "",
  cardClassName = "",
}: ResponsiveTableProps<T>) {
  // Loading skeleton
  if (loading) {
    return (
      <>
        {/* Desktop loading */}
        <div className="hidden md:block overflow-x-auto">
          <Table className={className}>
            <TableHeader>
              <TableRow>
                {columns.map((col) => (
                  <TableHead key={col.key} className={col.headerClassName}>
                    {col.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: loadingRows }).map((_, i) => (
                <TableRow key={i}>
                  {columns.map((col) => (
                    <TableCell key={col.key}>
                      <div className="h-4 bg-muted animate-pulse rounded"></div>
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Mobile loading */}
        <div className="md:hidden space-y-3">
          {Array.from({ length: loadingRows }).map((_, i) => (
            <Card key={i} className={`p-4 ${cardClassName}`}>
              <div className="space-y-2">
                {columns.filter((col) => !col.hideOnMobile).map((col) => (
                  <div key={col.key} className="h-4 bg-muted animate-pulse rounded"></div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </>
    );
  }

  // Empty state
  if (data.length === 0) {
    return (
      <Card className="p-8">
        {emptyState || (
          <div className="text-center text-muted-foreground">No data available</div>
        )}
      </Card>
    );
  }

  const renderCellContent = (col: ResponsiveTableColumn<T>, item: T, index: number) => {
    if (col.render) {
      return col.render(item, index);
    }
    return item[col.key];
  };

  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <Table className={className}>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key} className={col.headerClassName}>
                  {col.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item, index) => (
              <TableRow
                key={keyExtractor(item, index)}
                onClick={onRowClick ? () => onRowClick(item, index) : undefined}
                className={onRowClick ? "cursor-pointer hover:bg-muted/50" : ""}
              >
                {columns.map((col) => (
                  <TableCell key={col.key} className={col.className}>
                    {renderCellContent(col, item, index)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {data.map((item, index) => (
          <Card
            key={keyExtractor(item, index)}
            className={`p-4 ${onRowClick ? "cursor-pointer hover:bg-muted/50" : ""} ${cardClassName}`}
            onClick={onRowClick ? () => onRowClick(item, index) : undefined}
          >
            <div className="space-y-3">
              {columns
                .filter((col) => !col.hideOnMobile)
                .map((col) => (
                  <div key={col.key} className="flex justify-between items-start gap-3">
                    <span className="text-sm font-medium text-muted-foreground flex-shrink-0">
                      {col.mobileLabel || col.label}:
                    </span>
                    <span className={`text-sm text-foreground text-right ${col.className || ""}`}>
                      {renderCellContent(col, item, index)}
                    </span>
                  </div>
                ))}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

/**
 * ResponsiveTableActions
 *
 * Helper component for action buttons that maintains touch-friendly sizing
 * and proper spacing on mobile devices.
 */
interface ResponsiveTableActionsProps {
  children: ReactNode;
  className?: string;
}

export function ResponsiveTableActions({ children, className = "" }: ResponsiveTableActionsProps) {
  return (
    <div className={`flex items-center gap-2 md:gap-1 ${className}`}>
      {children}
    </div>
  );
}

/**
 * MobileOptimizedButton
 *
 * Button with minimum touch target size (44x44px) for mobile accessibility.
 * Automatically applied via className on mobile devices.
 */
export const mobileButtonClass = "min-h-[44px] md:min-h-0 min-w-[44px] md:min-w-0";

/**
 * ResponsiveContainer
 *
 * Container with responsive padding that adapts to screen size.
 */
interface ResponsiveContainerProps {
  children: ReactNode;
  className?: string;
}

export function ResponsiveContainer({ children, className = "" }: ResponsiveContainerProps) {
  return (
    <div className={`px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 ${className}`}>
      {children}
    </div>
  );
}

/**
 * ResponsiveGrid
 *
 * Grid layout that automatically adjusts columns based on screen size.
 */
interface ResponsiveGridProps {
  children: ReactNode;
  cols?: {
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  gap?: string;
  className?: string;
}

export function ResponsiveGrid({
  children,
  cols = { sm: 1, md: 2, lg: 3, xl: 4 },
  gap = "gap-4",
  className = "",
}: ResponsiveGridProps) {
  const gridClass = `grid grid-cols-${cols.sm || 1} ${cols.md ? `md:grid-cols-${cols.md}` : ""} ${cols.lg ? `lg:grid-cols-${cols.lg}` : ""} ${cols.xl ? `xl:grid-cols-${cols.xl}` : ""} ${gap}`;

  return <div className={`${gridClass} ${className}`}>{children}</div>;
}
