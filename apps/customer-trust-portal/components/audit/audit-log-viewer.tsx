'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  ChevronDown,
  ChevronRight,
  Eye,
  User,
  Shield,
  Database,
  Settings,
  AlertCircle,
  Search,
} from 'lucide-react';
import { apiClient, AuditEvent } from '@/lib/api-client';

function getActionIcon(action: string) {
  if (action.includes('login') || action.includes('auth')) return User;
  if (action.includes('billing') || action.includes('payment')) return Shield;
  if (action.includes('data') || action.includes('export')) return Database;
  if (action.includes('config') || action.includes('setting')) return Settings;
  if (action.includes('security') || action.includes('alert'))
    return AlertCircle;
  return Eye;
}

function getActionColor(action: string) {
  if (action.includes('failed') || action.includes('error'))
    return 'text-red-600 bg-red-50 border-red-200';
  if (action.includes('security') || action.includes('alert'))
    return 'text-orange-600 bg-orange-50 border-orange-200';
  if (action.includes('billing'))
    return 'text-blue-600 bg-blue-50 border-blue-200';
  return 'text-gray-600 bg-gray-50 border-gray-200';
}

interface AuditEventRowProps {
  event: AuditEvent;
  isExpanded: boolean;
  onToggle: () => void;
}

function AuditEventRow({ event, isExpanded, onToggle }: AuditEventRowProps) {
  const Icon = getActionIcon(event.action);
  const colorClass = getActionColor(event.action);

  return (
    <div className={`border rounded-lg ${colorClass}`}>
      <div
        className='flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50'
        onClick={onToggle}
      >
        <div className='flex items-center space-x-3'>
          <Icon className='h-5 w-5 flex-shrink-0' />
          <div>
            <div className='flex items-center space-x-2'>
              <span className='font-medium text-gray-900 capitalize'>
                {event.action.replace(/_/g, ' ')}
              </span>
              <span className='text-sm text-gray-500'>
                by {event.actorType} {event.actorId}
              </span>
            </div>
            <div className='text-sm text-gray-600'>
              {event.resourceType}: {event.resourceId}
            </div>
          </div>
        </div>

        <div className='flex items-center space-x-4'>
          <span className='text-sm text-gray-500'>
            {format(new Date(event.createdAt), 'MMM dd, HH:mm:ss')}
          </span>
          {isExpanded ? (
            <ChevronDown className='h-4 w-4 text-gray-400' />
          ) : (
            <ChevronRight className='h-4 w-4 text-gray-400' />
          )}
        </div>
      </div>

      {isExpanded && (
        <div className='px-4 pb-4 border-t border-gray-200 bg-white'>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4 mt-4'>
            {/* Basic Information */}
            <div>
              <h4 className='font-medium text-gray-900 mb-2'>Event Details</h4>
              <dl className='space-y-1 text-sm'>
                <div className='flex justify-between'>
                  <dt className='text-gray-500'>Event ID:</dt>
                  <dd className='font-mono text-gray-900'>{event.id}</dd>
                </div>
                <div className='flex justify-between'>
                  <dt className='text-gray-500'>Timestamp:</dt>
                  <dd className='text-gray-900'>
                    {format(new Date(event.createdAt), 'yyyy-MM-dd HH:mm:ss')}
                  </dd>
                </div>
                <div className='flex justify-between'>
                  <dt className='text-gray-500'>Actor:</dt>
                  <dd className='text-gray-900'>
                    {event.actorId} ({event.actorType})
                  </dd>
                </div>
                <div className='flex justify-between'>
                  <dt className='text-gray-500'>Resource:</dt>
                  <dd className='text-gray-900'>
                    {event.resourceType} ({event.resourceId})
                  </dd>
                </div>
              </dl>
            </div>

            {/* Changes */}
            <div>
              <h4 className='font-medium text-gray-900 mb-2'>Changes</h4>
              <div className='space-y-3'>
                {event.oldValues && Object.keys(event.oldValues).length > 0 && (
                  <div>
                    <p className='text-sm font-medium text-red-700 mb-1'>
                      Before:
                    </p>
                    <pre className='text-xs bg-red-50 p-2 rounded border text-red-800 overflow-x-auto'>
                      {JSON.stringify(event.oldValues, null, 2)}
                    </pre>
                  </div>
                )}

                {event.newValues && Object.keys(event.newValues).length > 0 && (
                  <div>
                    <p className='text-sm font-medium text-green-700 mb-1'>
                      After:
                    </p>
                    <pre className='text-xs bg-green-50 p-2 rounded border text-green-800 overflow-x-auto'>
                      {JSON.stringify(event.newValues, null, 2)}
                    </pre>
                  </div>
                )}

                {!event.oldValues && !event.newValues && (
                  <p className='text-sm text-gray-500 italic'>
                    No value changes recorded
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Metadata */}
          {event.metadata && Object.keys(event.metadata).length > 0 && (
            <div className='mt-4'>
              <h4 className='font-medium text-gray-900 mb-2'>
                Additional Metadata
              </h4>
              <pre className='text-xs bg-gray-50 p-3 rounded border overflow-x-auto max-h-32'>
                {JSON.stringify(event.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function AuditLogViewer() {
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAction, setSelectedAction] = useState<string>('');

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useQuery({
    queryKey: ['audit-events-detailed', searchTerm, selectedAction],
    queryFn: ({ pageParam = 0 }) =>
      apiClient.getAuditEvents({
        limit: 50,
        offset: pageParam,
        action: selectedAction || undefined,
        // Note: In a real implementation, you'd add search filtering to the API
      }),
    getNextPageParam: (lastPage, pages) => {
      const totalLoaded = pages.reduce(
        (acc, page) => acc + page.events.length,
        0
      );
      return totalLoaded < lastPage.total ? totalLoaded : undefined;
    },
  });

  const allEvents = data?.pages.flatMap(page => page.events) || [];

  // Filter events based on search term (client-side for demo)
  const filteredEvents = allEvents.filter(
    event =>
      searchTerm === '' ||
      event.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.resourceType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.actorId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleExpanded = (eventId: string) => {
    const newExpanded = new Set(expandedEvents);
    if (newExpanded.has(eventId)) {
      newExpanded.delete(eventId);
    } else {
      newExpanded.add(eventId);
    }
    setExpandedEvents(newExpanded);
  };

  return (
    <div className='trust-card'>
      <div className='flex items-center justify-between mb-6'>
        <div>
          <h3 className='text-lg font-medium text-gray-900'>
            Detailed Audit Log
          </h3>
          <p className='text-sm text-gray-500 mt-1'>
            Complete audit trail with full event details and change tracking
          </p>
        </div>

        <div className='flex items-center space-x-2'>
          <div className='w-2 h-2 bg-green-400 rounded-full animate-pulse'></div>
          <span className='text-xs text-gray-500'>Real-time</span>
        </div>
      </div>

      {/* Search and Filters */}
      <div className='flex flex-col sm:flex-row gap-4 mb-6'>
        <div className='flex-1 relative'>
          <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400' />
          <input
            type='text'
            placeholder='Search audit events...'
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className='w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-trust-500 focus:border-trust-500'
          />
        </div>

        <select
          value={selectedAction}
          onChange={e => setSelectedAction(e.target.value)}
          className='px-3 py-2 border border-gray-300 rounded-md focus:ring-trust-500 focus:border-trust-500'
        >
          <option value=''>All Actions</option>
          <option value='billing_sync_completed'>Billing Sync</option>
          <option value='execution_planned'>Execution Planned</option>
          <option value='execution_completed'>Execution Completed</option>
          <option value='user_login'>User Login</option>
          <option value='config_changed'>Configuration Changed</option>
        </select>
      </div>

      {/* Audit Events */}
      {isLoading && filteredEvents.length === 0 ? (
        <div className='space-y-4'>
          {[...Array(5)].map((_, i) => (
            <div key={i} className='animate-pulse border rounded-lg p-4'>
              <div className='h-4 bg-gray-200 rounded w-3/4 mb-2'></div>
              <div className='h-3 bg-gray-200 rounded w-1/2'></div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className='text-center py-12'>
          <AlertCircle className='h-12 w-12 text-red-400 mx-auto mb-4' />
          <h3 className='text-lg font-medium text-gray-900 mb-2'>
            Unable to load audit log
          </h3>
          <p className='text-gray-500'>
            Please try again later or contact support
          </p>
        </div>
      ) : (
        <div className='space-y-3 audit-scrollbar max-h-96 overflow-y-auto'>
          {filteredEvents.length === 0 ? (
            <div className='text-center py-12'>
              <Search className='h-12 w-12 text-gray-400 mx-auto mb-4' />
              <h3 className='text-lg font-medium text-gray-900 mb-2'>
                No audit events found
              </h3>
              <p className='text-gray-500'>
                {searchTerm || selectedAction
                  ? 'Try adjusting your search filters'
                  : 'Audit events will appear here as system activity occurs'}
              </p>
            </div>
          ) : (
            <>
              {filteredEvents.map(event => (
                <AuditEventRow
                  key={event.id}
                  event={event}
                  isExpanded={expandedEvents.has(event.id)}
                  onToggle={() => toggleExpanded(event.id)}
                />
              ))}

              {hasNextPage && (
                <div className='text-center pt-6'>
                  <button
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className='trust-button-secondary'
                  >
                    {isFetchingNextPage ? 'Loading...' : 'Load More Events'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className='mt-6 pt-4 border-t border-gray-100'>
        <div className='flex items-center justify-between text-sm text-gray-500'>
          <span>
            Showing {filteredEvents.length} of {allEvents.length} events
          </span>
          <span>🔒 All records are tamper-proof and immutable</span>
        </div>
      </div>
    </div>
  );
}
