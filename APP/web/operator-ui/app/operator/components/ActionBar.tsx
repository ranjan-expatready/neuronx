/**
 * Action Bar - WI-062: Operator Console
 *
 * Governed action interface enforcing explain→authorize→execute sequencing.
 * No business logic - pure UI coordination with ui-sdk action dispatch.
 */

import { useState } from 'react';
import {
  PlayIcon,
  CheckIcon,
  XIcon,
  ExclamationIcon,
} from '@heroicons/react/outline';
import {
  planExecution,
  approveExecution,
  executeToken,
  validateAction,
  ActionErrorCode,
} from '@neuronx/ui-sdk';
import { SelectedItem } from './OperatorConsole';

interface ActionBarProps {
  item: SelectedItem;
  onActionComplete: () => void;
}

interface ActionStep {
  id: 'explain' | 'plan' | 'approve' | 'execute';
  label: string;
  description: string;
  status: 'pending' | 'active' | 'completed' | 'error';
  error?: string;
}

export function ActionBar({ item, onActionComplete }: ActionBarProps) {
  const [currentStep, setCurrentStep] = useState<ActionStep['id']>('explain');
  const [isLoading, setIsLoading] = useState(false);
  const [executionPlan, setExecutionPlan] = useState<any>(null);
  const [executionToken, setExecutionToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [correlationId, setCorrelationId] = useState<string | null>(null);

  const steps: ActionStep[] = [
    {
      id: 'explain',
      label: 'Explain',
      description: 'Review system reasoning and policy references',
      status: currentStep === 'explain' ? 'active' : 'completed',
    },
    {
      id: 'plan',
      label: 'Plan',
      description: 'Create execution plan with approval requirements',
      status:
        currentStep === 'plan'
          ? 'active'
          : executionPlan
            ? 'completed'
            : 'pending',
    },
    {
      id: 'approve',
      label: 'Approve',
      description: 'Review and approve plan execution',
      status:
        currentStep === 'approve'
          ? 'active'
          : executionToken
            ? 'completed'
            : 'pending',
    },
    {
      id: 'execute',
      label: 'Execute',
      description: 'Execute approved actions',
      status: currentStep === 'execute' ? 'active' : 'pending',
    },
  ];

  const handleExplain = () => {
    // Explanation is already shown in detail panel
    // User must acknowledge they understand before proceeding
    setCurrentStep('plan');
  };

  const handlePlan = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Use ui-sdk to plan execution
      const plan = await planExecution(
        item.opportunityId,
        {
          commandType: item.context.nextAction || 'unknown_action',
          parameters: {
            opportunityId: item.opportunityId,
            priority: item.priority,
          },
        },
        {
          decisionId: item.id,
          outcome: 'planned',
          confidence: 0.9,
          evidence: [
            `priority_${item.priority}`,
            `deal_value_${item.context.dealValue}`,
          ],
        },
        {
          dealValue: item.context.dealValue,
          riskScore: item.context.riskScore,
          slaUrgency:
            item.priority === 'urgent'
              ? 'urgent'
              : item.priority === 'high'
                ? 'high'
                : 'normal',
        }
      );

      setExecutionPlan(plan);
      setCorrelationId(plan.correlationId);

      if (plan.requiresApproval) {
        setCurrentStep('approve');
      } else {
        // Auto-approve if not required
        setExecutionToken(plan.planId); // In real implementation, this would be a token
        setCurrentStep('execute');
      }
    } catch (error: any) {
      console.error('Planning failed:', error);
      setError(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!executionPlan) return;

    setIsLoading(true);
    setError(null);

    try {
      // Use ui-sdk to approve execution
      const result = await approveExecution(
        executionPlan.planId,
        'Approved via Operator Console'
      );

      setExecutionToken(result.auditId || executionPlan.planId); // Token for execution
      setCurrentStep('execute');
    } catch (error: any) {
      console.error('Approval failed:', error);
      setError(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!executionToken) return;

    setIsLoading(true);
    setError(null);

    try {
      // Use ui-sdk to execute token
      await executeToken(executionToken);

      // Success - complete the action
      onActionComplete();
    } catch (error: any) {
      console.error('Execution failed:', error);
      setError(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const getErrorMessage = (error: any): string => {
    const code = error.code || ActionErrorCode.UNKNOWN;

    switch (code) {
      case ActionErrorCode.UNAUTHORIZED:
        return 'You are not authorized to perform this action.';
      case ActionErrorCode.FORBIDDEN:
        return 'This action is forbidden by current policy.';
      case ActionErrorCode.BLOCKED_BY_POLICY:
        return 'Action blocked by policy. Check system status and try again.';
      case ActionErrorCode.BILLING_BLOCKED:
        return 'Action blocked due to billing status. Contact billing team.';
      case ActionErrorCode.SCOPE_BLOCKED:
        return 'Action blocked due to scope limitations.';
      case ActionErrorCode.DRIFT_BLOCKED:
        return 'Action blocked due to system drift. Contact engineering.';
      default:
        return error.message || 'An unexpected error occurred.';
    }
  };

  const canProceedToPlan = () => {
    // User must have reviewed the explanation
    return currentStep === 'explain';
  };

  const canProceedToApprove = () => {
    return (
      executionPlan && executionPlan.requiresApproval && currentStep === 'plan'
    );
  };

  const canExecute = () => {
    return executionToken && currentStep === 'execute';
  };

  return (
    <div className='border-t border-gray-200 bg-white p-6'>
      {/* Step Indicator */}
      <div className='mb-6'>
        <div className='flex items-center justify-between'>
          {steps.map((step, index) => (
            <div key={step.id} className='flex items-center'>
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full ${
                  step.status === 'completed'
                    ? 'bg-green-500 text-white'
                    : step.status === 'active'
                      ? 'bg-blue-500 text-white'
                      : step.status === 'error'
                        ? 'bg-red-500 text-white'
                        : 'bg-gray-200 text-gray-600'
                }`}
              >
                {step.status === 'completed' ? (
                  <CheckIcon className='w-4 h-4' />
                ) : step.status === 'error' ? (
                  <XIcon className='w-4 h-4' />
                ) : (
                  <span className='text-sm font-medium'>{index + 1}</span>
                )}
              </div>

              <div className='ml-3'>
                <p
                  className={`text-sm font-medium ${
                    step.status === 'active' ? 'text-blue-600' : 'text-gray-900'
                  }`}
                >
                  {step.label}
                </p>
                <p className='text-xs text-gray-500'>{step.description}</p>
              </div>

              {index < steps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-4 ${
                    step.status === 'completed' ? 'bg-green-500' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className='mb-4 bg-red-50 border border-red-200 rounded-md p-4'>
          <div className='flex'>
            <ExclamationIcon className='h-5 w-5 text-red-400' />
            <div className='ml-3'>
              <h3 className='text-sm font-medium text-red-800'>
                Action Failed
              </h3>
              <p className='text-sm text-red-700 mt-1'>{error}</p>
              {correlationId && (
                <p className='text-xs text-red-600 mt-2'>
                  Support ID: {correlationId}
                  <button
                    onClick={() => navigator.clipboard.writeText(correlationId)}
                    className='ml-2 text-red-500 hover:text-red-700 underline'
                  >
                    Copy
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className='flex justify-between items-center'>
        <div className='text-sm text-gray-600'>
          {executionPlan && <span>Plan ID: {executionPlan.planId}</span>}
          {correlationId && (
            <span className='ml-4'>Correlation: {correlationId.slice(-8)}</span>
          )}
        </div>

        <div className='flex space-x-3'>
          {currentStep === 'explain' && (
            <button
              onClick={handleExplain}
              className='inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
            >
              I Understand, Continue
            </button>
          )}

          {currentStep === 'plan' && (
            <button
              onClick={handlePlan}
              disabled={isLoading || !canProceedToPlan()}
              className='inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50'
            >
              {isLoading ? 'Planning...' : 'Create Plan'}
            </button>
          )}

          {canProceedToApprove() && (
            <button
              onClick={handleApprove}
              disabled={isLoading}
              className='inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50'
            >
              {isLoading ? 'Approving...' : 'Approve & Continue'}
            </button>
          )}

          {canExecute() && (
            <button
              onClick={handleExecute}
              disabled={isLoading}
              className='inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50'
            >
              <PlayIcon className='w-4 h-4 mr-2' />
              {isLoading ? 'Executing...' : 'Execute Action'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
