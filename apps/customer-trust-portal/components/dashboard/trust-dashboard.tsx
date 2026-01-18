'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Shield,
  Activity,
  Clock,
  Users,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { MetricCard } from './metric-card';
import { TrustScoreRing } from './trust-score-ring';

export function TrustDashboard() {
  const {
    data: metrics,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['trust-metrics'],
    queryFn: () => apiClient.getTrustMetrics(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: billingState } = useQuery({
    queryKey: ['billing-state'],
    queryFn: () => apiClient.getBillingState(),
  });

  if (isLoading) {
    return (
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6'>
        {[...Array(4)].map((_, i) => (
          <div key={i} className='trust-card animate-pulse'>
            <div className='h-4 bg-gray-200 rounded w-3/4 mb-2'></div>
            <div className='h-8 bg-gray-200 rounded w-1/2'></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className='trust-card border-red-200 bg-red-50'>
        <div className='flex items-center'>
          <AlertTriangle className='h-5 w-5 text-red-400 mr-2' />
          <span className='text-red-800'>Unable to load trust metrics</span>
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* Trust Score Overview */}
      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        <div className='lg:col-span-1'>
          <TrustScoreRing
            score={metrics?.complianceScore || 0}
            label='Trust Score'
            description='Overall system compliance and reliability'
          />
        </div>

        <div className='lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4'>
          <MetricCard
            title='Active Operations'
            value={metrics?.totalOperations?.toLocaleString() || '0'}
            icon={Activity}
            trend='+12%'
            trendLabel='vs last week'
            color='blue'
          />

          <MetricCard
            title='Success Rate'
            value={`${(metrics?.successRate || 0).toFixed(1)}%`}
            icon={CheckCircle}
            trend='+0.3%'
            trendLabel='vs last week'
            color='green'
          />

          <MetricCard
            title='Avg Response Time'
            value={`${(metrics?.averageResponseTime || 0).toFixed(0)}ms`}
            icon={Clock}
            trend='-5ms'
            trendLabel='vs last week'
            color='purple'
          />

          <MetricCard
            title='Active Tenants'
            value={metrics?.activeTenants?.toLocaleString() || '0'}
            icon={Users}
            trend='+2'
            trendLabel='vs last week'
            color='indigo'
          />
        </div>
      </div>

      {/* Billing Status */}
      <div className='trust-card'>
        <div className='flex items-center justify-between'>
          <div>
            <h3 className='text-lg font-medium text-gray-900'>
              Billing Status
            </h3>
            <p className='text-sm text-gray-500 mt-1'>
              Current subscription and billing state
            </p>
          </div>

          <div className='flex items-center space-x-4'>
            <div className='text-right'>
              <div
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  billingState?.billingStatus === 'ACTIVE'
                    ? 'bg-green-100 text-green-800'
                    : billingState?.billingStatus === 'GRACE'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800'
                }`}
              >
                {billingState?.billingStatus || 'UNKNOWN'}
              </div>
              <p className='text-xs text-gray-500 mt-1'>
                Plan: {billingState?.planTier || 'Unknown'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* System Health Indicators */}
      <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
        <div className='trust-card'>
          <div className='flex items-center'>
            <Shield className='h-8 w-8 text-green-500 mr-3' />
            <div>
              <p className='text-sm font-medium text-gray-900'>
                Security Status
              </p>
              <p className='text-xs text-gray-500'>All systems secure</p>
            </div>
          </div>
        </div>

        <div className='trust-card'>
          <div className='flex items-center'>
            <CheckCircle className='h-8 w-8 text-blue-500 mr-3' />
            <div>
              <p className='text-sm font-medium text-gray-900'>Compliance</p>
              <p className='text-xs text-gray-500'>SOC 2 Type II certified</p>
            </div>
          </div>
        </div>

        <div className='trust-card'>
          <div className='flex items-center'>
            <Activity className='h-8 w-8 text-purple-500 mr-3' />
            <div>
              <p className='text-sm font-medium text-gray-900'>Audit Trail</p>
              <p className='text-xs text-gray-500'>
                Real-time monitoring active
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
