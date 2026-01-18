import { Metadata } from 'next';
import { ComplianceStatusOverview } from '@/components/compliance/compliance-status-overview';
import { ComplianceCertifications } from '@/components/compliance/compliance-certifications';
import { SecurityControls } from '@/components/compliance/security-controls';
import { DataRetentionPolicy } from '@/components/compliance/data-retention-policy';

export const metadata: Metadata = {
  title: 'Compliance | NeuronX Trust Portal',
  description:
    'Enterprise compliance status, certifications, and regulatory adherence',
};

export default function CompliancePage() {
  return (
    <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
      <div className='mb-8'>
        <h1 className='text-3xl font-bold text-gray-900'>Compliance Center</h1>
        <p className='mt-2 text-lg text-gray-600'>
          Enterprise compliance monitoring, certifications, and regulatory
          adherence
        </p>
        <div className='mt-4 flex items-center space-x-4 text-sm text-gray-500'>
          <span>🏛️ SOC 2 Type II Certified</span>
          <span>🔒 GDPR Compliant</span>
          <span>🛡️ ISO 27001 Aligned</span>
          <span>📊 Real-time Monitoring</span>
        </div>
      </div>

      <div className='space-y-8'>
        {/* Compliance Status Overview */}
        <ComplianceStatusOverview />

        {/* Certifications */}
        <ComplianceCertifications />

        {/* Security Controls */}
        <SecurityControls />

        {/* Data Retention Policy */}
        <DataRetentionPolicy />
      </div>
    </div>
  );
}
