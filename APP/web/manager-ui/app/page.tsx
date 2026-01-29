import { RequireSurfaceAccess } from '../lib/auth';
import { ManagerConsole } from '../app/manager/components/ManagerConsole';

export default function ManagerPage() {
  return (
    <RequireSurfaceAccess
      surface='MANAGER'
      fallback={
        <div className='min-h-screen flex items-center justify-center'>
          <div className='text-center'>
            <h1 className='text-2xl font-bold text-gray-900 mb-4'>
              Access Denied
            </h1>
            <p className='text-gray-600'>
              You do not have permission to access the Manager Console.
            </p>
          </div>
        </div>
      }
    >
      <ManagerConsole />
    </RequireSurfaceAccess>
  );
}
