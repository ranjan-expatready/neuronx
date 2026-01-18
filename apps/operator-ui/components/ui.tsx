/**
 * UI Components - WI-032: Operator Control Plane
 *
 * Reusable UI components for the operator interface.
 */

import React from 'react';
import { EvidenceEvent, AuditEvent, WorkQueueItem } from '../lib/types';

export function Card({
  title,
  children,
  className = '',
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-white rounded-lg shadow-md border border-gray-200 ${className}`}
    >
      {title && (
        <div className='px-6 py-4 border-b border-gray-200'>
          <h3 className='text-lg font-medium text-gray-900'>{title}</h3>
        </div>
      )}
      <div className='p-6'>{children}</div>
    </div>
  );
}

export function StatusBadge({
  status,
  variant = 'default',
}: {
  status: string;
  variant?: 'default' | 'urgency' | 'actor' | 'mode' | 'voice' | 'action';
}) {
  const getBadgeStyles = () => {
    switch (variant) {
      case 'urgency':
        switch (status.toLowerCase()) {
          case 'urgent':
          case 'high':
            return 'status-indicator bg-red-100 text-red-800';
          case 'normal':
            return 'status-indicator bg-yellow-100 text-yellow-800';
          case 'low':
            return 'status-indicator bg-green-100 text-green-800';
          default:
            return 'status-indicator bg-gray-100 text-gray-800';
        }

      case 'actor':
        switch (status.toLowerCase()) {
          case 'ai':
            return 'status-indicator bg-blue-100 text-blue-800';
          case 'human':
            return 'status-indicator bg-green-100 text-green-800';
          case 'hybrid':
            return 'status-indicator bg-purple-100 text-purple-800';
          default:
            return 'status-indicator bg-gray-100 text-gray-800';
        }

      case 'mode':
        switch (status.toLowerCase()) {
          case 'autonomous':
            return 'status-indicator bg-blue-100 text-blue-800';
          case 'assisted':
            return 'status-indicator bg-yellow-100 text-yellow-800';
          case 'approval_required':
            return 'status-indicator bg-red-100 text-red-800';
          default:
            return 'status-indicator bg-gray-100 text-gray-800';
        }

      case 'voice':
        switch (status.toLowerCase()) {
          case 'scripted':
            return 'status-indicator bg-blue-100 text-blue-800';
          case 'conversational':
            return 'status-indicator bg-green-100 text-green-800';
          case 'ai_assist_human':
            return 'status-indicator bg-purple-100 text-purple-800';
          case 'human_only':
            return 'status-indicator bg-orange-100 text-orange-800';
          default:
            return 'status-indicator bg-gray-100 text-gray-800';
        }

      case 'action':
        switch (status.toLowerCase()) {
          case 'pending':
            return 'status-indicator bg-yellow-100 text-yellow-800';
          case 'approved':
            return 'status-indicator bg-green-100 text-green-800';
          case 'executing':
            return 'status-indicator bg-blue-100 text-blue-800';
          case 'completed':
            return 'status-indicator bg-green-100 text-green-800';
          case 'failed':
            return 'status-indicator bg-red-100 text-red-800';
          default:
            return 'status-indicator bg-gray-100 text-gray-800';
        }

      default:
        // Stage/status variants
        switch (status.toLowerCase()) {
          case 'prospect_identified':
          case 'initial_contact':
            return 'status-indicator bg-blue-100 text-blue-800';
          case 'qualified':
            return 'status-indicator bg-green-100 text-green-800';
          case 'closed_won':
            return 'status-indicator bg-green-100 text-green-800';
          case 'lost':
          case 'disqualified':
            return 'status-indicator bg-red-100 text-red-800';
          case 'active':
            return 'status-indicator status-healthy';
          case 'draft':
            return 'status-indicator bg-gray-100 text-gray-800';
          case 'completed':
            return 'status-indicator status-healthy';
          case 'terminated':
            return 'status-indicator bg-red-100 text-red-800';
          case 'healthy':
            return 'status-indicator status-healthy';
          case 'warning':
            return 'status-indicator status-warning';
          case 'critical':
            return 'status-indicator status-critical';
          default:
            return 'status-indicator bg-gray-100 text-gray-800';
        }
    }
  };

  const formatStatus = (status: string) => {
    return status
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return <span className={getBadgeStyles()}>{formatStatus(status)}</span>;
}

export function Timeline({ events }: { events: EvidenceEvent[] }) {
  if (events.length === 0) {
    return (
      <div className='text-gray-500 text-center py-4'>
        No evidence events recorded yet
      </div>
    );
  }

  return (
    <div className='flow-root'>
      <ul role='list' className='-mb-8'>
        {events.map((event, eventIdx) => (
          <li key={event.eventId}>
            <div className='relative pb-8'>
              {eventIdx !== events.length - 1 ? (
                <span
                  className='absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200'
                  aria-hidden='true'
                />
              ) : null}
              <div className='relative flex space-x-3'>
                <div>
                  <span
                    className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${
                      event.confidence && event.confidence > 0.8
                        ? 'bg-green-500'
                        : event.confidence && event.confidence > 0.5
                          ? 'bg-yellow-500'
                          : 'bg-gray-500'
                    }`}
                  >
                    <span className='text-white text-xs font-medium'>
                      {event.eventType.charAt(0).toUpperCase()}
                    </span>
                  </span>
                </div>
                <div className='min-w-0 flex-1 pt-1.5'>
                  <div className='text-sm'>
                    <div className='font-medium text-gray-900'>
                      {event.description}
                    </div>
                    <div className='text-gray-500'>
                      {new Date(event.timestamp).toLocaleString()} •{' '}
                      {event.source}
                      {event.confidence && (
                        <span className='ml-2 text-xs'>
                          ({Math.round(event.confidence * 100)}% confidence)
                        </span>
                      )}
                    </div>
                    {event.data && Object.keys(event.data).length > 0 && (
                      <div className='mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded'>
                        <pre className='whitespace-pre-wrap'>
                          {JSON.stringify(event.data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AuditTrail({ events }: { events: AuditEvent[] }) {
  if (events.length === 0) {
    return (
      <div className='text-gray-500 text-center py-4'>
        No audit events recorded
      </div>
    );
  }

  return (
    <div className='space-y-3'>
      {events.map(event => (
        <div
          key={event.eventId}
          className='flex items-start space-x-3 p-3 bg-gray-50 rounded-md'
        >
          <div className='flex-1 min-w-0'>
            <div className='text-sm font-medium text-gray-900'>
              {event.description}
            </div>
            <div className='text-sm text-gray-500'>
              {event.actor} • {new Date(event.timestamp).toLocaleString()}
            </div>
            {event.details && Object.keys(event.details).length > 0 && (
              <div className='mt-2 text-xs text-gray-600'>
                {JSON.stringify(event.details, null, 2)}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  return (
    <div
      className={`animate-spin rounded-full border-2 border-gray-300 border-t-neuronx-secondary ${sizeClasses[size]}`}
    ></div>
  );
}

export function ErrorMessage({
  title,
  message,
  retry,
}: {
  title: string;
  message: string;
  retry?: () => void;
}) {
  return (
    <Card>
      <div className='text-center py-8'>
        <div className='text-red-600 text-lg font-medium mb-2'>{title}</div>
        <div className='text-gray-600 mb-4'>{message}</div>
        {retry && (
          <button onClick={retry} className='btn-primary'>
            Try Again
          </button>
        )}
      </div>
    </Card>
  );
}
