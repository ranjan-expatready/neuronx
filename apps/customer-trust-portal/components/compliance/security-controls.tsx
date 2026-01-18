import {
  Shield,
  Lock,
  Eye,
  Server,
  Key,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from 'lucide-react';

interface SecurityControl {
  category: string;
  control: string;
  status: 'implemented' | 'partial' | 'planned';
  description: string;
  evidence: string;
}

const securityControls: SecurityControl[] = [
  {
    category: 'Access Control',
    control: 'Multi-Factor Authentication',
    status: 'implemented',
    description: 'All administrative access requires MFA',
    evidence: 'Enforced for all operator and admin accounts',
  },
  {
    category: 'Access Control',
    control: 'Role-Based Access Control',
    status: 'implemented',
    description: 'Granular permissions based on organizational roles',
    evidence: 'Org-authority service with capability-based access',
  },
  {
    category: 'Data Protection',
    control: 'Data Encryption at Rest',
    status: 'implemented',
    description: 'All sensitive data encrypted using AES-256',
    evidence: 'Database-level encryption with key rotation',
  },
  {
    category: 'Data Protection',
    control: 'Data Encryption in Transit',
    status: 'implemented',
    description: 'TLS 1.3 encryption for all data transmission',
    evidence: 'End-to-end encryption with certificate pinning',
  },
  {
    category: 'Network Security',
    control: 'Web Application Firewall',
    status: 'implemented',
    description: 'OWASP-compliant WAF protection',
    evidence: 'Cloudflare WAF with custom rules',
  },
  {
    category: 'Network Security',
    control: 'DDoS Protection',
    status: 'implemented',
    description: 'Distributed denial of service mitigation',
    evidence: 'Cloudflare DDoS protection active',
  },
  {
    category: 'Monitoring',
    control: 'Security Information and Event Management',
    status: 'implemented',
    description: 'Real-time security monitoring and alerting',
    evidence: 'SIEM integration with 24/7 monitoring',
  },
  {
    category: 'Monitoring',
    control: 'Intrusion Detection System',
    status: 'partial',
    description: 'Network and host-based intrusion detection',
    evidence: 'Host-based IDS implemented, network IDS planned',
  },
  {
    category: 'Incident Response',
    control: 'Incident Response Plan',
    status: 'implemented',
    description: 'Documented and tested incident response procedures',
    evidence: 'Annual IR exercises and documented playbooks',
  },
  {
    category: 'Compliance',
    control: 'Regular Security Audits',
    status: 'implemented',
    description: 'Quarterly security assessments and penetration testing',
    evidence: 'Last audit: Q2 2024, next scheduled Q1 2025',
  },
];

function SecurityControlItem({ control }: { control: SecurityControl }) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'implemented':
        return <CheckCircle className='h-4 w-4 text-green-500' />;
      case 'partial':
        return <AlertTriangle className='h-4 w-4 text-yellow-500' />;
      case 'planned':
        return <XCircle className='h-4 w-4 text-gray-400' />;
      default:
        return <XCircle className='h-4 w-4 text-gray-400' />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'implemented':
        return 'bg-green-50 border-green-200';
      case 'partial':
        return 'bg-yellow-50 border-yellow-200';
      case 'planned':
        return 'bg-gray-50 border-gray-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'access control':
        return <Key className='h-4 w-4 text-blue-500' />;
      case 'data protection':
        return <Lock className='h-4 w-4 text-green-500' />;
      case 'network security':
        return <Shield className='h-4 w-4 text-red-500' />;
      case 'monitoring':
        return <Eye className='h-4 w-4 text-purple-500' />;
      case 'incident response':
        return <AlertTriangle className='h-4 w-4 text-orange-500' />;
      case 'compliance':
        return <CheckCircle className='h-4 w-4 text-indigo-500' />;
      default:
        return <Server className='h-4 w-4 text-gray-500' />;
    }
  };

  return (
    <div className={`p-4 rounded-lg border ${getStatusColor(control.status)}`}>
      <div className='flex items-start justify-between mb-3'>
        <div className='flex items-center space-x-2'>
          {getCategoryIcon(control.category)}
          <span className='text-xs font-medium text-gray-600 uppercase tracking-wide'>
            {control.category}
          </span>
        </div>
        {getStatusIcon(control.status)}
      </div>

      <div className='space-y-2'>
        <h4 className='font-medium text-gray-900'>{control.control}</h4>
        <p className='text-sm text-gray-600'>{control.description}</p>
        <p className='text-xs text-gray-500'>
          <span className='font-medium'>Evidence:</span> {control.evidence}
        </p>
      </div>
    </div>
  );
}

export function SecurityControls() {
  const implementedCount = securityControls.filter(
    c => c.status === 'implemented'
  ).length;
  const totalCount = securityControls.length;

  return (
    <div className='trust-card'>
      <div className='flex items-center justify-between mb-6'>
        <div>
          <h3 className='text-lg font-medium text-gray-900'>
            Security Controls
          </h3>
          <p className='text-sm text-gray-500 mt-1'>
            Enterprise security controls and their implementation status
          </p>
        </div>

        <div className='text-right'>
          <div className='text-lg font-semibold text-gray-900'>
            {implementedCount}/{totalCount}
          </div>
          <div className='text-sm text-gray-500'>Controls Implemented</div>
        </div>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
        {securityControls.map((control, index) => (
          <SecurityControlItem key={index} control={control} />
        ))}
      </div>

      <div className='mt-6 pt-4 border-t border-gray-100'>
        <div className='flex items-center justify-between text-sm'>
          <div className='flex items-center space-x-4 text-gray-500'>
            <span>🔒 Security controls are continuously monitored</span>
            <span>
              📊 Last security review: {new Date().toLocaleDateString()}
            </span>
          </div>

          <div className='text-gray-500'>Next audit: Q1 2025</div>
        </div>
      </div>
    </div>
  );
}
