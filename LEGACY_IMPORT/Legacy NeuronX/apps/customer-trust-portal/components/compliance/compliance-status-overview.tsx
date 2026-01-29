'use client';

import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  FileText,
  Shield,
  Lock,
  Eye,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { formatDistanceToNow } from 'date-fns';

interface ComplianceCategoryProps {
  name: string;
  score: number;
  status: 'PASS' | 'WARN' | 'FAIL';
  lastChecked: string;
}

function ComplianceCategory({
  name,
  score,
  status,
  lastChecked,
}: ComplianceCategoryProps) {
  const getStatusIcon = () => {
    switch (status) {
      case 'PASS':
        return <CheckCircle className='h-5 w-5 text-green-500' />;
      case 'WARN':
        return <AlertTriangle className='h-5 w-5 text-yellow-500' />;
      case 'FAIL':
        return <XCircle className='h-5 w-5 text-red-500' />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'PASS':
        return 'bg-green-50 border-green-200';
      case 'WARN':
        return 'bg-yellow-50 border-yellow-200';
      case 'FAIL':
        return 'bg-red-50 border-red-200';
    }
  };

  const getCategoryIcon = () => {
    switch (name.toLowerCase()) {
      case 'security':
        return <Shield className='h-4 w-4 text-gray-400' />;
      case 'data privacy':
        return <Lock className='h-4 w-4 text-gray-400' />;
      case 'audit':
        return <Eye className='h-4 w-4 text-gray-400' />;
      case 'regulatory':
        return <FileText className='h-4 w-4 text-gray-400' />;
      default:
        return <CheckCircle className='h-4 w-4 text-gray-400' />;
    }
  };

  return (
    <div className={`p-4 rounded-lg border ${getStatusColor()}`}>
      <div className='flex items-center justify-between mb-3'>
        <div className='flex items-center space-x-2'>
          {getCategoryIcon()}
          <h4 className='text-sm font-medium text-gray-900'>{name}</h4>
        </div>
        {getStatusIcon()}
      </div>

      <div className='space-y-2'>
        <div className='flex items-center justify-between'>
          <span className='text-sm text-gray-600'>Score</span>
          <span className='text-sm font-medium text-gray-900'>{score}/100</span>
        </div>

        <div className='w-full bg-gray-200 rounded-full h-2'>
          <div
            className={`h-2 rounded-full ${
              status === 'PASS'
                ? 'bg-green-500'
                : status === 'WARN'
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
            }`}
            style={{ width: `${score}%` }}
          />
        </div>

        <div className='flex items-center text-xs text-gray-500'>
          <Clock className='h-3 w-3 mr-1' />
          Checked{' '}
          {formatDistanceToNow(new Date(lastChecked), { addSuffix: true })}
        </div>
      </div>
    </div>
  );
}

export function ComplianceStatusOverview() {
  const {
    data: compliance,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['compliance-status'],
    queryFn: () => apiClient.getComplianceStatus(),
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  if (isLoading) {
    return (
      <div className='trust-card'>
        <div className='animate-pulse'>
          <div className='h-6 bg-gray-200 rounded w-1/4 mb-4'></div>
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
            {[...Array(4)].map((_, i) => (
              <div key={i} className='h-24 bg-gray-200 rounded'></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='trust-card border-red-200 bg-red-50'>
        <div className='flex items-center'>
          <AlertTriangle className='h-5 w-5 text-red-400 mr-2' />
          <span className='text-red-800'>Unable to load compliance status</span>
        </div>
      </div>
    );
  }

  const overallScore = compliance?.overallScore || 0;
  const categories = compliance?.categories || [];

  return (
    <div className='trust-card'>
      <div className='flex items-center justify-between mb-6'>
        <div>
          <h3 className='text-lg font-medium text-gray-900'>
            Compliance Status
          </h3>
          <p className='text-sm text-gray-500 mt-1'>
            Enterprise compliance monitoring and certification status
          </p>
        </div>

        <div className='text-right'>
          <div className='text-3xl font-bold text-gray-900'>{overallScore}</div>
          <div className='text-sm text-gray-500'>Overall Score</div>
          <div
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-1 ${
              overallScore >= 90
                ? 'bg-green-100 text-green-800'
                : overallScore >= 70
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-red-100 text-red-800'
            }`}
          >
            {overallScore >= 90
              ? 'Compliant'
              : overallScore >= 70
                ? 'Needs Attention'
                : 'Non-Compliant'}
          </div>
        </div>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
        {categories.map(category => (
          <ComplianceCategory
            key={category.name}
            name={category.name}
            score={category.score}
            status={category.status}
            lastChecked={category.lastChecked}
          />
        ))}
      </div>

      <div className='mt-6 pt-4 border-t border-gray-100'>
        <div className='flex items-center justify-between text-sm'>
          <div className='flex items-center space-x-4'>
            <div className='flex items-center space-x-2'>
              <CheckCircle className='h-4 w-4 text-green-500' />
              <span className='text-gray-600'>
                {categories.filter(c => c.status === 'PASS').length} Passing
              </span>
            </div>

            <div className='flex items-center space-x-2'>
              <AlertTriangle className='h-4 w-4 text-yellow-500' />
              <span className='text-gray-600'>
                {categories.filter(c => c.status === 'WARN').length} Warnings
              </span>
            </div>

            <div className='flex items-center space-x-2'>
              <XCircle className='h-4 w-4 text-red-500' />
              <span className='text-gray-600'>
                {categories.filter(c => c.status === 'FAIL').length} Failures
              </span>
            </div>
          </div>

          <div className='text-gray-500'>
            Last updated: {new Date().toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}
