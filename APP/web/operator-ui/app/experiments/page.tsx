/**
 * Experiment Insights - WI-032: Operator Control Plane
 *
 * Read-only view of experiment results and insights.
 * NO experiment control - just visibility into performance.
 */

'use client';

import { useState, useEffect } from 'react';
import { experimentsApi } from '../../../lib/api-client';
import { ExperimentSummary } from '../../../lib/types';
import {
  Card,
  StatusBadge,
  LoadingSpinner,
  ErrorMessage,
} from '../../../components/ui';

export default function ExperimentsPage() {
  const [experiments, setExperiments] = useState<ExperimentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadExperiments = async () => {
      try {
        setLoading(true);
        const response = await experimentsApi.getExperiments();

        if (response.success && response.data) {
          setExperiments(response.data);
        } else {
          setError(response.error || 'Failed to load experiments');
        }
      } catch (err) {
        setError('Network error loading experiments');
      } finally {
        setLoading(false);
      }
    };

    loadExperiments();
  }, []);

  if (loading) {
    return (
      <div className='flex justify-center py-8'>
        <LoadingSpinner size='lg' />
      </div>
    );
  }

  if (error) {
    return <ErrorMessage title='Error Loading Experiments' message={error} />;
  }

  const activeExperiments = experiments.filter(exp => exp.state === 'ACTIVE');
  const completedExperiments = experiments.filter(
    exp => exp.state === 'COMPLETED'
  );
  const terminatedExperiments = experiments.filter(
    exp => exp.state === 'TERMINATED'
  );

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>
            Experiment Insights
          </h1>
          <p className='text-gray-600'>
            Performance analysis and recommendations
          </p>
        </div>
        <div className='flex items-center space-x-4'>
          <span className='text-sm text-gray-600'>
            {experiments.length} total experiments
          </span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
        <Card>
          <div className='text-center'>
            <div className='text-2xl font-bold text-blue-600'>
              {activeExperiments.length}
            </div>
            <div className='text-sm text-gray-600'>Active Experiments</div>
          </div>
        </Card>

        <Card>
          <div className='text-center'>
            <div className='text-2xl font-bold text-green-600'>
              {completedExperiments.length}
            </div>
            <div className='text-sm text-gray-600'>Completed Experiments</div>
          </div>
        </Card>

        <Card>
          <div className='text-center'>
            <div className='text-2xl font-bold text-red-600'>
              {terminatedExperiments.length}
            </div>
            <div className='text-sm text-gray-600'>Terminated Experiments</div>
          </div>
        </Card>
      </div>

      {/* Active Experiments */}
      {activeExperiments.length > 0 && (
        <Card title={`Active Experiments (${activeExperiments.length})`}>
          <div className='space-y-4'>
            {activeExperiments.map(experiment => (
              <ExperimentCard
                key={experiment.experimentId}
                experiment={experiment}
              />
            ))}
          </div>
        </Card>
      )}

      {/* Completed Experiments */}
      {completedExperiments.length > 0 && (
        <Card title={`Completed Experiments (${completedExperiments.length})`}>
          <div className='space-y-4'>
            {completedExperiments.map(experiment => (
              <ExperimentCard
                key={experiment.experimentId}
                experiment={experiment}
              />
            ))}
          </div>
        </Card>
      )}

      {/* Terminated Experiments */}
      {terminatedExperiments.length > 0 && (
        <Card
          title={`Terminated Experiments (${terminatedExperiments.length})`}
        >
          <div className='space-y-4'>
            {terminatedExperiments.map(experiment => (
              <ExperimentCard
                key={experiment.experimentId}
                experiment={experiment}
              />
            ))}
          </div>
        </Card>
      )}

      {/* Empty State */}
      {experiments.length === 0 && (
        <Card>
          <div className='text-center py-12'>
            <div className='text-gray-400 text-6xl mb-4'>🧪</div>
            <h3 className='text-lg font-medium text-gray-900 mb-2'>
              No experiments found
            </h3>
            <p className='text-gray-600'>
              No experiments have been run yet, or they may be filtered.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}

interface ExperimentCardProps {
  experiment: ExperimentSummary;
}

function ExperimentCard({ experiment }: ExperimentCardProps) {
  const isCompleted = experiment.state === 'COMPLETED';
  const hasWinner =
    experiment.bestVariant && experiment.bestVariant.improvement > 0;

  return (
    <div className='border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow'>
      <div className='flex items-start justify-between mb-3'>
        <div className='flex-1'>
          <div className='flex items-center space-x-3 mb-2'>
            <h3 className='text-lg font-medium text-gray-900'>
              {experiment.name}
            </h3>
            <StatusBadge status={experiment.state} />
          </div>

          <p className='text-sm text-gray-600 mb-2'>{experiment.description}</p>

          <div className='flex items-center space-x-4 text-sm text-gray-600'>
            <span>{experiment.totalAssignments} assignments</span>
            <span>
              {(experiment.completionRate * 100).toFixed(1)}% complete
            </span>
            {experiment.startedAt && (
              <span>
                Started {new Date(experiment.startedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Best Variant Highlight */}
      {isCompleted && hasWinner && (
        <div className='bg-green-50 border border-green-200 rounded-md p-3 mb-3'>
          <div className='flex items-center justify-between'>
            <div>
              <div className='text-green-800 font-medium'>
                Best Variant: {experiment.bestVariant?.variantId}
              </div>
              <div className='text-green-700 text-sm'>
                {(experiment.bestVariant?.conversionRate * 100).toFixed(1)}%
                conversion rate (+
                {experiment.bestVariant?.improvement.toFixed(1)}% improvement)
              </div>
            </div>
            <div className='text-green-600 font-semibold'>
              {(experiment.bestVariant?.improvement || 0).toFixed(1)}%
            </div>
          </div>
        </div>
      )}

      {/* Recommendations */}
      {experiment.recommendations.length > 0 && (
        <div className='space-y-2'>
          <h4 className='text-sm font-medium text-gray-900'>Recommendations</h4>
          {experiment.recommendations.map((rec, index) => (
            <div
              key={index}
              className={`text-sm p-2 rounded-md ${
                rec.priority === 'critical'
                  ? 'bg-red-50 text-red-800'
                  : rec.priority === 'high'
                    ? 'bg-orange-50 text-orange-800'
                    : rec.priority === 'medium'
                      ? 'bg-yellow-50 text-yellow-800'
                      : 'bg-blue-50 text-blue-800'
              }`}
            >
              <div className='font-medium'>
                {rec.type.replace('_', ' ').toUpperCase()}
              </div>
              <div>{rec.description}</div>
            </div>
          ))}
        </div>
      )}

      {/* Experiment ID */}
      <div className='mt-3 pt-3 border-t border-gray-200'>
        <div className='text-xs text-gray-500 font-mono'>
          ID: {experiment.experimentId}
        </div>
      </div>
    </div>
  );
}
