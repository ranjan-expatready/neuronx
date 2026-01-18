/**
 * Manager Console - WI-063: Manager Console – Team Intelligence & Coaching Surface
 *
 * Main interface for managers to understand team performance and coaching opportunities.
 * Read-only intelligence surface - no execution capabilities.
 */

'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../../lib/auth';
import { scorecardApi, generateCorrelationId } from '../../../lib/api-client';
import { TeamScorecardTable } from './TeamScorecardTable';
import { RepDrilldownDrawer } from './RepDrilldownDrawer';
import {
  TeamScorecard,
  RepPerformance,
  ScorecardResponse,
} from '../../../lib/types';
import { Badge, StatusBadge } from '@neuronx/ui-design-system';

interface TeamMetric {
  key: string;
  label: string;
  value: number;
  unit: string;
  band: 'GREEN' | 'YELLOW' | 'RED';
  evidence: {
    source: string;
    recordCount: number;
    policyVersion: string;
  };
}

/**
 * Manager Console Component
 * Displays team intelligence and coaching insights
 */
export function ManagerConsole() {
  const { user, hasSurfaceAccess } = useAuth();
  const [teamScorecard, setTeamScorecard] = useState<TeamScorecard | null>(
    null
  );
  const [repPerformances, setRepPerformances] = useState<RepPerformance[]>([]);
  const [selectedRep, setSelectedRep] = useState<RepPerformance | null>(null);
  const [isDrilldownOpen, setIsDrilldownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mock rep performance data - in production, this would come from API
  const mockRepPerformances: RepPerformance[] = [
    {
      repId: 'rep_001',
      repName: 'Alice Johnson',
      teamId: user?.teamId || 'sales-team-alpha',
      overallBand: 'GREEN',
      lastActivity: '2026-01-06T14:30:00Z',
      correlationId: 'mock_correlation_1',
      metrics: [
        {
          key: 'lead_to_contact_rate',
          label: 'Lead→Contact Rate',
          value: 87.5,
          unit: 'percentage',
          band: 'GREEN',
          evidence: { source: 'fsm', recordCount: 40, policyVersion: '1.0.0' },
        },
        {
          key: 'sla_breach_rate',
          label: 'SLA Breach Rate',
          value: 1.2,
          unit: 'percentage',
          band: 'GREEN',
          evidence: { source: 'fsm', recordCount: 83, policyVersion: '1.0.0' },
        },
        {
          key: 'blocked_actions_count',
          label: 'Blocked Actions',
          value: 0,
          unit: 'count',
          band: 'GREEN',
          evidence: {
            source: 'audit_log',
            recordCount: 0,
            policyVersion: '1.0.0',
          },
        },
      ],
    },
    {
      repId: 'rep_002',
      repName: 'Bob Smith',
      teamId: user?.teamId || 'sales-team-alpha',
      overallBand: 'YELLOW',
      lastActivity: '2026-01-06T13:15:00Z',
      correlationId: 'mock_correlation_2',
      metrics: [
        {
          key: 'lead_to_contact_rate',
          label: 'Lead→Contact Rate',
          value: 72.3,
          unit: 'percentage',
          band: 'YELLOW',
          evidence: { source: 'fsm', recordCount: 31, policyVersion: '1.0.0' },
        },
        {
          key: 'sla_breach_rate',
          label: 'SLA Breach Rate',
          value: 4.8,
          unit: 'percentage',
          band: 'YELLOW',
          evidence: { source: 'fsm', recordCount: 62, policyVersion: '1.0.0' },
        },
        {
          key: 'blocked_actions_count',
          label: 'Blocked Actions',
          value: 2,
          unit: 'count',
          band: 'YELLOW',
          evidence: {
            source: 'audit_log',
            recordCount: 2,
            policyVersion: '1.0.0',
          },
        },
      ],
    },
    {
      repId: 'rep_003',
      repName: 'Carol Davis',
      teamId: user?.teamId || 'sales-team-alpha',
      overallBand: 'RED',
      lastActivity: '2026-01-06T11:45:00Z',
      correlationId: 'mock_correlation_3',
      metrics: [
        {
          key: 'lead_to_contact_rate',
          label: 'Lead→Contact Rate',
          value: 45.6,
          unit: 'percentage',
          band: 'RED',
          evidence: { source: 'fsm', recordCount: 18, policyVersion: '1.0.0' },
        },
        {
          key: 'sla_breach_rate',
          label: 'SLA Breach Rate',
          value: 12.3,
          unit: 'percentage',
          band: 'RED',
          evidence: { source: 'fsm', recordCount: 41, policyVersion: '1.0.0' },
        },
        {
          key: 'blocked_actions_count',
          label: 'Blocked Actions',
          value: 5,
          unit: 'count',
          band: 'RED',
          evidence: {
            source: 'audit_log',
            recordCount: 5,
            policyVersion: '1.0.0',
          },
        },
      ],
    },
  ];

  useEffect(() => {
    const loadTeamData = async () => {
      if (!user?.teamId) return;

      const correlationId = generateCorrelationId();

      try {
        setIsLoading(true);
        setError(null);

        // Fetch team scorecard
        const scorecardResult = await scorecardApi.getScorecard(
          'uat-tenant-001', // Mock tenant ID
          hasSurfaceAccess('EXECUTIVE') ? 'EXECUTIVE' : 'MANAGER',
          '7d',
          {
            teamId: user.teamId,
            correlationId,
            includeDetails: true,
          }
        );

        if (scorecardResult.success && scorecardResult.data) {
          // Transform API response to TeamScorecard
          const scorecardData = scorecardResult.data;
          const teamScorecard: TeamScorecard = {
            teamId: user.teamId,
            teamName: `Team ${user.teamId}`,
            metrics: scorecardData.sections.flatMap(section =>
              section.metrics.map(metric => ({
                key: metric.key,
                label: metric.label,
                value: metric.value,
                unit: metric.unit,
                band: metric.band,
                evidence: metric.evidence,
              }))
            ),
            overallBand: scorecardData.overallBand,
            generatedAt: new Date().toISOString(),
            correlationId: scorecardData.correlationId,
          };

          setTeamScorecard(teamScorecard);
        } else {
          // Use mock data if API fails
          console.warn('Using mock team scorecard data');
          const mockTeamScorecard: TeamScorecard = {
            teamId: user.teamId,
            teamName: `Team ${user.teamId}`,
            metrics: [
              {
                key: 'team_lead_to_contact_rate',
                label: 'Team Lead→Contact Rate',
                value: 68.5,
                unit: 'percentage',
                band: 'YELLOW',
                evidence: {
                  source: 'fsm',
                  recordCount: 89,
                  policyVersion: '1.0.0',
                },
              },
              {
                key: 'team_sla_breach_rate',
                label: 'Team SLA Breach Rate',
                value: 6.1,
                unit: 'percentage',
                band: 'YELLOW',
                evidence: {
                  source: 'fsm',
                  recordCount: 134,
                  policyVersion: '1.0.0',
                },
              },
              {
                key: 'team_governance_violations',
                label: 'Team Governance Violations',
                value: 7,
                unit: 'count',
                band: 'YELLOW',
                evidence: {
                  source: 'audit_log',
                  recordCount: 7,
                  policyVersion: '1.0.0',
                },
              },
            ],
            overallBand: 'YELLOW',
            generatedAt: new Date().toISOString(),
            correlationId,
          };

          setTeamScorecard(mockTeamScorecard);
        }

        // Set mock rep performance data
        setRepPerformances(mockRepPerformances);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load team data'
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadTeamData();
  }, [user?.teamId, hasSurfaceAccess]);

  const handleRepClick = (rep: RepPerformance) => {
    setSelectedRep(rep);
    setIsDrilldownOpen(true);
  };

  const handleCloseDrilldown = () => {
    setIsDrilldownOpen(false);
    setSelectedRep(null);
  };

  if (isLoading) {
    return (
      <div className='space-y-6'>
        <div className='animate-pulse'>
          <div className='h-8 bg-gray-200 rounded w-64 mb-4'></div>
          <div className='grid grid-cols-1 md:grid-cols-3 gap-4 mb-8'>
            {[1, 2, 3].map(i => (
              <div key={i} className='h-24 bg-gray-200 rounded'></div>
            ))}
          </div>
          <div className='h-96 bg-gray-200 rounded'></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='text-center py-12'>
        <div className='text-red-600 mb-4'>Error loading team data</div>
        <p className='text-gray-600'>{error}</p>
        <button
          onClick={() => window.location.reload()}
          className='mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700'
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className='space-y-8'>
      {/* Page Header */}
      <div>
        <h1 className='text-3xl font-bold text-gray-900'>
          Team Intelligence Dashboard
        </h1>
        <p className='text-gray-600 mt-2'>
          Understand team performance and identify coaching opportunities
        </p>
      </div>

      {/* Team Scorecard Summary */}
      {teamScorecard && (
        <div
          className='bg-white rounded-lg shadow-sm border border-gray-200 p-6'
          data-testid='team-scorecard'
        >
          <div className='flex items-center justify-between mb-6'>
            <div className='flex items-center space-x-4'>
              <h2 className='text-xl font-semibold text-gray-900'>
                {teamScorecard.teamName} Performance
              </h2>
              <div className='flex items-center space-x-3'>
                <Badge variant='info' size='sm'>
                  Source: NeuronX + GHL Snapshot
                </Badge>
                <Badge variant='warning' size='sm'>
                  Alignment: UNKNOWN (insufficient evidence)
                </Badge>
              </div>
            </div>
            <StatusBadge status={teamScorecard.overallBand}>
              {teamScorecard.overallBand} Performance
            </StatusBadge>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
            {teamScorecard.metrics.map(metric => (
              <div key={metric.key} className='metric-card'>
                <div className='metric-value'>
                  {metric.value}
                  {metric.unit}
                </div>
                <div className='metric-label'>{metric.label}</div>
                <div
                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-2 ${
                    metric.band === 'GREEN'
                      ? 'bg-green-100 text-green-800'
                      : metric.band === 'YELLOW'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                  }`}
                >
                  {metric.band}
                </div>
              </div>
            ))}
          </div>

          {/* Correlation ID for debugging */}
          {process.env.NODE_ENV === 'development' && (
            <div className='mt-4 text-xs text-gray-400'>
              Correlation ID: {teamScorecard.correlationId}
            </div>
          )}
        </div>
      )}

      {/* Rep Performance Table */}
      <div className='bg-white rounded-lg shadow-sm border border-gray-200'>
        <div className='px-6 py-4 border-b border-gray-200'>
          <h2 className='text-xl font-semibold text-gray-900'>
            Rep Performance Overview
          </h2>
          <p className='text-gray-600 mt-1'>
            Individual performance metrics and coaching signals
          </p>
        </div>

        <TeamScorecardTable
          repPerformances={repPerformances}
          onRepClick={handleRepClick}
        />
      </div>

      {/* Rep Drilldown Drawer */}
      <RepDrilldownDrawer
        isOpen={isDrilldownOpen}
        onClose={handleCloseDrilldown}
        rep={selectedRep}
        tenantId='uat-tenant-001'
      />
    </div>
  );
}
