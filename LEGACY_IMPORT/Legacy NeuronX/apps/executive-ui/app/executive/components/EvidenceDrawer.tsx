/**
 * Evidence Drawer - WI-064: Executive Dashboard – Business Confidence Surface
 *
 * Provides evidence-backed explanations for confidence indicators.
 * Shows aggregate data and policy references without individual details.
 */

'use client';

import { useState, useEffect } from 'react';
import { executiveApi, generateCorrelationId } from '../../../lib/api-client';
import { EvidenceData } from '../../../lib/types';

interface EvidenceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  evidenceKey: string | null;
  tenantId: string;
}

/**
 * Evidence Drawer Component
 * Shows evidence-backed explanations for confidence indicators
 */
export function EvidenceDrawer({
  isOpen,
  onClose,
  evidenceKey,
  tenantId,
}: EvidenceDrawerProps) {
  const [evidenceData, setEvidenceData] = useState<EvidenceData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && evidenceKey) {
      fetchEvidenceData();
    } else {
      setEvidenceData(null);
    }
  }, [isOpen, evidenceKey]);

  const fetchEvidenceData = async () => {
    if (!evidenceKey) return;

    const correlationId = generateCorrelationId();

    try {
      setIsLoading(true);
      setError(null);

      // Mock evidence data - in production from API
      const mockEvidenceData = getMockEvidenceData(evidenceKey);
      setEvidenceData(mockEvidenceData);

      // Uncomment when API is ready:
      // const result = await executiveApi.getEvidenceDetails(
      //   tenantId,
      //   evidenceKey,
      //   '7d',
      //   { correlationId }
      // );
      //
      // if (result.success && result.data) {
      //   setEvidenceData(result.data);
      // } else {
      //   setError(result.error || 'Failed to load evidence data');
      // }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load evidence data'
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !evidenceKey) {
    return null;
  }

  return (
    <div className='evidence-drawer' data-testid='evidence-drawer'>
      {/* Backdrop */}
      <div className='evidence-backdrop' onClick={onClose} />

      {/* Drawer */}
      <div className='evidence-content'>
        <div className='flex flex-col h-full'>
          {/* Header */}
          <div className='evidence-header'>
            <div className='evidence-title'>
              {evidenceData ? evidenceData.title : 'Evidence Details'}
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
            {isLoading && (
              <div className='evidence-summary'>
                <div className='animate-pulse'>
                  <div className='h-4 bg-gray-200 rounded w-3/4 mb-2'></div>
                  <div className='h-3 bg-gray-200 rounded w-1/2 mb-4'></div>
                  <div className='h-32 bg-gray-200 rounded'></div>
                </div>
              </div>
            )}

            {error && (
              <div className='evidence-summary'>
                <div className='text-center py-8'>
                  <div className='text-red-600 mb-2'>
                    ⚠️ Error loading evidence
                  </div>
                  <p className='text-sm text-gray-600'>{error}</p>
                </div>
              </div>
            )}

            {!isLoading && !error && evidenceData && (
              <>
                {/* Summary */}
                <div className='evidence-summary'>
                  <div className='flex items-center justify-between mb-4'>
                    <div className='flex items-center space-x-2'>
                      <span className='text-2xl'>
                        {evidenceData.status === 'GREEN'
                          ? '🟢'
                          : evidenceData.status === 'YELLOW'
                            ? '🟡'
                            : '🔴'}
                      </span>
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          evidenceData.status === 'GREEN'
                            ? 'bg-green-100 text-green-800'
                            : evidenceData.status === 'YELLOW'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {evidenceData.status} Confidence
                      </span>
                    </div>
                    <div className='text-right text-sm text-gray-500'>
                      <div>Last Updated</div>
                      <div>
                        {new Date(evidenceData.lastUpdated).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <p className='text-gray-700 leading-relaxed'>
                    {evidenceData.summary}
                  </p>
                </div>

                {/* Evidence Details */}
                <div className='evidence-details'>
                  <h3 className='text-lg font-semibold text-gray-900 mb-4'>
                    Supporting Evidence
                  </h3>

                  {evidenceData.details.map((detail, index) => (
                    <div key={index} className='evidence-item'>
                      <div className='flex items-center justify-between mb-2'>
                        <div className='evidence-label'>{detail.label}</div>
                        {detail.trend && (
                          <span
                            className={`text-sm font-medium ${
                              detail.trend === 'up'
                                ? 'text-green-600'
                                : detail.trend === 'down'
                                  ? 'text-red-600'
                                  : 'text-gray-600'
                            }`}
                          >
                            {detail.trend === 'up'
                              ? '↗️'
                              : detail.trend === 'down'
                                ? '↘️'
                                : '➡️'}
                          </span>
                        )}
                      </div>

                      <div className='evidence-value'>
                        {typeof detail.value === 'number' &&
                        detail.value % 1 !== 0
                          ? detail.value.toFixed(1)
                          : detail.value}
                      </div>

                      {detail.explanation && (
                        <div className='evidence-explanation'>
                          {detail.explanation}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Policy & Source Information */}
                <div className='px-6 py-4 border-t border-gray-200 bg-gray-50'>
                  <div className='grid grid-cols-2 gap-4 text-sm'>
                    <div>
                      <span className='font-medium text-gray-700'>
                        Data Source:
                      </span>
                      <span className='ml-2 text-gray-900'>
                        {evidenceData.source}
                      </span>
                    </div>
                    <div>
                      <span className='font-medium text-gray-700'>
                        Policy Version:
                      </span>
                      <span className='ml-2 text-gray-900'>
                        {evidenceData.policyVersion}
                      </span>
                    </div>
                    <div className='col-span-2'>
                      <span className='font-medium text-gray-700'>
                        Record Count:
                      </span>
                      <span className='ml-2 text-gray-900'>
                        {evidenceData.recordCount.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {evidenceData.correlationIds.length > 0 && (
                    <div className='mt-4 pt-4 border-t border-gray-200'>
                      <div className='text-xs text-gray-500'>
                        Correlation IDs:{' '}
                        {evidenceData.correlationIds.join(', ')}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Mock evidence data for development
 */
function getMockEvidenceData(evidenceKey: string): EvidenceData {
  const mockData: Record<string, EvidenceData> = {
    system_readiness: {
      evidenceKey: 'system_readiness',
      title: 'System Readiness',
      status: 'GREEN',
      summary:
        'All critical systems are operational with excellent performance metrics. Uptime is at 99.9% with no blocking issues detected.',
      details: [
        {
          label: 'System Uptime',
          value: '99.9%',
          trend: 'up',
          explanation: 'Above target threshold of 99.5%',
        },
        {
          label: 'Critical Systems',
          value: 'All Operational',
          trend: 'flat',
          explanation: 'No system outages or critical alerts',
        },
        {
          label: 'Performance Score',
          value: 95,
          trend: 'up',
          explanation: 'Response times within acceptable ranges',
        },
        {
          label: 'Blocking Issues',
          value: 0,
          trend: 'flat',
          explanation: 'No issues preventing normal operations',
        },
      ],
      source: 'readiness',
      policyVersion: '1.0.0',
      recordCount: 24,
      correlationIds: ['sys_read_001', 'sys_read_002'],
      lastUpdated: new Date().toISOString(),
    },

    governance_risk: {
      evidenceKey: 'governance_risk',
      title: 'Governance Risk',
      status: 'YELLOW',
      summary:
        'Minor governance violations detected. Most operations are compliant, but there are some manual overrides that require attention.',
      details: [
        {
          label: 'Compliance Rate',
          value: '96.2%',
          trend: 'flat',
          explanation: 'Within acceptable range but below target of 98%',
        },
        {
          label: 'Manual Overrides',
          value: 7,
          trend: 'down',
          explanation: 'Reduced from 12 last week, but still above target of 3',
        },
        {
          label: 'Blocked Actions',
          value: 2,
          trend: 'up',
          explanation: 'Slight increase, but within normal variance',
        },
        {
          label: 'Policy Violations',
          value: 3,
          trend: 'flat',
          explanation: 'Minor violations, mostly related to timing rules',
        },
      ],
      source: 'audit_log',
      policyVersion: '1.0.0',
      recordCount: 156,
      correlationIds: ['gov_risk_001', 'gov_risk_002'],
      lastUpdated: new Date().toISOString(),
    },

    revenue_integrity: {
      evidenceKey: 'revenue_integrity',
      title: 'Revenue Integrity',
      status: 'GREEN',
      summary:
        'Revenue systems are operating normally with strong integrity metrics. Billing sync is working correctly and no major issues detected.',
      details: [
        {
          label: 'Billing Sync Success',
          value: '99.8%',
          trend: 'up',
          explanation: 'Above target threshold of 99.0%',
        },
        {
          label: 'Failed Transactions',
          value: 3,
          trend: 'down',
          explanation: 'Reduced from 8 last week, well within limits',
        },
        {
          label: 'Active Accounts',
          value: '97.2%',
          trend: 'up',
          explanation: 'High percentage of accounts in good standing',
        },
        {
          label: 'Revenue Variance',
          value: 0.3,
          trend: 'flat',
          explanation: 'Within acceptable variance of ±1%',
        },
      ],
      source: 'billing',
      policyVersion: '1.0.0',
      recordCount: 892,
      correlationIds: ['rev_int_001', 'rev_int_002'],
      lastUpdated: new Date().toISOString(),
    },

    growth_efficiency: {
      evidenceKey: 'growth_efficiency',
      title: 'Growth Efficiency',
      status: 'GREEN',
      summary:
        'Growth metrics are strong with efficient conversion rates. Lead-to-customer pipeline is performing well above targets.',
      details: [
        {
          label: 'Lead Conversion Rate',
          value: '23.4%',
          trend: 'up',
          explanation: 'Above target of 20% and improving',
        },
        {
          label: 'Customer Acquisition Cost',
          value: '$89',
          trend: 'down',
          explanation: 'Below target of $95 and trending downward',
        },
        {
          label: 'Pipeline Velocity',
          value: '12.8 days',
          trend: 'down',
          explanation: 'Faster than target of 15 days',
        },
        {
          label: 'Revenue per Lead',
          value: '$456',
          trend: 'up',
          explanation: 'Above target of $400 and growing',
        },
      ],
      source: 'fsm',
      policyVersion: '1.0.0',
      recordCount: 1247,
      correlationIds: ['growth_eff_001', 'growth_eff_002'],
      lastUpdated: new Date().toISOString(),
    },
  };

  return (
    mockData[evidenceKey] || {
      evidenceKey,
      title: 'Evidence Unavailable',
      status: 'YELLOW',
      summary:
        'Evidence data is currently unavailable. Please check system status.',
      details: [],
      source: 'system',
      policyVersion: '1.0.0',
      recordCount: 0,
      correlationIds: [],
      lastUpdated: new Date().toISOString(),
    }
  );
}
