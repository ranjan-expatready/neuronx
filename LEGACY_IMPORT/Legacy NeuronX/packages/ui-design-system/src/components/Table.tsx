/**
 * Table Component - WI-069: Branding Kit + UI Beautification
 *
 * Enterprise-grade table with proper theming and responsive design.
 */

import React from 'react';
import { clsx } from 'clsx';

export interface TableProps {
  children: React.ReactNode;
  className?: string;
}

export function Table({ children, className }: TableProps) {
  return (
    <div className='overflow-x-auto'>
      <table
        className={clsx('min-w-full divide-y divide-neutral-200', className)}
      >
        {children}
      </table>
    </div>
  );
}

export interface TableHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function TableHeader({ children, className }: TableHeaderProps) {
  return <thead className={clsx('bg-neutral-50', className)}>{children}</thead>;
}

export interface TableBodyProps {
  children: React.ReactNode;
  className?: string;
}

export function TableBody({ children, className }: TableBodyProps) {
  return (
    <tbody className={clsx('bg-white divide-y divide-neutral-200', className)}>
      {children}
    </tbody>
  );
}

export interface TableRowProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export function TableRow({ children, className, hover = true }: TableRowProps) {
  return (
    <tr className={clsx(hover && 'hover:bg-neutral-50', className)}>
      {children}
    </tr>
  );
}

export interface TableCellProps {
  children: React.ReactNode;
  className?: string;
  header?: boolean;
}

export function TableCell({
  children,
  className,
  header = false,
}: TableCellProps) {
  const Component = header ? 'th' : 'td';
  return (
    <Component
      className={clsx(
        'px-6 py-4 text-sm',
        header
          ? 'text-left text-xs font-medium text-neutral-500 uppercase tracking-wider'
          : 'text-neutral-900 whitespace-nowrap',
        className
      )}
    >
      {children}
    </Component>
  );
}
