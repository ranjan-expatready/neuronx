/**
 * UAT Banner - WI-066: UAT Harness + Seed + Safety
 *
 * Displays UAT environment status and provides golden run controls.
 * Only visible in UAT environment.
 */

'use client';

import { useState, useEffect } from 'react';
import { uatApi, generateCorrelationId } from '../../../lib/api-client';
import { Button } from '@neuronx/ui-design-system';

interface UatStatus {
  environment: string;
  mode: string;
  killSwitch: boolean;
  allowedTenants: string[];
  providerAllowlists: {
    sms: string[];
    email: string[];
    calendar: string[];
    ghl: string[];
  };
}

interface UatBannerProps {
  tenantId?: string;
  correlationId?: string;
}

export function UatBanner({ tenantId, correlationId }: UatBannerProps) {
  const [uatStatus, setUatStatus] = useState<UatStatus | null>(null);
  const [isRunningGoldenRun, setIsRunningGoldenRun] = useState(false);
  const [goldenRunResult, setGoldenRunResult] = useState<any>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // Load UAT status on mount
  useEffect(() => {
    fetchUatStatus();
  }, []);

  const fetchUatStatus = async () => {
    try {
      const result = await uatApi.getStatus(tenantId);
      if (result.success) {
        setUatStatus(result.data);
      } else {
        console.error('Failed to fetch UAT status:', result.error);
      }
    } catch (error) {
      console.error('Failed to fetch UAT status:', error);
    }
  };

  const runGoldenRun = async () => {
    if (!uatStatus || uatStatus.environment !== 'uat') return;

    setIsRunningGoldenRun(true);
    setGoldenRunResult(null);

    try {
      const result = await uatApi.triggerGoldenRun(
        tenantId || 'uat-tenant-001',
        correlationId || generateCorrelationId()
      );

      if (result.success) {
        setGoldenRunResult(result.data);
      } else {
        setGoldenRunResult({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      console.error('Golden run failed:', error);
      setGoldenRunResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsRunningGoldenRun(false);
    }
  };

  // Don't render if not in UAT environment
  if (!uatStatus || uatStatus.environment !== 'uat') {
    return null;
  }

  const getModeColor = (mode: string) => {
    switch (mode) {
      case 'dry_run':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'live_uat':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getKillSwitchColor = (active: boolean) => {
    return active
      ? 'bg-green-100 text-green-800 border-green-200'
      : 'bg-red-100 text-red-800 border-red-200';
  };

  return (
    <div
      className='bg-yellow-50 border-b border-yellow-200 px-4 py-3'
      data-testid='uat-banner'
    >
      <div className='flex items-center justify-between'>
        <div className='flex items-center space-x-4'>
          {/* UAT Environment Indicator */}
          <div className='flex items-center space-x-2'>
            <span className='text-sm font-medium text-yellow-800'>
              🧪 UAT ENVIRONMENT
            </span>
            <span
              className={`px-2 py-1 text-xs font-medium rounded border ${getModeColor(uatStatus.mode)}`}
              data-testid='uat-mode'
            >
              {uatStatus.mode.toUpperCase()}
            </span>
            <span
              className={`px-2 py-1 text-xs font-medium rounded border ${getKillSwitchColor(uatStatus.killSwitch)}`}
              data-testid='uat-kill-switch'
            >
              KILL SWITCH: {uatStatus.killSwitch ? 'ACTIVE' : 'DISABLED'}
            </span>
          </div>

          {/* Tenant & Correlation IDs */}
          <div className='flex items-center space-x-2 text-sm text-yellow-700'>
            <span>
              Tenant:{' '}
              <code className='bg-yellow-100 px-1 rounded'>
                {tenantId || 'unknown'}
              </code>
            </span>
            <span>
              Correlation:{' '}
              <code className='bg-yellow-100 px-1 rounded'>
                {correlationId || 'none'}
              </code>
            </span>
          </div>
        </div>

        <div className='flex items-center space-x-2'>
          {/* Golden Run Button */}
          <Button
            onClick={runGoldenRun}
            disabled={isRunningGoldenRun}
            size='sm'
            className='bg-yellow-600 hover:bg-yellow-700 text-white'
          >
            {isRunningGoldenRun ? '🏃 Running...' : '🏆 Run Golden Run'}
          </Button>

          {/* Expand/Collapse Details */}
          <Button
            onClick={() => setIsExpanded(!isExpanded)}
            variant='ghost'
            size='sm'
            className='text-yellow-700 hover:bg-yellow-100'
          >
            {isExpanded ? '▲' : '▼'} Details
          </Button>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className='mt-3 pt-3 border-t border-yellow-200'>
          <div className='grid grid-cols-2 gap-4 text-sm'>
            <div>
              <h4 className='font-medium text-yellow-800 mb-2'>
                Environment Status
              </h4>
              <div className='space-y-1 text-yellow-700'>
                <div>
                  Environment:{' '}
                  <span className='font-mono'>{uatStatus.environment}</span>
                </div>
                <div>
                  Mode: <span className='font-mono'>{uatStatus.mode}</span>
                </div>
                <div>
                  Kill Switch:{' '}
                  <span className='font-mono'>
                    {uatStatus.killSwitch ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </div>
                <div>
                  Allowed Tenants:{' '}
                  <span className='font-mono'>
                    {uatStatus.allowedTenants.length}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h4 className='font-medium text-yellow-800 mb-2'>
                Provider Allowlists
              </h4>
              <div className='space-y-1 text-yellow-700'>
                <div>
                  SMS:{' '}
                  <span className='font-mono'>
                    {uatStatus.providerAllowlists.sms.length} numbers
                  </span>
                </div>
                <div>
                  Email:{' '}
                  <span className='font-mono'>
                    {uatStatus.providerAllowlists.email.length} domains
                  </span>
                </div>
                <div>
                  Calendar:{' '}
                  <span className='font-mono'>
                    {uatStatus.providerAllowlists.calendar.length} IDs
                  </span>
                </div>
                <div>
                  GHL:{' '}
                  <span className='font-mono'>
                    {uatStatus.providerAllowlists.ghl.length} locations
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Golden Run Results */}
          {goldenRunResult && (
            <div className='mt-3 pt-3 border-t border-yellow-200'>
              <h4 className='font-medium text-yellow-800 mb-2'>
                Golden Run Result
              </h4>
              <div
                className={`p-3 rounded text-sm ${
                  goldenRunResult.success
                    ? 'bg-green-50 text-green-800 border border-green-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                <div className='font-medium'>
                  {goldenRunResult.success ? '✅ Success' : '❌ Failed'}
                  {goldenRunResult.duration &&
                    ` (${goldenRunResult.duration}ms)`}
                </div>
                {goldenRunResult.error && (
                  <div className='mt-1 text-red-700'>
                    {goldenRunResult.error}
                  </div>
                )}
                {goldenRunResult.phases && (
                  <div className='mt-2 grid grid-cols-4 gap-2 text-xs'>
                    {Object.entries(goldenRunResult.phases).map(
                      ([phase, data]: [string, any]) => (
                        <div key={phase} className='text-center'>
                          <div className='font-medium capitalize'>{phase}</div>
                          <div className='text-green-600'>
                            {data?.status ||
                              data?.outcome ||
                              data?.commandCount ||
                              data?.eventCount ||
                              '✓'}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
