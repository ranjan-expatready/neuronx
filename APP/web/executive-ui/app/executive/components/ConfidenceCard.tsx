/**
 * Confidence Card - WI-064: Executive Dashboard – Business Confidence Surface
 *
 * Individual business confidence indicator with trend and status.
 * Clean, executive-focused design for quick strategic assessment.
 */

'use client';

import { useState, useEffect } from 'react';
import { ConfidenceCardData } from '../../../lib/types';

interface ConfidenceCardProps {
  card: ConfidenceCardData;
  onClick: () => void;
  delay?: number;
}

/**
 * Confidence Card Component
 * Displays business confidence indicators with executive-appropriate styling
 */
export function ConfidenceCard({
  card,
  onClick,
  delay = 0,
}: ConfidenceCardProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'GREEN':
        return 'confidence-card green';
      case 'YELLOW':
        return 'confidence-card yellow';
      case 'RED':
        return 'confidence-card red';
      default:
        return 'confidence-card';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'GREEN':
        return '🟢';
      case 'YELLOW':
        return '🟡';
      case 'RED':
        return '🔴';
      default:
        return '⚪';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return '↗️';
      case 'down':
        return '↘️';
      case 'flat':
        return '➡️';
      default:
        return '➡️';
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up':
        return 'confidence-trend up';
      case 'down':
        return 'confidence-trend down';
      case 'flat':
        return 'confidence-trend flat';
      default:
        return 'confidence-trend flat';
    }
  };

  return (
    <div
      className={`cursor-pointer transform transition-all duration-500 ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      }`}
      onClick={onClick}
    >
      <div
        className={getStatusColor(card.status)}
        data-testid='confidence-card'
      >
        <div className='flex items-center justify-between mb-4'>
          <div className='flex items-center space-x-2'>
            <span className='text-2xl'>{getStatusIcon(card.status)}</span>
            <span
              className={`text-xs font-medium px-2 py-1 rounded-full ${getTrendColor(card.trend)}`}
            >
              {getTrendIcon(card.trend)} {card.trend.toUpperCase()}
            </span>
          </div>
          <button
            className='text-gray-400 hover:text-gray-600 transition-colors'
            onClick={e => {
              e.stopPropagation();
              onClick();
            }}
          >
            <svg
              className='w-5 h-5'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
              />
            </svg>
          </button>
        </div>

        <div className='confidence-title'>{card.title}</div>

        <div
          className={`confidence-value ${
            card.status === 'GREEN'
              ? 'status-green'
              : card.status === 'YELLOW'
                ? 'status-yellow'
                : 'status-red'
          }`}
        >
          {card.value}
        </div>

        <div className='confidence-subtitle'>{card.subtitle}</div>

        {/* Hover hint */}
        <div className='mt-4 text-xs text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity'>
          Click for evidence details
        </div>
      </div>
    </div>
  );
}

/**
 * Confidence Card Grid Layout
 * Handles responsive grid layout for confidence cards
 */
export function ConfidenceCardGrid({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6'>
      {children}
    </div>
  );
}

/**
 * Loading Confidence Card
 * Skeleton loader for confidence cards
 */
export function LoadingConfidenceCard() {
  return (
    <div className='confidence-card'>
      <div className='animate-pulse'>
        <div className='flex items-center justify-between mb-4'>
          <div className='w-8 h-8 bg-gray-200 rounded-full'></div>
          <div className='w-16 h-6 bg-gray-200 rounded-full'></div>
        </div>
        <div className='h-6 bg-gray-200 rounded w-3/4 mb-2'></div>
        <div className='h-10 bg-gray-200 rounded w-1/2 mb-4'></div>
        <div className='h-4 bg-gray-200 rounded w-full'></div>
      </div>
    </div>
  );
}

/**
 * Error Confidence Card
 * Error state for confidence cards
 */
export function ErrorConfidenceCard({
  title,
  onRetry,
}: {
  title: string;
  onRetry?: () => void;
}) {
  return (
    <div className='confidence-card red'>
      <div className='flex items-center justify-between mb-4'>
        <span className='text-2xl'>⚠️</span>
        {onRetry && (
          <button
            onClick={onRetry}
            className='text-gray-400 hover:text-gray-600 transition-colors'
          >
            <svg
              className='w-5 h-5'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'
              />
            </svg>
          </button>
        )}
      </div>

      <div className='confidence-title'>{title}</div>

      <div className='confidence-value status-red'>Error</div>

      <div className='confidence-subtitle'>Unable to load confidence data</div>
    </div>
  );
}
