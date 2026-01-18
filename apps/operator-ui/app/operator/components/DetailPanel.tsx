/**
 * Detail Panel - WI-062: Operator Console
 *
 * Right panel showing selected work queue item details, explainability, and evidence.
 */

import { useState, useEffect } from 'react';
import {
  ExternalLinkIcon,
  QuestionMarkCircleIcon,
  DocumentIcon,
} from '@heroicons/react/outline';
import {
  explainDecision,
  buildDecisionExplanationLink,
  buildReadinessReportLink,
  openDeepLink,
} from '@neuronx/ui-sdk';
import { SelectedItem } from './OperatorConsole';

interface DetailPanelProps {
  item: SelectedItem | null;
  onActionComplete: () => void;
}

export function DetailPanel({ item, onActionComplete }: DetailPanelProps) {
  const [explanation, setExplanation] = useState<any>(null);
  const [isLoadingExplanation, setIsLoadingExplanation] = useState(false);
  const [explanationError, setExplanationError] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      loadExplanation();
    } else {
      setExplanation(null);
      setExplanationError(null);
    }
  }, [item]);

  const loadExplanation = async () => {
    if (!item) return;

    setIsLoadingExplanation(true);
    setExplanationError(null);

    try {
      // Use the explainDecision function from ui-sdk
      const explanationData = await explainDecision(item.id);
      setExplanation(explanationData);
    } catch (error) {
      console.error('Failed to load explanation:', error);
      setExplanationError(
        error instanceof Error ? error.message : 'Failed to load explanation'
      );
    } finally {
      setIsLoadingExplanation(false);
    }
  };

  const handleEvidenceLink = async (type: string, id: string) => {
    try {
      switch (type) {
        case 'decision':
          const decisionLink = await buildDecisionExplanationLink(id);
          window.open(decisionLink.url, '_blank');
          break;
        case 'readiness':
          const readinessLink = await buildReadinessReportLink(id);
          window.open(readinessLink.url, '_blank');
          break;
        default:
          console.warn('Unknown evidence link type:', type);
      }
    } catch (error) {
      console.error('Failed to open evidence link:', error);
    }
  };

  const handleGhlLink = async (
    entityType: 'opportunity' | 'contact',
    entityId: string
  ) => {
    try {
      await openDeepLink({
        url: `https://app.gohighlevel.com/${entityType === 'opportunity' ? 'opportunities' : 'contacts'}/${entityId}`,
        type: entityType === 'opportunity' ? 'OPPORTUNITY' : 'CONTACT',
        entityId,
        tenantId: 'current-tenant', // This would come from principal context
      });
    } catch (error) {
      console.error('Failed to open GHL link:', error);
    }
  };

  if (!item) {
    return (
      <div className='h-full flex items-center justify-center'>
        <div className='text-center text-gray-500'>
          <DocumentIcon className='h-12 w-12 mx-auto mb-4' />
          <h3 className='text-lg font-medium'>Select an item</h3>
          <p className='text-sm'>
            Choose a work queue item to view details and take action.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className='h-full flex flex-col'>
      {/* Header */}
      <div className='p-6 border-b border-gray-200'>
        <div className='flex items-center justify-between'>
          <div>
            <h2 className='text-lg font-medium text-gray-900'>
              {item.context.contactName || 'Unknown Contact'}
            </h2>
            {item.context.companyName && (
              <p className='text-sm text-gray-600'>
                {item.context.companyName}
              </p>
            )}
          </div>

          {/* GHL Links */}
          <div className='flex space-x-2'>
            {item.opportunityId && (
              <button
                onClick={() => handleGhlLink('opportunity', item.opportunityId)}
                className='inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50'
              >
                <ExternalLinkIcon className='h-4 w-4 mr-1' />
                View in GHL
              </button>
            )}
          </div>
        </div>

        {/* Opportunity ID */}
        <div className='mt-2 text-sm text-gray-500'>
          ID: {item.opportunityId}
        </div>
      </div>

      {/* Content */}
      <div className='flex-1 overflow-y-auto'>
        {/* Identity Block */}
        <div className='p-6 border-b border-gray-200'>
          <h3 className='text-sm font-medium text-gray-900 mb-3'>
            Contact Details
          </h3>
          <dl className='grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2'>
            <div>
              <dt className='text-sm font-medium text-gray-500'>FSM State</dt>
              <dd className='text-sm text-gray-900'>
                {item.context.currentState || 'Unknown'}
              </dd>
            </div>
            <div>
              <dt className='text-sm font-medium text-gray-500'>Priority</dt>
              <dd className='text-sm text-gray-900 capitalize'>
                {item.priority}
              </dd>
            </div>
            {item.context.dealValue && (
              <div>
                <dt className='text-sm font-medium text-gray-500'>
                  Deal Value
                </dt>
                <dd className='text-sm text-gray-900'>
                  ${item.context.dealValue.toLocaleString()}
                </dd>
              </div>
            )}
            {item.context.riskScore && (
              <div>
                <dt className='text-sm font-medium text-gray-500'>
                  Risk Score
                </dt>
                <dd className='text-sm text-gray-900'>
                  {(item.context.riskScore * 100).toFixed(1)}%
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* System Status Block */}
        <div className='p-6 border-b border-gray-200'>
          <h3 className='text-sm font-medium text-gray-900 mb-3'>
            System Status
          </h3>

          {/* Readiness Status */}
          <div className='mb-3'>
            <div className='flex items-center justify-between'>
              <span className='text-sm text-gray-600'>Readiness Status</span>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  item.readinessStatus === 'READY'
                    ? 'bg-green-100 text-green-800'
                    : item.readinessStatus === 'WARN'
                      ? 'bg-yellow-100 text-yellow-800'
                      : item.readinessStatus === 'BLOCKED'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-800'
                }`}
              >
                {item.readinessStatus || 'UNKNOWN'}
              </span>
            </div>
          </div>

          {/* Billing Status - Placeholder */}
          <div className='mb-3'>
            <div className='flex items-center justify-between'>
              <span className='text-sm text-gray-600'>Billing Status</span>
              <span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800'>
                ACTIVE
              </span>
            </div>
          </div>
        </div>

        {/* Explainability Block */}
        <div className='p-6 border-b border-gray-200'>
          <div className='flex items-center justify-between mb-3'>
            <h3 className='text-sm font-medium text-gray-900'>
              Why This Action?
            </h3>
            <button
              onClick={loadExplanation}
              disabled={isLoadingExplanation}
              className='inline-flex items-center px-2 py-1 border border-gray-300 shadow-sm text-xs leading-4 font-medium rounded text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50'
            >
              <QuestionMarkCircleIcon className='h-3 w-3 mr-1' />
              {isLoadingExplanation ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {explanationError ? (
            <div className='bg-red-50 border border-red-200 rounded-md p-3'>
              <p className='text-sm text-red-700'>
                Failed to load explanation: {explanationError}
              </p>
              <p className='text-xs text-red-600 mt-1'>
                This may indicate a policy or configuration issue.
              </p>
            </div>
          ) : explanation ? (
            <div className='space-y-3'>
              <div className='text-sm text-gray-700'>
                {explanation.explanation ||
                  'No explanation available from the system.'}
              </div>

              {explanation.policyReferences &&
                explanation.policyReferences.length > 0 && (
                  <div>
                    <h4 className='text-xs font-medium text-gray-900 mb-2'>
                      Policy References
                    </h4>
                    <div className='flex flex-wrap gap-1'>
                      {explanation.policyReferences.map(
                        (policy: string, index: number) => (
                          <span
                            key={index}
                            className='inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800'
                          >
                            {policy}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                )}

              {explanation.evidence && explanation.evidence.length > 0 && (
                <div>
                  <h4 className='text-xs font-medium text-gray-900 mb-2'>
                    Evidence
                  </h4>
                  <ul className='text-xs text-gray-600 space-y-1'>
                    {explanation.evidence.map(
                      (evidence: string, index: number) => (
                        <li key={index}>• {evidence}</li>
                      )
                    )}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className='text-sm text-gray-500 italic'>
              {isLoadingExplanation
                ? 'Loading explanation...'
                : 'No explanation available.'}
            </div>
          )}
        </div>

        {/* Evidence Links */}
        <div className='p-6'>
          <h3 className='text-sm font-medium text-gray-900 mb-3'>
            Evidence & Links
          </h3>
          <div className='space-y-2'>
            <button
              onClick={() => handleEvidenceLink('decision', item.id)}
              className='w-full text-left inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50'
            >
              <DocumentIcon className='h-4 w-4 mr-2' />
              View Decision Explanation
            </button>

            <button
              onClick={() => handleEvidenceLink('readiness', undefined)}
              className='w-full text-left inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50'
            >
              <DocumentIcon className='h-4 w-4 mr-2' />
              View Readiness Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
