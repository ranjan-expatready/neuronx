import { Clock, Archive, Trash2, Shield, FileText } from 'lucide-react';

interface RetentionPolicy {
  dataType: string;
  retentionPeriod: string;
  storageLocation: string;
  encryption: string;
  accessControls: string;
  disposalMethod: string;
}

const retentionPolicies: RetentionPolicy[] = [
  {
    dataType: 'Audit Logs',
    retentionPeriod: '7 years',
    storageLocation: 'Encrypted cloud storage with geo-redundancy',
    encryption: 'AES-256 at rest, TLS 1.3 in transit',
    accessControls: 'Read-only, role-based access, audit logging',
    disposalMethod: 'Secure deletion with cryptographic erasure',
  },
  {
    dataType: 'Execution Records',
    retentionPeriod: '5 years',
    storageLocation: 'Encrypted database with automated backups',
    encryption: 'AES-256 at rest, TLS 1.3 in transit',
    accessControls: 'Org-scoped access, audit logging',
    disposalMethod: 'Automated archival and secure deletion',
  },
  {
    dataType: 'Billing Data',
    retentionPeriod: '7 years',
    storageLocation: 'PCI-compliant encrypted storage',
    encryption: 'AES-256 with key rotation',
    accessControls: 'Finance team only, audit logging',
    disposalMethod: 'Secure deletion compliant with tax regulations',
  },
  {
    dataType: 'User Session Data',
    retentionPeriod: '1 year',
    storageLocation: 'Encrypted cache with automatic expiration',
    encryption: 'AES-256 at rest',
    accessControls: 'System access only for debugging',
    disposalMethod: 'Automatic expiration and secure deletion',
  },
  {
    dataType: 'API Logs',
    retentionPeriod: '2 years',
    storageLocation: 'Compressed encrypted logs',
    encryption: 'AES-256 at rest',
    accessControls: 'DevOps team, audit logging',
    disposalMethod: 'Automated compression and secure deletion',
  },
  {
    dataType: 'Backup Data',
    retentionPeriod: '30 days active, 1 year archival',
    storageLocation: 'Encrypted offsite storage',
    encryption: 'AES-256 with key rotation',
    accessControls: 'Backup administrators only',
    disposalMethod: 'Secure deletion after retention period',
  },
];

function RetentionPolicyCard({ policy }: { policy: RetentionPolicy }) {
  return (
    <div className='trust-card'>
      <div className='flex items-start justify-between mb-4'>
        <div className='flex items-center space-x-3'>
          <Archive className='h-5 w-5 text-trust-600' />
          <h3 className='text-lg font-semibold text-gray-900'>
            {policy.dataType}
          </h3>
        </div>

        <div className='text-right'>
          <div className='text-sm font-medium text-gray-900'>
            {policy.retentionPeriod}
          </div>
          <div className='text-xs text-gray-500'>Retention Period</div>
        </div>
      </div>

      <div className='space-y-3'>
        <div>
          <div className='flex items-center space-x-2 mb-1'>
            <Shield className='h-4 w-4 text-gray-400' />
            <span className='text-sm font-medium text-gray-700'>
              Storage & Security
            </span>
          </div>
          <p className='text-sm text-gray-600 pl-6'>{policy.storageLocation}</p>
          <p className='text-sm text-gray-600 pl-6'>{policy.encryption}</p>
        </div>

        <div>
          <div className='flex items-center space-x-2 mb-1'>
            <FileText className='h-4 w-4 text-gray-400' />
            <span className='text-sm font-medium text-gray-700'>
              Access Controls
            </span>
          </div>
          <p className='text-sm text-gray-600 pl-6'>{policy.accessControls}</p>
        </div>

        <div>
          <div className='flex items-center space-x-2 mb-1'>
            <Trash2 className='h-4 w-4 text-gray-400' />
            <span className='text-sm font-medium text-gray-700'>
              Disposal Method
            </span>
          </div>
          <p className='text-sm text-gray-600 pl-6'>{policy.disposalMethod}</p>
        </div>
      </div>
    </div>
  );
}

export function DataRetentionPolicy() {
  return (
    <div className='trust-card'>
      <div className='flex items-center justify-between mb-6'>
        <div>
          <h3 className='text-lg font-medium text-gray-900'>
            Data Retention Policy
          </h3>
          <p className='text-sm text-gray-500 mt-1'>
            How long different types of data are retained and how they're
            securely managed
          </p>
        </div>

        <div className='flex items-center space-x-2'>
          <Clock className='h-5 w-5 text-blue-500' />
          <span className='text-sm text-gray-600'>Regulatory Compliant</span>
        </div>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
        {retentionPolicies.map(policy => (
          <RetentionPolicyCard key={policy.dataType} policy={policy} />
        ))}
      </div>

      <div className='mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md'>
        <div className='flex items-start'>
          <Shield className='h-5 w-5 text-blue-400 mt-0.5 mr-3 flex-shrink-0' />
          <div>
            <h4 className='text-sm font-medium text-blue-800 mb-1'>
              Data Privacy & Compliance
            </h4>
            <p className='text-sm text-blue-700'>
              All data retention practices comply with GDPR, CCPA, and industry
              regulations. Data subjects can request deletion, and all disposal
              methods ensure complete data destruction.
            </p>
          </div>
        </div>
      </div>

      <div className='mt-4 pt-4 border-t border-gray-100'>
        <div className='flex items-center justify-between text-sm text-gray-500'>
          <span>📋 Retention policies are reviewed annually</span>
          <span>Last review: {new Date().toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
}
