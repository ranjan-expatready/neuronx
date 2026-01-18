/**
 * Scorecard Drilldown Drawer - WI-067: Operator Intelligence Overlay
 *
 * Displays detailed drill-down information for scorecard metrics.
 * Shows contributing records, evidence, and source attribution.
 */

'use client';

import { useState, useEffect } from 'react';
import { scorecardApi, generateCorrelationId } from '../../../lib/api-client';

interface ScorecardMetric {
  key: string;
  label: string;
  value: number;
  unit: string;
  band: 'GREEN' | 'YELLOW' | 'RED';
  evidence: {
    source: string;
    recordCount: number;
    policyVersion: string;
  };
}

interface DrilldownRecord {
  id: string;
  type: string;
  timestamp: string;
  details: Record<string, any>;
}

interface DrilldownData {
  metricKey: string;
  records: DrilldownRecord[];
  pagination: {
    total: number;
    page: number;
    limit: number;
  };
}

interface ScorecardDrilldownDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  metric: ScorecardMetric | null;
}

const getBandColor = (band: string) => {
  switch (band) {
    case 'GREEN':
      return 'text-green-700 bg-green-100';
    case 'YELLOW':
      return 'text-yellow-700 bg-yellow-100';
    case 'RED':
      return 'text-red-700 bg-red-100';
    default:
      return 'text-gray-700 bg-gray-100';
  }
};

const getBandIcon = (band: string) => {
  switch (band) {
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

const formatTimestamp = (timestamp: string) => {
  return new Date(timestamp).toLocaleString();
};

const formatRecordDetails = (details: Record<string, any>) => {
  return Object.entries(details)
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ');
};

/**
 * Scorecard Drilldown Drawer Component
 * Modal drawer showing detailed metric drill-down information
 */
export function ScorecardDrilldownDrawer({
  isOpen,
  onClose,
  tenantId,
  metric,
}: ScorecardDrilldownDrawerProps) {
  const [drilldownData, setDrilldownData] = useState<DrilldownData | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (isOpen && metric) {
      fetchDrilldownData(1);
    } else {
      setDrilldownData(null);
      setCurrentPage(1);
    }
  }, [isOpen, metric]);

  const fetchDrilldownData = async (page: number = 1) => {
    if (!metric) return;

    const correlationId = generateCorrelationId();

    try {
      setIsLoading(true);
      setError(null);

      const result = await scorecardApi.getMetricDrilldown(
        tenantId,
        metric.key,
        '7d',
        {
          correlationId,
          page,
          limit: 20,
        }
      );

      if (result.success && result.data) {
        setDrilldownData(result.data);
        setCurrentPage(page);
      } else {
        setError(result.error || 'Failed to load drill-down data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    fetchDrilldownData(newPage);
  };

  if (!isOpen || !metric) {
    return null;
  }

  return (
    <div className='fixed inset-0 z-50 overflow-hidden'>
      {/* Backdrop */}
      <div
        className='absolute inset-0 bg-gray-500 bg-opacity-75 transition-opacity'
        onClick={onClose}
      />

      {/* Drawer */}
      <div className='absolute inset-y-0 right-0 max-w-2xl w-full bg-white shadow-xl transform transition-transform'>
        <div className='flex flex-col h-full'>
          {/* Header */}
          <div className='flex items-center justify-between px-6 py-4 border-b border-gray-200'>
            <div className='flex items-center space-x-3'>
              <span className='text-lg'>{getBandIcon(metric.band)}</span>
              <div>
                <h2 className='text-lg font-semibold text-gray-900'>
                  {metric.label}
                </h2>
                <p className='text-sm text-gray-600'>
                  Current value: {metric.value}
                  {metric.unit}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className='text-gray-400 hover:text-gray-600 transition-colors'
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
          <div className='flex-1 overflow-y-auto'>
            {/* Metric Evidence Header */}
            <div className='px-6 py-4 bg-gray-50 border-b border-gray-200'>
              <div className='grid grid-cols-2 gap-4 text-sm'>
                <div>
                  <span className='font-medium text-gray-700'>Source:</span>
                  <span className='ml-2 text-gray-900'>
                    {metric.evidence.source}
                  </span>
                </div>
                <div>
                  <span className='font-medium text-gray-700'>
                    Policy Version:
                  </span>
                  <span className='ml-2 text-gray-900'>
                    {metric.evidence.policyVersion}
                  </span>
                </div>
                <div>
                  <span className='font-medium text-gray-700'>
                    Record Count:
                  </span>
                  <span className='ml-2 text-gray-900'>
                    {metric.evidence.recordCount}
                  </span>
                </div>
                <div>
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getBandColor(metric.band)}`}
                  >
                    {getBandIcon(metric.band)} {metric.band} Performance
                  </span>
                </div>
              </div>
            </div>

            {/* Records List */}
            <div className='px-6 py-4'>
              <h3 className='text-md font-medium text-gray-900 mb-4'>
                Contributing Records
              </h3>

              {isLoading && (
                <div className='text-center py-8'>
                  <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto'></div>
                  <p className='mt-2 text-sm text-gray-600'>
                    Loading records...
                  </p>
                </div>
              )}

              {error && (
                <div className='text-center py-8'>
                  <div className='text-red-600 mb-2'>Error loading records</div>
                  <p className='text-sm text-gray-600'>{error}</p>
                </div>
              )}

              {!isLoading && !error && drilldownData && (
                <div className='space-y-3'>
                  {drilldownData.records.map((record, index) => (
                    <div
                      key={`${record.id}-${index}`}
                      className='border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors'
                    >
                      <div className='flex items-start justify-between'>
                        <div className='flex-1'>
                          <div className='flex items-center space-x-2 mb-2'>
                            <span className='text-sm font-medium text-gray-900'>
                              {record.type}
                            </span>
                            <span className='text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded'>
                              ID: {record.id}
                            </span>
                          </div>
                          <div className='text-sm text-gray-600 mb-2'>
                            {formatRecordDetails(record.details)}
                          </div>
                          <div className='text-xs text-gray-500'>
                            {formatTimestamp(record.timestamp)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {drilldownData.records.length === 0 && (
                    <div className='text-center py-8 text-gray-500'>
                      No contributing records found for this metric.
                    </div>
                  )}
                </div>
              )}

              {/* Pagination */}
              {!isLoading &&
                !error &&
                drilldownData &&
                drilldownData.pagination.total >
                  drilldownData.pagination.limit && (
                  <div className='flex items-center justify-between mt-6 pt-4 border-t border-gray-200'>
                    <div className='text-sm text-gray-700'>
                      Showing{' '}
                      {(currentPage - 1) * drilldownData.pagination.limit + 1}{' '}
                      to{' '}
                      {Math.min(
                        currentPage * drilldownData.pagination.limit,
                        drilldownData.pagination.total
                      )}{' '}
                      of {drilldownData.pagination.total} records
                    </div>

                    <div className='flex space-x-2'>
                      <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className='px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50'
                      >
                        Previous
                      </button>

                      <span className='px-3 py-1 text-sm text-gray-700'>
                        Page {currentPage} of{' '}
                        {Math.ceil(
                          drilldownData.pagination.total /
                            drilldownData.pagination.limit
                        )}
                      </span>

                      <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={
                          currentPage >=
                          Math.ceil(
                            drilldownData.pagination.total /
                              drilldownData.pagination.limit
                          )
                        }
                        className='px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50'
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
