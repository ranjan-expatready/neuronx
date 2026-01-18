'use client';

import { useState } from 'react';
import { Calendar, Filter, X } from 'lucide-react';

export function AuditFilters() {
  const [dateRange, setDateRange] = useState({
    start: '',
    end: '',
  });
  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  const [selectedResources, setSelectedResources] = useState<string[]>([]);

  const availableActions = [
    'billing_sync_completed',
    'execution_planned',
    'execution_completed',
    'user_login',
    'config_changed',
    'data_export',
    'security_alert',
  ];

  const availableResources = [
    'billing_entitlement',
    'opportunity',
    'execution_plan',
    'user_session',
    'system_config',
    'audit_log',
  ];

  const toggleAction = (action: string) => {
    setSelectedActions(prev =>
      prev.includes(action) ? prev.filter(a => a !== action) : [...prev, action]
    );
  };

  const toggleResource = (resource: string) => {
    setSelectedResources(prev =>
      prev.includes(resource)
        ? prev.filter(r => r !== resource)
        : [...prev, resource]
    );
  };

  const clearFilters = () => {
    setDateRange({ start: '', end: '' });
    setSelectedActions([]);
    setSelectedResources([]);
  };

  const hasActiveFilters =
    dateRange.start ||
    dateRange.end ||
    selectedActions.length > 0 ||
    selectedResources.length > 0;

  return (
    <div className='trust-card'>
      <div className='flex items-center justify-between mb-4'>
        <div className='flex items-center space-x-2'>
          <Filter className='h-5 w-5 text-gray-400' />
          <h3 className='text-lg font-medium text-gray-900'>Audit Filters</h3>
        </div>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className='inline-flex items-center px-2 py-1 text-sm text-gray-500 hover:text-gray-700'
          >
            <X className='h-4 w-4 mr-1' />
            Clear all
          </button>
        )}
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
        {/* Date Range */}
        <div>
          <label className='block text-sm font-medium text-gray-700 mb-1'>
            Start Date
          </label>
          <div className='relative'>
            <Calendar className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400' />
            <input
              type='date'
              value={dateRange.start}
              onChange={e =>
                setDateRange(prev => ({ ...prev, start: e.target.value }))
              }
              className='w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-trust-500 focus:border-trust-500 text-sm'
            />
          </div>
        </div>

        <div>
          <label className='block text-sm font-medium text-gray-700 mb-1'>
            End Date
          </label>
          <div className='relative'>
            <Calendar className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400' />
            <input
              type='date'
              value={dateRange.end}
              onChange={e =>
                setDateRange(prev => ({ ...prev, end: e.target.value }))
              }
              className='w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-trust-500 focus:border-trust-500 text-sm'
            />
          </div>
        </div>

        {/* Action Types */}
        <div>
          <label className='block text-sm font-medium text-gray-700 mb-2'>
            Action Types ({selectedActions.length})
          </label>
          <div className='space-y-1 max-h-32 overflow-y-auto'>
            {availableActions.map(action => (
              <label key={action} className='flex items-center text-sm'>
                <input
                  type='checkbox'
                  checked={selectedActions.includes(action)}
                  onChange={() => toggleAction(action)}
                  className='h-4 w-4 text-trust-600 focus:ring-trust-500 border-gray-300 rounded'
                />
                <span className='ml-2 text-gray-700 capitalize'>
                  {action.replace(/_/g, ' ')}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Resource Types */}
        <div>
          <label className='block text-sm font-medium text-gray-700 mb-2'>
            Resource Types ({selectedResources.length})
          </label>
          <div className='space-y-1 max-h-32 overflow-y-auto'>
            {availableResources.map(resource => (
              <label key={resource} className='flex items-center text-sm'>
                <input
                  type='checkbox'
                  checked={selectedResources.includes(resource)}
                  onChange={() => toggleResource(resource)}
                  className='h-4 w-4 text-trust-600 focus:ring-trust-500 border-gray-300 rounded'
                />
                <span className='ml-2 text-gray-700 capitalize'>
                  {resource.replace(/_/g, ' ')}
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {hasActiveFilters && (
        <div className='mt-4 pt-4 border-t border-gray-100'>
          <div className='flex flex-wrap gap-2'>
            {dateRange.start && (
              <span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-trust-100 text-trust-800'>
                From: {dateRange.start}
              </span>
            )}
            {dateRange.end && (
              <span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-trust-100 text-trust-800'>
                To: {dateRange.end}
              </span>
            )}
            {selectedActions.map(action => (
              <span
                key={action}
                className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800'
              >
                {action.replace(/_/g, ' ')}
              </span>
            ))}
            {selectedResources.map(resource => (
              <span
                key={resource}
                className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800'
              >
                {resource.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
