/**
 * Navigation - WI-063: Manager Console – Team Intelligence & Coaching Surface
 *
 * Navigation bar with surface access control and user context.
 */

'use client';

import { useAuth } from '../lib/auth';

export function Navigation() {
  const { user, loading, hasSurfaceAccess } = useAuth();

  if (loading) {
    return (
      <nav className='bg-white shadow-sm border-b border-gray-200'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='flex justify-between h-16'>
            <div className='flex items-center'>
              <div className='animate-pulse bg-gray-200 h-8 w-32 rounded'></div>
            </div>
            <div className='flex items-center'>
              <div className='animate-pulse bg-gray-200 h-8 w-20 rounded'></div>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className='bg-white shadow-sm border-b border-gray-200'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <div className='flex justify-between h-16'>
          <div className='flex items-center'>
            <h1 className='text-xl font-semibold text-gray-900'>
              NeuronX Manager Console
            </h1>
            <div className='ml-4 flex items-center space-x-4'>
              {hasSurfaceAccess('EXECUTIVE') && (
                <span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800'>
                  Executive Access
                </span>
              )}
              {hasSurfaceAccess('MANAGER') &&
                !hasSurfaceAccess('EXECUTIVE') && (
                  <span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800'>
                    Manager Access
                  </span>
                )}
            </div>
          </div>

          <div className='flex items-center space-x-4'>
            {user && (
              <div className='flex items-center space-x-2'>
                <span className='text-sm text-gray-600'>{user.username}</span>
                <span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 capitalize'>
                  {user.role}
                </span>
                {user.teamId && (
                  <span className='text-xs text-gray-500'>
                    Team: {user.teamId}
                  </span>
                )}
              </div>
            )}

            {/* Environment indicator */}
            <div className='text-xs text-gray-500'>
              {process.env.NODE_ENV === 'development'
                ? 'Development'
                : 'Production'}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
