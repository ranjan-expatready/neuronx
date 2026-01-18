import { Award, Calendar, CheckCircle, Clock } from 'lucide-react';

interface Certification {
  name: string;
  issuer: string;
  status: 'active' | 'pending' | 'expired';
  validUntil: string;
  lastAudit: string;
  scope: string;
  description: string;
}

const certifications: Certification[] = [
  {
    name: 'SOC 2 Type II',
    issuer: 'AICPA',
    status: 'active',
    validUntil: '2026-12-31',
    lastAudit: '2024-06-15',
    scope: 'Trust Services Criteria',
    description:
      'Security, availability, processing integrity, confidentiality, and privacy controls',
  },
  {
    name: 'ISO 27001',
    issuer: 'ISO',
    status: 'active',
    validUntil: '2025-08-20',
    lastAudit: '2024-02-10',
    scope: 'Information Security Management',
    description: 'Comprehensive information security management system',
  },
  {
    name: 'GDPR Compliance',
    issuer: 'European Commission',
    status: 'active',
    validUntil: '2027-01-01',
    lastAudit: '2024-05-25',
    scope: 'Data Protection',
    description:
      'General Data Protection Regulation compliance for EU data subjects',
  },
  {
    name: 'HIPAA Compliance',
    issuer: 'HHS',
    status: 'pending',
    validUntil: '2025-03-15',
    lastAudit: '2024-09-01',
    scope: 'Healthcare Data',
    description:
      'Health Insurance Portability and Accountability Act compliance',
  },
];

function CertificationCard({ cert }: { cert: Certification }) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'expired':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className='h-4 w-4' />;
      case 'pending':
        return <Clock className='h-4 w-4' />;
      case 'expired':
        return <Calendar className='h-4 w-4' />;
      default:
        return <Award className='h-4 w-4' />;
    }
  };

  return (
    <div className='trust-card'>
      <div className='flex items-start justify-between mb-4'>
        <div className='flex-1'>
          <div className='flex items-center space-x-3'>
            <Award className='h-6 w-6 text-trust-600' />
            <div>
              <h3 className='text-lg font-semibold text-gray-900'>
                {cert.name}
              </h3>
              <p className='text-sm text-gray-600'>Issued by {cert.issuer}</p>
            </div>
          </div>
        </div>

        <div
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(cert.status)}`}
        >
          {getStatusIcon(cert.status)}
          <span className='ml-1 capitalize'>{cert.status}</span>
        </div>
      </div>

      <div className='space-y-3'>
        <div>
          <p className='text-sm font-medium text-gray-700 mb-1'>Scope</p>
          <p className='text-sm text-gray-600'>{cert.scope}</p>
        </div>

        <div>
          <p className='text-sm font-medium text-gray-700 mb-1'>Description</p>
          <p className='text-sm text-gray-600'>{cert.description}</p>
        </div>

        <div className='grid grid-cols-2 gap-4 pt-3 border-t border-gray-100'>
          <div>
            <p className='text-xs text-gray-500'>Valid Until</p>
            <p className='text-sm font-medium text-gray-900'>
              {new Date(cert.validUntil).toLocaleDateString()}
            </p>
          </div>

          <div>
            <p className='text-xs text-gray-500'>Last Audit</p>
            <p className='text-sm font-medium text-gray-900'>
              {new Date(cert.lastAudit).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ComplianceCertifications() {
  return (
    <div className='trust-card'>
      <div className='flex items-center justify-between mb-6'>
        <div>
          <h3 className='text-lg font-medium text-gray-900'>
            Compliance Certifications
          </h3>
          <p className='text-sm text-gray-500 mt-1'>
            Current compliance certifications and regulatory adherence status
          </p>
        </div>

        <div className='flex items-center space-x-2'>
          <div className='w-2 h-2 bg-green-400 rounded-full'></div>
          <span className='text-xs text-gray-500'>Up to date</span>
        </div>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
        {certifications.map(cert => (
          <CertificationCard key={cert.name} cert={cert} />
        ))}
      </div>

      <div className='mt-6 pt-4 border-t border-gray-100'>
        <div className='flex items-center justify-between text-sm text-gray-500'>
          <span>Certifications are regularly audited and renewed</span>
          <span>📋 Next audit: Q1 2025</span>
        </div>
      </div>
    </div>
  );
}
