/**
 * Drawer/Modal Component - WI-069: Branding Kit + UI Beautification
 *
 * Enterprise-grade drawer/modal with proper accessibility and theming.
 */

import React, { useEffect } from 'react';
import { clsx } from 'clsx';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  position?: 'right' | 'left' | 'top' | 'bottom';
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

const positionClasses = {
  right: 'inset-y-0 right-0',
  left: 'inset-y-0 left-0',
  top: 'inset-x-0 top-0',
  bottom: 'inset-x-0 bottom-0',
};

export function Drawer({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  position = 'right',
}: DrawerProps) {
  // Handle escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className='fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity'
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={clsx(
          'fixed z-50 bg-white shadow-xl transform transition-transform duration-300 ease-in-out',
          positionClasses[position],
          sizeClasses[size],
          position === 'right' &&
            (isOpen ? 'translate-x-0' : 'translate-x-full'),
          position === 'left' &&
            (isOpen ? 'translate-x-0' : '-translate-x-full'),
          position === 'top' &&
            (isOpen ? 'translate-y-0' : '-translate-y-full'),
          position === 'bottom' &&
            (isOpen ? 'translate-y-0' : 'translate-y-full')
        )}
      >
        {/* Header */}
        <div className='flex items-center justify-between px-6 py-4 border-b border-neutral-200'>
          <h2 className='text-lg font-semibold text-neutral-900'>{title}</h2>
          <button
            onClick={onClose}
            className='text-neutral-400 hover:text-neutral-600 transition-colors'
          >
            <svg
              className='w-6 h-6'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M6 18L18 6M6 6l12 12'
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className='flex-1 overflow-y-auto'>{children}</div>
      </div>
    </>
  );
}
