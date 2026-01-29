/**
 * Scorecard Strip - WI-067: Operator Intelligence Overlay
 *
 * Displays key scorecard metrics at the top of the Operator Console.
 * Server-driven only - no client-side calculations or business logic.
 */

'use client';

import { useState, useEffect } from 'react';
import { scorecardApi, generateCorrelationId } from '../../../lib/api-client';
import { Badge } from '@neuronx/ui-design-system';

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

interface ScorecardSection {
  key: string;
  title: string;
  metrics: ScorecardMetric[];
  overallBand: 'GREEN' | 'YELLOW' | 'RED';
}

interface ScorecardData {
  tenantId: string;
  surface: string;
  timeRange: string;
  sections: ScorecardSection[];
  overallBand: 'GREEN' | 'YELLOW' | 'RED';
  correlationId: string;
}

interface ScorecardStripProps {
  tenantId: string;
  onMetricClick?: (metric: ScorecardMetric) => void;
}

const getBandColor = (band: string) => {
  switch (band) {
    case 'GREEN':
      return 'text-green-700 bg-green-100 border-green-200';
    case 'YELLOW':
      return 'text-yellow-700 bg-yellow-100 border-yellow-200';
    case 'RED':
      return 'text-red-700 bg-red-100 border-red-200';
    default:
      return 'text-gray-700 bg-gray-100 border-gray-200';
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

/**
 * Scorecard Strip Component
 * Displays key metrics with color-coded performance bands
 */
export function ScorecardStrip({
  tenantId,
  onMetricClick,
}: ScorecardStripProps) {
  const [scorecardData, setScorecardData] = useState<ScorecardData | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchScorecardData = async () => {
      const correlationId = generateCorrelationId();

      try {
        setIsLoading(true);
        setError(null);

        const result = await scorecardApi.getScorecard(
          tenantId,
          'OPERATOR',
          '7d',
          {
            correlationId,
            includeDetails: true,
          }
        );

        if (result.success && result.data) {
          setScorecardData(result.data);
        } else {
          setError(result.error || 'Failed to load scorecard data');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchScorecardData();
  }, [tenantId]);

  if (isLoading) {
    return (
      <div className='bg-white border-b border-gray-200 px-4 py-3'>
        <div className='flex items-center space-x-4'>
          <div className='text-sm font-medium text-gray-700'>
            Scorecard (Last 7 days)
          </div>
          <div className='flex space-x-2'>
            {[1, 2, 3].map(i => (
              <div key={i} className='animate-pulse'>
                <div className='h-8 w-32 bg-gray-200 rounded-md'></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='bg-white border-b border-gray-200 px-4 py-3'>
        <div className='flex items-center space-x-4'>
          <div className='text-sm font-medium text-gray-700'>
            Scorecard (Last 7 days)
          </div>
          <div className='text-sm text-red-600'>
            Error loading scorecard: {error}
          </div>
        </div>
      </div>
    );
  }

  if (!scorecardData || scorecardData.sections.length === 0) {
    return (
      <div className='bg-white border-b border-gray-200 px-4 py-3'>
        <div className='flex items-center space-x-4'>
          <div className='text-sm font-medium text-gray-700'>
            Scorecard (Last 7 days)
          </div>
          <div className='text-sm text-gray-500'>
            No scorecard data available
          </div>
        </div>
      </div>
    );
  }

  // Flatten metrics from all sections for display
  const allMetrics = scorecardData.sections.flatMap(section => section.metrics);

  return (
    <div
      className='bg-white border-b border-gray-200 px-4 py-3'
      data-testid='scorecard-strip'
    >
      <div className='flex items-center justify-between'>
        <div className='flex items-center space-x-3'>
          <div className='text-sm font-medium text-gray-700'>
            Scorecard (Last 7 days)
          </div>
          <Badge variant='info' size='sm'>
            Intelligence: NeuronX + GHL
          </Badge>
        </div>

        <div className='flex items-center space-x-3'>
          {allMetrics.slice(0, 5).map(metric => (
            <button
              key={metric.key}
              onClick={() => onMetricClick?.(metric)}
              className={`
                inline-flex items-center px-3 py-1 rounded-md text-xs font-medium border
                transition-colors duration-150 hover:opacity-80
                ${getBandColor(metric.band)}
              `}
              title={`${metric.label}: ${metric.value}${metric.unit} (${metric.band})`}
            >
              <span className='mr-1'>{getBandIcon(metric.band)}</span>
              <span className='mr-1'>{metric.label}:</span>
              <span className='font-semibold'>
                {typeof metric.value === 'number' && metric.value % 1 !== 0
                  ? metric.value.toFixed(1)
                  : metric.value}
                {metric.unit}
              </span>
            </button>
          ))}

          {allMetrics.length > 5 && (
            <div className='text-xs text-gray-500'>
              +{allMetrics.length - 5} more
            </div>
          )}
        </div>
      </div>

      {/* Debug info for development */}
      {process.env.NODE_ENV === 'development' &&
        scorecardData.correlationId && (
          <div className='mt-1 text-xs text-gray-400'>
            Correlation ID: {scorecardData.correlationId}
          </div>
        )}
    </div>
  );
}
