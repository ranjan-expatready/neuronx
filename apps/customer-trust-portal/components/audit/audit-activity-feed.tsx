'use client';

import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import {
  Eye,
  User,
  Shield,
  Database,
  Settings,
  AlertCircle,
} from 'lucide-react';
import { apiClient, AuditEvent } from '@/lib/api-client';

function getActionIcon(action: string) {
  if (action.includes('login') || action.includes('auth')) return User;
  if (action.includes('billing') || action.includes('payment')) return Shield;
  if (action.includes('data') || action.includes('export')) return Database;
  if (action.includes('config') || action.includes('setting')) return Settings;
  if (action.includes('security') || action.includes('alert'))
    return AlertCircle;
  return Eye; // Default audit icon
}

function getActionColor(action: string) {
  if (action.includes('failed') || action.includes('error'))
    return 'text-red-600 border-red-200';
  if (action.includes('security') || action.includes('alert'))
    return 'text-orange-600 border-orange-200';
  if (action.includes('billing')) return 'text-blue-600 border-blue-200';
  return 'text-gray-600 border-gray-200';
}

interface AuditEntryProps {
  event: AuditEvent;
}

function AuditEntry({ event }: AuditEntryProps) {
  const Icon = getActionIcon(event.action);
  const colorClass = getActionColor(event.action);

  return (
    <div className={`audit-entry ${colorClass}`}>
      <div className='flex items-start space-x-3'>
        <div className='flex-shrink-0'>
          <Icon className='h-5 w-5' />
        </div>

        <div className='flex-1 min-w-0'>
          <div className='flex items-center justify-between'>
            <p className='text-sm font-medium text-gray-900 capitalize'>
              {event.action.replace(/_/g, ' ')}
            </p>
            <p className='text-xs text-gray-500'>
              {formatDistanceToNow(new Date(event.createdAt), {
                addSuffix: true,
              })}
            </p>
          </div>

          <div className='mt-1'>
            <p className='text-sm text-gray-600'>
              <span className='font-medium'>{event.actorType}</span>
              {event.actorId && (
                <span className='text-gray-400'> • {event.actorId}</span>
              )}
            </p>

            <p className='text-xs text-gray-500 mt-1'>
              Resource: {event.resourceType} ({event.resourceId})
            </p>
          </div>

          {/* Show changes if available */}
          {(event.oldValues || event.newValues) && (
            <div className='mt-2 text-xs'>
              {event.oldValues && (
                <div className='text-red-600'>
                  <span className='font-medium'>Before:</span>{' '}
                  {JSON.stringify(event.oldValues)}
                </div>
              )}
              {event.newValues && (
                <div className='text-green-600'>
                  <span className='font-medium'>After:</span>{' '}
                  {JSON.stringify(event.newValues)}
                </div>
              )}
            </div>
          )}

          {/* Show metadata if available */}
          {event.metadata && Object.keys(event.metadata).length > 0 && (
            <div className='mt-2 text-xs text-gray-400'>
              <details>
                <summary className='cursor-pointer hover:text-gray-600'>
                  Additional details
                </summary>
                <pre className='mt-1 text-xs bg-gray-50 p-2 rounded overflow-x-auto'>
                  {JSON.stringify(event.metadata, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function AuditActivityFeed() {
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useQuery({
    queryKey: ['audit-events'],
    queryFn: ({ pageParam = 0 }) =>
      apiClient.getAuditEvents({ limit: 20, offset: pageParam }),
    getNextPageParam: (lastPage, pages) => {
      const totalLoaded = pages.reduce(
        (acc, page) => acc + page.events.length,
        0
      );
      return totalLoaded < lastPage.total ? totalLoaded : undefined;
    },
    refetchInterval: 60000, // Refresh every minute
  });

  const allEvents = data?.pages.flatMap(page => page.events) || [];

  return (
    <div className='trust-card'>
      <div className='flex items-center justify-between mb-6'>
        <div>
          <h3 className='text-lg font-medium text-gray-900'>
            Recent Audit Activity
          </h3>
          <p className='text-sm text-gray-500 mt-1'>
            Real-time audit trail of all system activities
          </p>
        </div>

        <div className='flex items-center space-x-2'>
          <div className='w-2 h-2 bg-green-400 rounded-full animate-pulse'></div>
          <span className='text-xs text-gray-500'>Live</span>
        </div>
      </div>

      {isLoading && allEvents.length === 0 ? (
        <div className='space-y-4'>
          {[...Array(5)].map((_, i) => (
            <div key={i} className='animate-pulse'>
              <div className='h-4 bg-gray-200 rounded w-3/4 mb-2'></div>
              <div className='h-3 bg-gray-200 rounded w-1/2'></div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className='text-center py-8'>
          <AlertCircle className='h-8 w-8 text-red-400 mx-auto mb-2' />
          <p className='text-sm text-red-600'>Unable to load audit activity</p>
        </div>
      ) : (
        <div className='space-y-4 audit-scrollbar max-h-96 overflow-y-auto'>
          {allEvents.length === 0 ? (
            <div className='text-center py-8'>
              <Eye className='h-8 w-8 text-gray-400 mx-auto mb-2' />
              <p className='text-sm text-gray-500'>No audit activity found</p>
            </div>
          ) : (
            <>
              {allEvents.map(event => (
                <AuditEntry key={event.id} event={event} />
              ))}

              {hasNextPage && (
                <div className='text-center pt-4'>
                  <button
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className='trust-button-secondary text-xs'
                  >
                    {isFetchingNextPage ? 'Loading...' : 'Load More'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className='mt-4 pt-4 border-t border-gray-100'>
        <div className='flex items-center justify-between text-xs text-gray-500'>
          <span>Showing {allEvents.length} events</span>
          <span>Auto-refreshes every minute</span>
        </div>
      </div>
    </div>
  );
}
