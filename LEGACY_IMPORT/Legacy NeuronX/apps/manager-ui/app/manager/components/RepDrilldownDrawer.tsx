/**
 * Rep Drilldown Drawer - WI-063: Manager Console – Team Intelligence & Coaching Surface
 *
 * Displays detailed performance information for a selected rep.
 * Shows scorecard metrics, evidence, and coaching insights.
 */

'use client';

import { useState, useEffect } from 'react';
import { scorecardApi, generateCorrelationId } from '../../../lib/api-client';
import { RepPerformance, DrilldownResponse } from '../../../lib/types';

interface RepDrilldownDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  rep: RepPerformance | null;
  tenantId: string;
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

const getCoachingRecommendation = (metrics: RepPerformance['metrics']) => {
  const redMetrics = metrics.filter(m => m.band === 'RED').length;
  const yellowMetrics = metrics.filter(m => m.band === 'YELLOW').length;

  if (redMetrics > 0) {
    return {
      priority: 'HIGH',
      title: 'Immediate Intervention Required',
      actions: [
        'Schedule one-on-one coaching session today',
        'Review recent blocked actions and root causes',
        'Provide additional training on SLA management',
        'Monitor closely for next 24-48 hours',
      ],
    };
  } else if (yellowMetrics > 1) {
    return {
      priority: 'MEDIUM',
      title: 'Proactive Coaching Recommended',
      actions: [
        'Schedule coaching session within this week',
        'Review lead contact techniques',
        'Discuss SLA management strategies',
        'Set specific improvement goals',
      ],
    };
  } else {
    return {
      priority: 'LOW',
      title: 'Monitor and Reinforce',
      actions: [
        'Continue monitoring performance',
        'Share best practices with team',
        'Consider as peer coach for struggling reps',
        'Recognize good performance',
      ],
    };
  }
};

/**
 * Rep Drilldown Drawer Component
 * Modal drawer showing detailed rep performance and coaching insights
 */
export function RepDrilldownDrawer({
  isOpen,
  onClose,
  rep,
  tenantId,
}: RepDrilldownDrawerProps) {
  const [drilldownData, setDrilldownData] = useState<DrilldownResponse | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && rep) {
      fetchDrilldownData();
    } else {
      setDrilldownData(null);
    }
  }, [isOpen, rep]);

  const fetchDrilldownData = async () => {
    if (!rep) return;

    const correlationId = generateCorrelationId();

    try {
      setIsLoading(true);
      setError(null);

      // Mock drilldown data - in production, this would come from API
      const mockDrilldownData: DrilldownResponse = {
        repId: rep.repId,
        repName: rep.repName,
        scorecard: {
          sections: [
            {
              key: 'salesEffectiveness',
              title: 'Sales Effectiveness',
              metrics: rep.metrics.filter(m =>
                [
                  'lead_to_contact_rate',
                  'contact_to_qualified_rate',
                  'qualified_to_booked_rate',
                ].includes(m.key)
              ),
            },
            {
              key: 'operationalExcellence',
              title: 'Operational Excellence',
              metrics: rep.metrics.filter(m =>
                [
                  'sla_breach_rate',
                  'execution_success_rate',
                  'retry_rate',
                ].includes(m.key)
              ),
            },
            {
              key: 'governanceRisk',
              title: 'Governance & Risk',
              metrics: rep.metrics.filter(m =>
                ['blocked_actions_count', 'high_risk_decisions_count'].includes(
                  m.key
                )
              ),
            },
          ],
          correlationId,
        },
        recentActivity: [
          {
            id: 'activity_001',
            type: 'lead_contacted',
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
            details: {
              leadId: 'lead_123',
              action: 'contact_attempt',
              outcome: 'successful',
              duration: '5 minutes',
            },
          },
          {
            id: 'activity_002',
            type: 'sla_check',
            timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
            details: {
              opportunityId: 'opp_456',
              slaStatus: 'at_risk',
              timeRemaining: '2 hours',
              priority: 'high',
            },
          },
          {
            id: 'activity_003',
            type: 'action_blocked',
            timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
            details: {
              actionType: 'bulk_email',
              reason: 'governance_policy',
              severity: 'warning',
              policyVersion: '1.0.0',
            },
          },
        ],
        pagination: {
          total: 3,
          page: 1,
          limit: 20,
        },
      };

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));

      setDrilldownData(mockDrilldownData);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load drill-down data'
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !rep) {
    return null;
  }

  const coachingRecommendation = getCoachingRecommendation(rep.metrics);

  return (
    <div className='drilldown-drawer'>
      {/* Backdrop */}
      <div className='drilldown-backdrop' onClick={onClose} />

      {/* Drawer */}
      <div className='drilldown-content'>
        <div className='flex flex-col h-full'>
          {/* Header */}
          <div className='flex items-center justify-between px-6 py-4 border-b border-gray-200'>
            <div className='flex items-center space-x-3'>
              <span className='text-lg'>{getBandIcon(rep.overallBand)}</span>
              <div>
                <h2 className='text-lg font-semibold text-gray-900'>
                  {rep.repName}
                </h2>
                <p className='text-sm text-gray-600'>
                  Team: {rep.teamId} • Last Activity:{' '}
                  {formatTimestamp(rep.lastActivity)}
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
            {/* Overall Performance */}
            <div className='px-6 py-4 bg-gray-50 border-b border-gray-200'>
              <div className='flex items-center justify-between'>
                <div>
                  <h3 className='text-sm font-medium text-gray-900'>
                    Overall Performance
                  </h3>
                  <div
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium mt-1 ${getBandColor(rep.overallBand)}`}
                  >
                    {getBandIcon(rep.overallBand)} {rep.overallBand}
                  </div>
                </div>
                <div className='text-right'>
                  <div className='text-xs text-gray-500'>Rep ID</div>
                  <div className='text-sm font-mono text-gray-900'>
                    {rep.repId}
                  </div>
                </div>
              </div>
            </div>

            {/* Coaching Recommendation */}
            <div
              className={`px-6 py-4 border-b border-gray-200 ${
                coachingRecommendation.priority === 'HIGH'
                  ? 'bg-red-50'
                  : coachingRecommendation.priority === 'MEDIUM'
                    ? 'bg-yellow-50'
                    : 'bg-green-50'
              }`}
              data-testid='coaching-section'
            >
              <h3 className='text-sm font-medium text-gray-900 mb-3'>
                Coaching Recommendation
              </h3>
              <div className='space-y-2'>
                <div
                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    coachingRecommendation.priority === 'HIGH'
                      ? 'bg-red-100 text-red-800'
                      : coachingRecommendation.priority === 'MEDIUM'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-green-100 text-green-800'
                  }`}
                >
                  {coachingRecommendation.priority} PRIORITY
                </div>
                <h4 className='text-sm font-medium text-gray-900'>
                  {coachingRecommendation.title}
                </h4>
                <ul className='text-sm text-gray-700 space-y-1'>
                  {coachingRecommendation.actions.map((action, index) => (
                    <li key={index} className='flex items-start'>
                      <span className='text-gray-400 mr-2'>•</span>
                      {action}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Performance Metrics */}
            <div className='px-6 py-4'>
              <h3 className='text-md font-medium text-gray-900 mb-4'>
                Performance Metrics
              </h3>

              {drilldownData ? (
                <div className='space-y-6'>
                  {drilldownData.scorecard.sections.map(section => (
                    <div key={section.key}>
                      <h4 className='text-sm font-medium text-gray-900 mb-3'>
                        {section.title}
                      </h4>
                      <div className='grid grid-cols-1 gap-3'>
                        {section.metrics.map(metric => (
                          <div
                            key={metric.key}
                            className='bg-white rounded-lg border border-gray-200 p-4'
                          >
                            <div className='flex items-center justify-between mb-2'>
                              <div className='text-sm font-medium text-gray-900'>
                                {metric.label}
                              </div>
                              <span
                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getBandColor(metric.band)}`}
                              >
                                {getBandIcon(metric.band)} {metric.band}
                              </span>
                            </div>
                            <div className='text-lg font-semibold text-gray-900 mb-1'>
                              {metric.value}
                              {metric.unit}
                            </div>
                            <div className='text-xs text-gray-600'>
                              Source: {metric.evidence.source} • Records:{' '}
                              {metric.evidence.recordCount} • Policy:{' '}
                              {metric.evidence.policyVersion}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : isLoading ? (
                <div className='text-center py-8'>
                  <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto'></div>
                  <p className='mt-2 text-sm text-gray-600'>
                    Loading metrics...
                  </p>
                </div>
              ) : error ? (
                <div className='text-center py-8'>
                  <div className='text-red-600 mb-2'>Error loading metrics</div>
                  <p className='text-sm text-gray-600'>{error}</p>
                </div>
              ) : null}
            </div>

            {/* Recent Activity */}
            <div className='px-6 py-4 border-t border-gray-200'>
              <h3 className='text-md font-medium text-gray-900 mb-4'>
                Recent Activity
              </h3>

              {drilldownData ? (
                <div className='space-y-3'>
                  {drilldownData.recentActivity.map((activity, index) => (
                    <div
                      key={`${activity.id}-${index}`}
                      className='bg-white rounded-lg border border-gray-200 p-4'
                    >
                      <div className='flex items-start justify-between'>
                        <div className='flex-1'>
                          <div className='flex items-center space-x-2 mb-2'>
                            <span className='text-sm font-medium text-gray-900 capitalize'>
                              {activity.type.replace('_', ' ')}
                            </span>
                            <span className='text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded'>
                              {activity.id}
                            </span>
                          </div>
                          <div className='text-sm text-gray-600 mb-2'>
                            {Object.entries(activity.details)
                              .map(([key, value]) => `${key}: ${value}`)
                              .join(' • ')}
                          </div>
                          <div className='text-xs text-gray-500'>
                            {formatTimestamp(activity.timestamp)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {drilldownData.recentActivity.length === 0 && (
                    <div className='text-center py-8 text-gray-500'>
                      No recent activity found
                    </div>
                  )}
                </div>
              ) : (
                <div className='text-center py-8 text-gray-500'>
                  Activity data not available
                </div>
              )}
            </div>

            {/* Debug info */}
            {process.env.NODE_ENV === 'development' && drilldownData && (
              <div className='px-6 py-2 bg-gray-100 border-t border-gray-200'>
                <div className='text-xs text-gray-500'>
                  Correlation ID: {drilldownData.scorecard.correlationId}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
