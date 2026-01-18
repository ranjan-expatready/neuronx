/**
 * Component Exports - WI-069: Branding Kit + UI Beautification
 *
 * Central export file for all design system components.
 */

export { Button } from './Button';
export type { ButtonProps } from './Button';

export { Badge, StatusBadge } from './Badge';
export type { BadgeProps, StatusBadgeProps } from './Badge';

export { Card, CardHeader, CardContent, CardFooter } from './Card';
export type {
  CardProps,
  CardHeaderProps,
  CardContentProps,
  CardFooterProps,
} from './Card';

export { Table, TableHeader, TableBody, TableRow, TableCell } from './Table';
export type {
  TableProps,
  TableHeaderProps,
  TableBodyProps,
  TableRowProps,
  TableCellProps,
} from './Table';

export { Drawer } from './Drawer';
export type { DrawerProps } from './Drawer';

// Placeholder exports for components to be implemented
export const Tabs = () => null;
export const Toast = () => null;
export const SkeletonLoader = () => null;
export const EmptyState = () => null;
export const PageHeader = () => null;
