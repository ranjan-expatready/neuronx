/**
 * Badge Component - WI-069: Branding Kit + UI Beautification
 *
 * Status indicators and labels with proper theming and accessibility.
 */

import React from 'react';
import { clsx } from 'clsx';

export interface BadgeProps {
  variant?:
    | 'primary'
    | 'secondary'
    | 'success'
    | 'warning'
    | 'error'
    | 'info'
    | 'neutral';
  size?: 'sm' | 'md';
  children: React.ReactNode;
  className?: string;
}

const variantClasses = {
  primary: 'bg-primary-100 text-primary-800 border-primary-200',
  secondary: 'bg-secondary-100 text-secondary-800 border-secondary-200',
  success: 'bg-green-100 text-green-800 border-green-200',
  warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  error: 'bg-red-100 text-red-800 border-red-200',
  info: 'bg-blue-100 text-blue-800 border-blue-200',
  neutral: 'bg-neutral-100 text-neutral-800 border-neutral-200',
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
};

export function Badge({
  variant = 'neutral',
  size = 'md',
  children,
  className,
}: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center font-medium border rounded-full',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {children}
    </span>
  );
}

/**
 * Status Badge - Specialized badge for performance bands
 */
export interface StatusBadgeProps {
  status: 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';
  children: React.ReactNode;
  size?: 'sm' | 'md';
  className?: string;
}

const statusVariantMap = {
  GREEN: 'success',
  YELLOW: 'warning',
  RED: 'error',
  UNKNOWN: 'neutral',
} as const;

export function StatusBadge({
  status,
  children,
  size,
  className,
}: StatusBadgeProps) {
  return (
    <Badge variant={statusVariantMap[status]} size={size} className={className}>
      {status === 'GREEN' && '🟢 '}
      {status === 'YELLOW' && '🟡 '}
      {status === 'RED' && '🔴 '}
      {status === 'UNKNOWN' && '⚪ '}
      {children}
    </Badge>
  );
}
