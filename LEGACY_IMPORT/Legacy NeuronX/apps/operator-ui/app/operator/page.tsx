/**
 * Operator Console - WI-062: Operator Console
 *
 * Primary UI surface for NeuronX operators.
 * Governed work queue, explainable actions, evidence-linked operations.
 */

'use client';

import { useEffect, useState } from 'react';
import { OperatorConsole } from './components/OperatorConsole';
import { useOperatorGovernance } from './hooks/useOperatorGovernance';

export default function OperatorPage() {
  const { isLoading, hasAccess, error } = useOperatorGovernance();

  if (isLoading) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600'></div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <div className='max-w-md mx-auto bg-white rounded-lg shadow-lg p-8'>
          <div className='text-center'>
            <div className='text-red-500 mb-4'>
              <svg
                className='w-16 h-16 mx-auto'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z'
                />
              </svg>
            </div>
            <h2 className='text-xl font-semibold text-gray-900 mb-2'>
              Access Denied
            </h2>
            <p className='text-gray-600 mb-4'>
              {error ||
                'You do not have access to the Operator Console. This may be due to insufficient permissions or the console being disabled by policy.'}
            </p>
            <p className='text-sm text-gray-500'>
              If you believe this is an error, please contact your administrator
              with reference ID: {Date.now()}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <OperatorConsole />;
}
