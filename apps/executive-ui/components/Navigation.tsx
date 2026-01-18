/**
 * Navigation - WI-064: Executive Dashboard – Business Confidence Surface
 *
 * Clean, executive-focused navigation with confidence indicators.
 */

'use client';

import { useAuth } from '../lib/auth';

export function Navigation() {
  const { user, loading, isExecutive } = useAuth();

  if (loading) {
    return (
      <nav className='bg-white bg-opacity-90 backdrop-blur-sm shadow-sm border-b border-gray-200'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='flex justify-between h-16'>
            <div className='flex items-center'>
              <div className='animate-pulse bg-gray-200 h-8 w-48 rounded'></div>
            </div>
            <div className='flex items-center'>
              <div className='animate-pulse bg-gray-200 h-8 w-24 rounded'></div>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className='bg-white bg-opacity-90 backdrop-blur-sm shadow-sm border-b border-gray-200'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <div className='flex justify-between h-16'>
          <div className='flex items-center'>
            <div className='flex items-center space-x-3'>
              <div className='w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center'>
                <span className='text-white font-bold text-sm'>NX</span>
              </div>
              <div>
                <h1 className='text-xl font-bold text-gray-900'>
                  Executive Dashboard
                </h1>
                <p className='text-xs text-gray-600'>
                  Business Confidence Surface
                </p>
              </div>
            </div>
          </div>

          <div className='flex items-center space-x-4'>
            {user && (
              <div className='flex items-center space-x-3'>
                <div className='text-right'>
                  <div className='text-sm font-medium text-gray-900'>
                    {user.username}
                  </div>
                  <div className='text-xs text-gray-500 capitalize'>
                    {user.role}
                  </div>
                </div>
                <div className='w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center'>
                  <span className='text-white font-semibold text-sm'>
                    {user.username.charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>
            )}

            {/* Environment indicator */}
            <div className='px-3 py-1 bg-gray-100 rounded-full'>
              <div className='text-xs text-gray-600'>
                {process.env.NODE_ENV === 'development'
                  ? 'Development'
                  : 'Production'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
