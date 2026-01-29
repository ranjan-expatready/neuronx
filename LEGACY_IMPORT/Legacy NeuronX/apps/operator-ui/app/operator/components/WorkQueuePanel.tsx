/**
 * Work Queue Panel - WI-062: Operator Console
 *
 * Left panel showing actionable work queue items with filtering and search.
 */

import { useState } from 'react';
import { SearchIcon, FilterIcon } from '@heroicons/react/outline';
import { WorkQueueItem } from './OperatorConsole';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  Badge,
  StatusBadge,
} from '@neuronx/ui-design-system';

interface WorkQueuePanelProps {
  items: WorkQueueItem[];
  selectedItemId?: string;
  onItemSelect: (item: WorkQueueItem) => void;
  isLoading: boolean;
  error: string | null;
}

export function WorkQueuePanel({
  items,
  selectedItemId,
  onItemSelect,
  isLoading,
  error,
}: WorkQueuePanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterState, setFilterState] = useState<string>('all');
  const [filterRisk, setFilterRisk] = useState<string>('all');

  // Filter and search items
  const filteredItems = items.filter(item => {
    const matchesSearch =
      !searchTerm ||
      item.context.contactName
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      item.context.companyName
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      item.opportunityId.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesState =
      filterState === 'all' || item.context.currentState === filterState;
    const matchesRisk =
      filterRisk === 'all' || item.context.riskScore?.toString() === filterRisk;

    return matchesSearch && matchesState && matchesRisk;
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'normal':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'low':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRiskBadge = (riskScore?: number) => {
    if (!riskScore) return null;

    if (riskScore >= 0.8)
      return { label: 'HIGH', color: 'bg-red-100 text-red-800' };
    if (riskScore >= 0.6)
      return { label: 'MEDIUM', color: 'bg-yellow-100 text-yellow-800' };
    return { label: 'LOW', color: 'bg-green-100 text-green-800' };
  };

  const getSlaStatus = (item: WorkQueueItem) => {
    if (!item.slaDeadline) return null;

    const deadline = new Date(item.slaDeadline);
    const now = new Date();
    const hoursUntilDeadline =
      (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilDeadline < 0)
      return { status: 'BREACHED', color: 'bg-red-500' };
    if (hoursUntilDeadline < 2)
      return { status: 'AT RISK', color: 'bg-orange-500' };
    return { status: 'ON TRACK', color: 'bg-green-500' };
  };

  if (error) {
    return (
      <div className='p-6'>
        <div className='bg-red-50 border border-red-200 rounded-md p-4'>
          <div className='text-red-800'>
            <h3 className='font-medium'>Failed to load work queue</h3>
            <p className='text-sm mt-1'>{error}</p>
          </div>
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
            <h2 className='text-lg font-medium text-gray-900'>Work Queue</h2>
            <p className='text-sm text-gray-600 mt-1'>
              {filteredItems.length} actionable items
            </p>
          </div>
          <div className='flex items-center space-x-3'>
            <Badge variant='info' size='sm'>
              Source: GHL Snapshot
            </Badge>
            <div className='text-xs text-gray-500'>
              Last synced: {new Date().toLocaleTimeString()}{' '}
              {/* TODO: Use actual snapshot timestamp */}
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className='p-4 border-b border-gray-200 space-y-3'>
        {/* Search */}
        <div className='relative'>
          <SearchIcon className='h-4 w-4 absolute left-3 top-3 text-gray-400' />
          <input
            type='text'
            placeholder='Search by name, company, or ID...'
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className='w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500'
          />
        </div>

        {/* Filter Controls */}
        <div className='flex space-x-2'>
          <select
            value={filterState}
            onChange={e => setFilterState(e.target.value)}
            className='flex-1 text-sm border border-gray-300 rounded-md px-3 py-1 focus:ring-blue-500 focus:border-blue-500'
          >
            <option value='all'>All States</option>
            <option value='lead_new'>New Lead</option>
            <option value='lead_contacted'>Contacted</option>
            <option value='opportunity_discovery'>Discovery</option>
            <option value='opportunity_qualification'>Qualification</option>
          </select>

          <select
            value={filterRisk}
            onChange={e => setFilterRisk(e.target.value)}
            className='flex-1 text-sm border border-gray-300 rounded-md px-3 py-1 focus:ring-blue-500 focus:border-blue-500'
          >
            <option value='all'>All Risks</option>
            <option value='0.8'>High Risk</option>
            <option value='0.6'>Medium Risk</option>
            <option value='0.3'>Low Risk</option>
          </select>
        </div>
      </div>

      {/* Work Queue Items */}
      <div className='flex-1 overflow-y-auto'>
        {isLoading ? (
          <div className='p-6 space-y-3'>
            {[...Array(5)].map((_, i) => (
              <div key={i} className='animate-pulse'>
                <div className='h-24 bg-gray-200 rounded-md'></div>
              </div>
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className='p-6 text-center text-gray-500'>
            <p>No actionable items match your filters.</p>
          </div>
        ) : (
          <div className='divide-y divide-gray-200'>
            {filteredItems.map(item => {
              const slaStatus = getSlaStatus(item);
              const riskBadge = getRiskBadge(item.context.riskScore);

              return (
                <div
                  key={item.id}
                  onClick={() => onItemSelect(item)}
                  className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                    selectedItemId === item.id
                      ? 'bg-blue-50 border-r-2 border-blue-500'
                      : ''
                  }`}
                  data-testid='work-queue-item'
                >
                  <div className='flex items-start justify-between'>
                    <div className='flex-1 min-w-0'>
                      {/* Contact/Company Name */}
                      <div className='flex items-center space-x-2'>
                        <h3 className='text-sm font-medium text-gray-900 truncate'>
                          {item.context.contactName || 'Unknown Contact'}
                        </h3>
                        {item.context.companyName && (
                          <span className='text-sm text-gray-500'>
                            at {item.context.companyName}
                          </span>
                        )}
                      </div>

                      {/* FSM State and Next Action */}
                      <div className='mt-1 flex items-center space-x-2'>
                        <span className='text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded'>
                          {item.context.currentState || 'Unknown State'}
                        </span>
                        {item.context.nextAction && (
                          <span className='text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded'>
                            → {item.context.nextAction}
                          </span>
                        )}
                      </div>

                      {/* Priority and Risk Badges */}
                      <div className='mt-2 flex items-center space-x-2'>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getPriorityColor(item.priority)}`}
                        >
                          {item.priority.toUpperCase()}
                        </span>

                        {riskBadge && (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${riskBadge.color}`}
                          >
                            {riskBadge.label} RISK
                          </span>
                        )}

                        {slaStatus && (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white ${slaStatus.color}`}
                          >
                            {slaStatus.status}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Deal Value */}
                    {item.context.dealValue && (
                      <div className='text-right'>
                        <div className='text-sm font-medium text-gray-900'>
                          ${item.context.dealValue.toLocaleString()}
                        </div>
                        <div className='text-xs text-gray-500'>potential</div>
                      </div>
                    )}
                  </div>

                  {/* Last Activity */}
                  <div className='mt-2 text-xs text-gray-500'>
                    Last activity:{' '}
                    {item.context.lastActivity
                      ? new Date(item.context.lastActivity).toLocaleString()
                      : 'Unknown'}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
