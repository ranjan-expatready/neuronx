/**
 * Team Scorecard Table - WI-063: Manager Console – Team Intelligence & Coaching Surface
 *
 * Displays rep performance metrics in a table format with color-coded performance bands.
 */

'use client';

import { RepPerformance } from '../../../lib/types';

interface TeamScorecardTableProps {
  repPerformances: RepPerformance[];
  onRepClick: (rep: RepPerformance) => void;
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

const formatLastActivity = (timestamp: string) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInHours = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60)
  );

  if (diffInHours < 1) {
    return 'Just now';
  } else if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  } else {
    return date.toLocaleDateString();
  }
};

/**
 * Team Scorecard Table Component
 * Displays rep performance data in a structured table
 */
export function TeamScorecardTable({
  repPerformances,
  onRepClick,
}: TeamScorecardTableProps) {
  if (repPerformances.length === 0) {
    return (
      <div className='text-center py-12'>
        <p className='text-gray-500'>No rep performance data available</p>
      </div>
    );
  }

  // Get key metrics for display (first 3 metrics per rep)
  const displayMetrics = [
    'lead_to_contact_rate',
    'sla_breach_rate',
    'blocked_actions_count',
  ];

  return (
    <div className='overflow-x-auto'>
      <table className='data-table min-w-full'>
        <thead>
          <tr>
            <th className='text-left'>Rep Name</th>
            <th className='text-center'>Overall Status</th>
            <th className='text-center'>Lead→Contact</th>
            <th className='text-center'>SLA Breach</th>
            <th className='text-center'>Blocked Actions</th>
            <th className='text-center'>Last Activity</th>
            <th className='text-center'>Actions</th>
          </tr>
        </thead>
        <tbody className='bg-white divide-y divide-gray-200'>
          {repPerformances.map(rep => {
            const leadToContactMetric = rep.metrics.find(
              m => m.key === 'lead_to_contact_rate'
            );
            const slaBreachMetric = rep.metrics.find(
              m => m.key === 'sla_breach_rate'
            );
            const blockedActionsMetric = rep.metrics.find(
              m => m.key === 'blocked_actions_count'
            );

            return (
              <tr
                key={rep.repId}
                className='hover:bg-gray-50'
                data-testid='rep-row'
              >
                <td className='px-6 py-4 whitespace-nowrap'>
                  <div className='flex items-center'>
                    <div>
                      <div className='text-sm font-medium text-gray-900'>
                        {rep.repName}
                      </div>
                      <div className='text-sm text-gray-500'>
                        ID: {rep.repId}
                      </div>
                    </div>
                  </div>
                </td>

                <td className='px-6 py-4 whitespace-nowrap text-center'>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getBandColor(rep.overallBand)}`}
                  >
                    {getBandIcon(rep.overallBand)} {rep.overallBand}
                  </span>
                </td>

                <td className='px-6 py-4 whitespace-nowrap text-center'>
                  {leadToContactMetric && (
                    <div>
                      <div className='text-sm font-medium text-gray-900'>
                        {leadToContactMetric.value}
                        {leadToContactMetric.unit}
                      </div>
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getBandColor(leadToContactMetric.band)}`}
                      >
                        {leadToContactMetric.band}
                      </span>
                    </div>
                  )}
                </td>

                <td className='px-6 py-4 whitespace-nowrap text-center'>
                  {slaBreachMetric && (
                    <div>
                      <div className='text-sm font-medium text-gray-900'>
                        {slaBreachMetric.value}
                        {slaBreachMetric.unit}
                      </div>
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getBandColor(slaBreachMetric.band)}`}
                      >
                        {slaBreachMetric.band}
                      </span>
                    </div>
                  )}
                </td>

                <td className='px-6 py-4 whitespace-nowrap text-center'>
                  {blockedActionsMetric && (
                    <div>
                      <div className='text-sm font-medium text-gray-900'>
                        {blockedActionsMetric.value} {blockedActionsMetric.unit}
                      </div>
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getBandColor(blockedActionsMetric.band)}`}
                      >
                        {blockedActionsMetric.band}
                      </span>
                    </div>
                  )}
                </td>

                <td className='px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500'>
                  {formatLastActivity(rep.lastActivity)}
                </td>

                <td className='px-6 py-4 whitespace-nowrap text-center'>
                  <button
                    onClick={() => onRepClick(rep)}
                    className='inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                    data-testid='rep-details-button'
                  >
                    View Details
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Coaching Insights Section */}
      <div className='bg-gray-50 px-6 py-4 border-t border-gray-200'>
        <h3 className='text-sm font-medium text-gray-900 mb-3'>
          Coaching Insights
        </h3>

        <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
          {/* Reps needing attention */}
          <div className='bg-white rounded-lg p-4 border border-gray-200'>
            <div className='flex items-center'>
              <div className='text-2xl mr-3'>🔴</div>
              <div>
                <div className='text-sm font-medium text-gray-900'>
                  High Priority
                </div>
                <div className='text-lg font-semibold text-red-600'>
                  {
                    repPerformances.filter(rep => rep.overallBand === 'RED')
                      .length
                  }
                </div>
                <div className='text-xs text-gray-500'>
                  Reps needing immediate attention
                </div>
              </div>
            </div>
          </div>

          {/* Reps with warnings */}
          <div className='bg-white rounded-lg p-4 border border-gray-200'>
            <div className='flex items-center'>
              <div className='text-2xl mr-3'>🟡</div>
              <div>
                <div className='text-sm font-medium text-gray-900'>
                  Monitor Closely
                </div>
                <div className='text-lg font-semibold text-yellow-600'>
                  {
                    repPerformances.filter(rep => rep.overallBand === 'YELLOW')
                      .length
                  }
                </div>
                <div className='text-xs text-gray-500'>
                  Reps showing warning signs
                </div>
              </div>
            </div>
          </div>

          {/* Top performers */}
          <div className='bg-white rounded-lg p-4 border border-gray-200'>
            <div className='flex items-center'>
              <div className='text-2xl mr-3'>🟢</div>
              <div>
                <div className='text-sm font-medium text-gray-900'>
                  Top Performers
                </div>
                <div className='text-lg font-semibold text-green-600'>
                  {
                    repPerformances.filter(rep => rep.overallBand === 'GREEN')
                      .length
                  }
                </div>
                <div className='text-xs text-gray-500'>
                  Reps performing well
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick coaching tips */}
        <div className='mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200'>
          <h4 className='text-sm font-medium text-blue-900 mb-2'>
            Quick Coaching Tips
          </h4>
          <ul className='text-sm text-blue-800 space-y-1'>
            <li>
              • Focus on RED performers first - they may need immediate support
            </li>
            <li>• YELLOW performers often respond well to targeted coaching</li>
            <li>• Study GREEN performers to identify best practices</li>
            <li>• Use drill-down details to understand root causes</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
