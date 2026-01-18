import { RequireExecutiveAccess } from '../lib/auth';
import { ExecutiveDashboard } from '../app/executive/components/ExecutiveDashboard';

export default function ExecutivePage() {
  return (
    <RequireExecutiveAccess
      fallback={
        <div className='min-h-screen flex items-center justify-center'>
          <div className='text-center'>
            <div className='w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4'>
              <svg
                className='w-8 h-8 text-red-600'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z'
                />
              </svg>
            </div>
            <h1 className='text-2xl font-bold text-gray-900 mb-4'>
              Access Restricted
            </h1>
            <p className='text-gray-600 max-w-md'>
              The Executive Dashboard requires EXECUTIVE role access. This
              surface provides high-level business confidence indicators for
              strategic decision making.
            </p>
          </div>
        </div>
      }
    >
      <ExecutiveDashboard />
    </RequireExecutiveAccess>
  );
}
