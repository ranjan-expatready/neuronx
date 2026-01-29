/**
 * Human Work Queue - WI-032: Operator Control Plane
 *
 * Queue of tasks requiring human approval, assistance, or escalation.
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { workQueueApi, generateCorrelationId } from '../../../lib/api-client';
import {
  WorkQueueItem,
  WorkQueueActionRequest,
  WorkQueueFilters,
} from '../../../lib/types';
import { useAuth } from '../../../lib/auth';
import { RequireRole } from '../../../lib/auth';
import {
  Card,
  StatusBadge,
  LoadingSpinner,
  ErrorMessage,
} from '../../../components/ui';

export default function WorkQueuePage() {
  return (
    <RequireRole
      roles={['operator', 'admin']}
      fallback={
        <Card>
          <div className='text-center py-8'>
            <div className='text-gray-600'>
              Access denied. Operator role required.
            </div>
          </div>
        </Card>
      }
    >
      <WorkQueueContent />
    </RequireRole>
  );
}

function WorkQueueContent() {
  const { user, hasPermission } = useAuth();
  const [items, setItems] = useState<WorkQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<WorkQueueFilters>({});
  const [processingItems, setProcessingItems] = useState<Set<string>>(
    new Set()
  );

  const loadWorkQueue = async () => {
    try {
      setLoading(true);
      const response = await workQueueApi.getWorkQueue(filters);

      if (response.success && response.data) {
        setItems(response.data.items);
      } else {
        setError(response.error || 'Failed to load work queue');
      }
    } catch (err) {
      setError('Network error loading work queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkQueue();
  }, [filters]);

  const handleAction = async (
    item: WorkQueueItem,
    action: 'approve' | 'assist' | 'escalate' | 'reject',
    notes?: string
  ) => {
    setProcessingItems(prev => new Set(prev).add(item.itemId));

    try {
      const request: WorkQueueActionRequest = {
        itemId: item.itemId,
        opportunityId: item.opportunityId,
        correlationId: generateCorrelationId(),
        action,
        reason: notes,
        assistanceNotes: action === 'assist' ? notes : undefined,
        escalationReason: action === 'escalate' ? notes : undefined,
      };

      const response = await workQueueApi.takeAction(request);

      if (response.success) {
        // Remove item from queue or update status
        setItems(prev => prev.filter(i => i.itemId !== item.itemId));
      } else {
        setError(`Failed to ${action} item: ${response.error}`);
      }
    } catch (err) {
      setError(`Network error during ${action}`);
    } finally {
      setProcessingItems(prev => {
        const next = new Set(prev);
        next.delete(item.itemId);
        return next;
      });
    }
  };

  const getUrgentItems = () =>
    items.filter(
      item => item.priority === 'urgent' || item.priority === 'high'
    );
  const getNormalItems = () => items.filter(item => item.priority === 'normal');
  const getLowItems = () => items.filter(item => item.priority === 'low');

  if (loading) {
    return (
      <div className='flex justify-center py-8'>
        <LoadingSpinner size='lg' />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorMessage
        title='Error Loading Work Queue'
        message={error}
        retry={loadWorkQueue}
      />
    );
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>Work Queue</h1>
          <p className='text-gray-600'>Tasks requiring human attention</p>
        </div>
        <div className='flex items-center space-x-4'>
          <span className='text-sm text-gray-600'>
            {items.length} items in queue
          </span>
          <button onClick={loadWorkQueue} className='btn-secondary'>
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <Card title='Filters'>
        <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>
              Reason
            </label>
            <select
              value={filters.reason?.[0] || ''}
              onChange={e =>
                setFilters(prev => ({
                  ...prev,
                  reason: e.target.value ? [e.target.value] : undefined,
                }))
              }
              className='w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-neuronx-secondary'
            >
              <option value=''>All Reasons</option>
              <option value='approval_required'>Approval Required</option>
              <option value='assisted_execution'>Assisted Execution</option>
              <option value='high_risk_escalation'>High Risk Escalation</option>
              <option value='voice_approval_required'>
                Voice Approval Required
              </option>
              <option value='voice_assisted_execution'>
                Voice Assisted Execution
              </option>
            </select>
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>
              Priority
            </label>
            <select
              value={filters.priority?.[0] || ''}
              onChange={e =>
                setFilters(prev => ({
                  ...prev,
                  priority: e.target.value ? [e.target.value] : undefined,
                }))
              }
              className='w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-neuronx-secondary'
            >
              <option value=''>All Priorities</option>
              <option value='urgent'>Urgent</option>
              <option value='high'>High</option>
              <option value='normal'>Normal</option>
              <option value='low'>Low</option>
            </select>
          </div>

          <div className='flex items-end'>
            <button
              onClick={() => setFilters({ slaUrgent: true })}
              className='w-full btn-warning'
            >
              SLA Urgent Only
            </button>
          </div>

          <div className='flex items-end'>
            <button
              onClick={() => setFilters({})}
              className='w-full btn-secondary'
            >
              Clear Filters
            </button>
          </div>
        </div>
      </Card>

      {/* Urgent Items */}
      {getUrgentItems().length > 0 && (
        <WorkQueueSection
          title='Urgent Items'
          items={getUrgentItems()}
          onAction={handleAction}
          processingItems={processingItems}
          user={user}
        />
      )}

      {/* Normal Priority Items */}
      {getNormalItems().length > 0 && (
        <WorkQueueSection
          title='Normal Priority'
          items={getNormalItems()}
          onAction={handleAction}
          processingItems={processingItems}
          user={user}
        />
      )}

      {/* Low Priority Items */}
      {getLowItems().length > 0 && (
        <WorkQueueSection
          title='Low Priority'
          items={getLowItems()}
          onAction={handleAction}
          processingItems={processingItems}
          user={user}
        />
      )}

      {/* Empty State */}
      {items.length === 0 && (
        <Card>
          <div className='text-center py-12'>
            <div className='text-gray-400 text-6xl mb-4'>📋</div>
            <h3 className='text-lg font-medium text-gray-900 mb-2'>
              No items in queue
            </h3>
            <p className='text-gray-600'>
              All tasks have been processed or there are no pending
              human-required actions.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}

interface WorkQueueSectionProps {
  title: string;
  items: WorkQueueItem[];
  onAction: (
    item: WorkQueueItem,
    action: 'approve' | 'assist' | 'escalate' | 'reject',
    notes?: string
  ) => Promise<void>;
  processingItems: Set<string>;
  user: any;
}

function WorkQueueSection({
  title,
  items,
  onAction,
  processingItems,
  user,
}: WorkQueueSectionProps) {
  return (
    <Card title={`${title} (${items.length})`}>
      <div className='space-y-4'>
        {items.map(item => (
          <WorkQueueItemCard
            key={item.itemId}
            item={item}
            onAction={onAction}
            isProcessing={processingItems.has(item.itemId)}
            user={user}
          />
        ))}
      </div>
    </Card>
  );
}

interface WorkQueueItemCardProps {
  item: WorkQueueItem;
  onAction: (
    item: WorkQueueItem,
    action: 'approve' | 'assist' | 'escalate' | 'reject',
    notes?: string
  ) => Promise<void>;
  isProcessing: boolean;
  user: any;
}

function WorkQueueItemCard({
  item,
  onAction,
  isProcessing,
  user,
}: WorkQueueItemCardProps) {
  const [actionNotes, setActionNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);

  const handleAction = async (
    action: 'approve' | 'assist' | 'escalate' | 'reject'
  ) => {
    if (action !== 'approve' && !actionNotes.trim()) {
      setShowNotes(true);
      return;
    }

    await onAction(item, action, actionNotes);
    setActionNotes('');
    setShowNotes(false);
  };

  const canApprove =
    (item.requiredAction.actionType === 'approve_execution' ||
      item.requiredAction.actionType === 'voice_approve_execution') &&
    (user.role === 'admin' || item.priority !== 'urgent');

  const canAssist =
    item.requiredAction.actionType === 'assist_execution' ||
    item.requiredAction.actionType === 'voice_assist_execution';

  return (
    <div className='border border-gray-200 rounded-lg p-4'>
      <div className='flex items-start justify-between mb-3'>
        <div className='flex-1'>
          <div className='flex items-center space-x-3 mb-2'>
            <Link
              href={`/opportunities/${item.opportunityId}`}
              className='font-medium text-neuronx-secondary hover:underline'
            >
              Opportunity {item.opportunityId}
            </Link>
            <StatusBadge status={item.priority} variant='urgency' />
            <StatusBadge status={item.reason.replace('_', ' ')} />
          </div>

          <div className='text-sm text-gray-600 mb-2'>
            ${item.dealValue.toLocaleString()} • Risk: {item.riskScore}/100 •
            Stage: {item.currentStage}
          </div>

          <div className='text-sm text-gray-900 mb-2'>
            {item.requiredAction.description}
          </div>

          {item.slaRemainingMinutes && item.slaRemainingMinutes < 60 && (
            <div className='text-sm text-red-600 font-medium'>
              SLA: {Math.floor(item.slaRemainingMinutes / 60)}h{' '}
              {item.slaRemainingMinutes % 60}m remaining
            </div>
          )}
        </div>
      </div>

      {showNotes && (
        <div className='mb-3'>
          <textarea
            value={actionNotes}
            onChange={e => setActionNotes(e.target.value)}
            placeholder='Add notes (required for this action)...'
            className='w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-neuronx-secondary'
            rows={3}
          />
        </div>
      )}

      <div className='flex items-center justify-between'>
        <div className='text-xs text-gray-500'>
          Created {new Date(item.createdAt).toLocaleString()}
        </div>

        <div className='flex space-x-2'>
          {canApprove && (
            <button
              onClick={() => handleAction('approve')}
              disabled={isProcessing}
              className='btn-success text-sm px-3 py-1'
            >
              {isProcessing ? 'Processing...' : 'Approve'}
            </button>
          )}

          {canAssist && (
            <button
              onClick={() => handleAction('assist')}
              disabled={isProcessing}
              className='btn-primary text-sm px-3 py-1'
            >
              {isProcessing ? 'Processing...' : 'Assist'}
            </button>
          )}

          <button
            onClick={() => setShowNotes(!showNotes)}
            className='btn-secondary text-sm px-3 py-1'
          >
            Escalate
          </button>
        </div>
      </div>
    </div>
  );
}
