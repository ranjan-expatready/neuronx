import { Metadata } from 'next';
import { AuditLogViewer } from '@/components/audit/audit-log-viewer';
import { AuditFilters } from '@/components/audit/audit-filters';
import { AuditExportControls } from '@/components/audit/audit-export-controls';

export const metadata: Metadata = {
  title: 'Audit Log | NeuronX Trust Portal',
  description:
    'Complete audit trail of all NeuronX system activities and changes',
};

export default function AuditPage() {
  return (
    <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
      <div className='mb-8'>
        <h1 className='text-3xl font-bold text-gray-900'>Audit Log</h1>
        <p className='mt-2 text-lg text-gray-600'>
          Complete, immutable audit trail of all system activities
        </p>
        <div className='mt-4 flex items-center space-x-4 text-sm text-gray-500'>
          <span>🔒 Tamper-proof records</span>
          <span>📊 Real-time monitoring</span>
          <span>📈 Enterprise compliance</span>
          <span>🔍 Advanced filtering</span>
        </div>
      </div>

      <div className='space-y-6'>
        {/* Export Controls */}
        <AuditExportControls />

        {/* Filters */}
        <AuditFilters />

        {/* Audit Log Viewer */}
        <AuditLogViewer />
      </div>
    </div>
  );
}
