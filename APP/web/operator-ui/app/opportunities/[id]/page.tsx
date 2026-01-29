/**
 * Opportunity Command View - WI-032: Operator Control Plane
 *
 * Read-mostly view showing NeuronX's understanding and decisions for an opportunity.
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  opportunitiesApi,
  generateCorrelationId,
} from '../../../lib/api-client';
import { OpportunityView } from '../../../lib/types';
import { useAuth } from '../../../lib/auth';
import {
  Card,
  StatusBadge,
  Timeline,
  AuditTrail,
} from '../../../components/ui';

export default function OpportunityPage() {
  const params = useParams();
  const opportunityId = params.id as string;
  const { hasPermission } = useAuth();

  const [opportunity, setOpportunity] = useState<OpportunityView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadOpportunity = async () => {
      try {
        setLoading(true);
        const response = await opportunitiesApi.getOpportunity(opportunityId);

        if (response.success && response.data) {
          setOpportunity(response.data);
        } else {
          setError(response.error || 'Failed to load opportunity');
        }
      } catch (err) {
        setError('Network error loading opportunity');
      } finally {
        setLoading(false);
      }
    };

    if (opportunityId) {
      loadOpportunity();
    }
  }, [opportunityId]);

  if (loading) {
    return (
      <div className='space-y-6'>
        <div className='animate-pulse'>
          <div className='h-8 bg-gray-200 rounded w-1/4 mb-4'></div>
          <div className='space-y-3'>
            <div className='h-4 bg-gray-200 rounded w-3/4'></div>
            <div className='h-4 bg-gray-200 rounded w-1/2'></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !opportunity) {
    return (
      <Card>
        <div className='text-center py-8'>
          <div className='text-red-600 text-lg font-medium mb-2'>
            Error Loading Opportunity
          </div>
          <div className='text-gray-600'>
            {error || 'Opportunity not found'}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>
            Opportunity {opportunity.opportunityId}
          </h1>
          <div className='flex items-center space-x-4 mt-2'>
            <StatusBadge status={opportunity.currentStage} />
            <span className='text-gray-600'>
              ${opportunity.dealValue.toLocaleString()}
            </span>
            <span className='text-gray-600'>
              Risk: {opportunity.riskScore}/100
            </span>
            <StatusBadge status={opportunity.urgency} variant='urgency' />
          </div>
        </div>
      </div>

      {/* NeuronX Context */}
      <Card title='NeuronX Context'>
        <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
          <div>
            <label className='text-sm font-medium text-gray-500'>
              Active Playbook Version
            </label>
            <div className='mt-1 text-lg font-semibold'>
              {opportunity.activePlaybookVersion || 'None'}
              {opportunity.pinnedVersion && (
                <span className='ml-2 text-sm text-blue-600'>(pinned)</span>
              )}
            </div>
          </div>

          {opportunity.experimentId && (
            <div>
              <label className='text-sm font-medium text-gray-500'>
                Experiment
              </label>
              <div className='mt-1 text-lg font-semibold'>
                {opportunity.experimentId}
                {opportunity.variantId && (
                  <span className='ml-2 text-sm text-purple-600'>
                    ({opportunity.variantId})
                  </span>
                )}
              </div>
            </div>
          )}

          <div>
            <label className='text-sm font-medium text-gray-500'>
              Last Decision
            </label>
            <div className='mt-1'>
              {opportunity.latestDecision ? (
                <div className='text-sm'>
                  <div>
                    {new Date(
                      opportunity.latestDecision.timestamp
                    ).toLocaleString()}
                  </div>
                  <div className='text-gray-500 font-mono text-xs'>
                    {opportunity.latestDecision.correlationId}
                  </div>
                </div>
              ) : (
                <span className='text-gray-500'>No decisions yet</span>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Latest Decision Result */}
      {opportunity.latestDecision?.decisionResult && (
        <Card title='Latest Decision'>
          <DecisionResultDisplay
            decisionResult={opportunity.latestDecision.decisionResult}
            correlationId={opportunity.latestDecision.correlationId}
          />
        </Card>
      )}

      {/* Planned Actions */}
      <Card title='Planned Actions'>
        {opportunity.plannedActions.length > 0 ? (
          <div className='space-y-3'>
            {opportunity.plannedActions.map(action => (
              <div
                key={action.actionId}
                className='flex items-center justify-between p-3 bg-gray-50 rounded-md'
              >
                <div className='flex-1'>
                  <div className='font-medium'>{action.description}</div>
                  <div className='text-sm text-gray-600'>
                    {action.commandType} via {action.channel} • Priority:{' '}
                    {action.priority}
                    {action.slaMinutes && ` • SLA: ${action.slaMinutes}min`}
                  </div>
                </div>
                <StatusBadge status={action.status} variant='action' />
              </div>
            ))}
          </div>
        ) : (
          <div className='text-gray-500 text-center py-4'>
            No planned actions
          </div>
        )}
      </Card>

      {/* Evidence Timeline */}
      <Card title='Evidence Timeline'>
        <Timeline events={opportunity.evidenceTimeline} />
      </Card>

      {/* Recent Audit Events */}
      {hasPermission('read:audit') && (
        <Card title='Recent Audit Events'>
          <AuditTrail events={opportunity.recentAuditEvents} />
        </Card>
      )}
    </div>
  );
}

/**
 * Decision Result Display Component
 */
function DecisionResultDisplay({
  decisionResult,
  correlationId,
}: {
  decisionResult: any;
  correlationId: string;
}) {
  return (
    <div className='space-y-4'>
      <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
        <div>
          <label className='text-sm font-medium text-gray-500'>Actor</label>
          <div className='mt-1'>
            <StatusBadge status={decisionResult.actor} variant='actor' />
          </div>
        </div>

        <div>
          <label className='text-sm font-medium text-gray-500'>Mode</label>
          <div className='mt-1'>
            <StatusBadge status={decisionResult.mode} variant='mode' />
          </div>
        </div>

        <div>
          <label className='text-sm font-medium text-gray-500'>
            Voice Mode
          </label>
          <div className='mt-1'>
            {decisionResult.voiceMode ? (
              <StatusBadge status={decisionResult.voiceMode} variant='voice' />
            ) : (
              <span className='text-gray-500'>N/A</span>
            )}
          </div>
        </div>
      </div>

      {decisionResult.escalationRequired && (
        <div className='bg-yellow-50 border border-yellow-200 rounded-md p-3'>
          <div className='text-yellow-800 font-medium'>Escalation Required</div>
          <div className='text-yellow-700 text-sm mt-1'>
            This decision requires human escalation before proceeding.
          </div>
        </div>
      )}

      <div>
        <label className='text-sm font-medium text-gray-500'>
          Execution Constraints
        </label>
        <div className='mt-1 flex flex-wrap gap-2'>
          {decisionResult.executionConstraints?.map(
            (constraint: string, index: number) => (
              <span
                key={index}
                className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800'
              >
                {constraint}
              </span>
            )
          ) || <span className='text-gray-500'>None</span>}
        </div>
      </div>

      <div>
        <label className='text-sm font-medium text-gray-500'>
          Audit Reason
        </label>
        <div className='mt-1 text-sm text-gray-900 bg-gray-50 p-2 rounded'>
          {decisionResult.auditReason}
        </div>
      </div>

      <div className='text-xs text-gray-500 font-mono'>
        Correlation ID: {correlationId}
      </div>
    </div>
  );
}
