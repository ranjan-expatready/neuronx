import { Metadata } from 'next';
import { TrustDashboard } from '@/components/dashboard/trust-dashboard';
import { AuditActivityFeed } from '@/components/audit/audit-activity-feed';
import { ComplianceStatusOverview } from '@/components/compliance/compliance-status-overview';

export const metadata: Metadata = {
  title: 'Trust Dashboard | NeuronX',
  description:
    'Real-time trust metrics and audit activity for NeuronX operations',
};

export default function DashboardPage() {
  return (
    <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
      <div className='mb-8'>
        <h1 className='text-3xl font-bold text-gray-900'>
          NeuronX Trust Portal
        </h1>
        <p className='mt-2 text-lg text-gray-600'>
          Transparent audit and compliance dashboard for enterprise operations
        </p>
      </div>

      <div className='space-y-8'>
        {/* Trust Metrics Overview */}
        <TrustDashboard />

        {/* Compliance Status */}
        <ComplianceStatusOverview />

        {/* Recent Audit Activity */}
        <AuditActivityFeed />
      </div>
    </div>
  );
}
