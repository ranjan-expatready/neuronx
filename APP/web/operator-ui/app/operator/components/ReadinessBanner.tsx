/**
 * Readiness Banner - WI-062: Operator Console
 *
 * Top banner showing tenant readiness status and governance mode.
 */

import { RefreshIcon } from '@heroicons/react/outline';

interface ReadinessBannerProps {
  readiness: any;
  enforcementMode: 'monitor_only' | 'block' | null;
  onRefresh: () => void;
}

export function ReadinessBanner({
  readiness,
  enforcementMode,
  onRefresh,
}: ReadinessBannerProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'READY':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'WARN':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'BLOCKED':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getEnforcementColor = (mode: string) => {
    switch (mode) {
      case 'block':
        return 'bg-red-100 text-red-800';
      case 'monitor_only':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className='bg-white border-b border-gray-200 px-6 py-4'>
      <div className='flex items-center justify-between'>
        <div className='flex items-center space-x-4'>
          {/* Readiness Status */}
          <div className='flex items-center space-x-2'>
            <span className='text-sm font-medium text-gray-700'>
              Readiness:
            </span>
            {readiness ? (
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(readiness.overall?.status)}`}
              >
                {readiness.overall?.status || 'UNKNOWN'}
              </span>
            ) : (
              <span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200'>
                LOADING...
              </span>
            )}
          </div>

          {/* Enforcement Mode */}
          {enforcementMode && (
            <div className='flex items-center space-x-2'>
              <span className='text-sm font-medium text-gray-700'>Mode:</span>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getEnforcementColor(enforcementMode)}`}
              >
                {enforcementMode === 'block' ? 'BLOCKING' : 'MONITOR'}
              </span>
            </div>
          )}

          {/* Last Snapshot Info */}
          {readiness?.domains?.ghlTrust && (
            <div className='flex items-center space-x-2'>
              <span className='text-sm font-medium text-gray-700'>
                GHL Sync:
              </span>
              <span className='text-sm text-gray-600'>
                {new Date(
                  readiness.domains.ghlTrust.lastEvaluated
                ).toLocaleTimeString()}
              </span>
            </div>
          )}
        </div>

        {/* Refresh Button */}
        <button
          onClick={onRefresh}
          className='inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
        >
          <RefreshIcon className='h-4 w-4 mr-1' />
          Refresh
        </button>
      </div>

      {/* Blocking Reasons */}
      {readiness?.overall?.blockingReasons?.length > 0 && (
        <div className='mt-2'>
          <div className='text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3'>
            <div className='font-medium'>Blocking Issues:</div>
            <ul className='mt-1 list-disc list-inside'>
              {readiness.overall.blockingReasons.map(
                (reason: string, index: number) => (
                  <li key={index}>{reason}</li>
                )
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
