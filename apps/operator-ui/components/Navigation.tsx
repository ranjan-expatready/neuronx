/**
 * Navigation Component - WI-032: Operator Control Plane
 *
 * Navigation bar with role-based menu items.
 */

'use client';

import Link from 'next/link';
import { useAuth } from '../lib/auth';

export function Navigation() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <nav className='bg-neuronx-primary text-white shadow-lg'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='flex justify-between h-16 items-center'>
            <div className='text-xl font-bold'>NeuronX Control Plane</div>
            <div className='text-sm'>Loading...</div>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className='bg-neuronx-primary text-white shadow-lg'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <div className='flex justify-between h-16'>
          <div className='flex items-center'>
            <div className='flex-shrink-0'>
              <Link href='/' className='text-xl font-bold hover:text-gray-200'>
                NeuronX Control Plane
              </Link>
            </div>
            <div className='hidden md:block'>
              <div className='ml-10 flex items-baseline space-x-4'>
                <Link
                  href='/'
                  className='hover:bg-gray-700 px-3 py-2 rounded-md text-sm font-medium'
                >
                  Dashboard
                </Link>

                {user && (
                  <>
                    <Link
                      href='/opportunities'
                      className='hover:bg-gray-700 px-3 py-2 rounded-md text-sm font-medium'
                    >
                      Opportunities
                    </Link>

                    {user.role !== 'viewer' && (
                      <Link
                        href='/work-queue'
                        className='hover:bg-gray-700 px-3 py-2 rounded-md text-sm font-medium'
                      >
                        Work Queue
                      </Link>
                    )}

                    <Link
                      href='/experiments'
                      className='hover:bg-gray-700 px-3 py-2 rounded-md text-sm font-medium'
                    >
                      Experiments
                    </Link>

                    <Link
                      href='/system'
                      className='hover:bg-gray-700 px-3 py-2 rounded-md text-sm font-medium'
                    >
                      System
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className='flex items-center space-x-4'>
            {user && (
              <>
                <span className='text-sm'>
                  {user.role.charAt(0).toUpperCase() + user.role.slice(1)}:{' '}
                  {user.username}
                </span>
                <div className='w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center text-sm font-medium'>
                  {user.username.charAt(0).toUpperCase()}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
