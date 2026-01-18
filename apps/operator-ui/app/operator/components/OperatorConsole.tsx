/**
 * Operator Console - WI-062: Operator Console
 *
 * Main operator interface with work queue, detail panel, and governed actions.
 */

'use client';

import { useState, useEffect } from 'react';
import { WorkQueuePanel } from './WorkQueuePanel';
import { DetailPanel } from './DetailPanel';
import { ActionBar } from './ActionBar';
import { ReadinessBanner } from './ReadinessBanner';
import { UatBanner } from './UatBanner';
import { ScorecardStrip } from './ScorecardStrip';
import { ScorecardDrilldownDrawer } from './ScorecardDrilldownDrawer';
import { useOperatorData } from '../hooks/useOperatorData';
import { useOperatorGovernance } from '../hooks/useOperatorGovernance';

export interface WorkQueueItem {
  id: string;
  opportunityId: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  reason: string;
  assignedTo?: string;
  createdAt: string;
  slaDeadline?: string;
  context: {
    dealValue?: number;
    riskScore?: number;
    lastActivity?: string;
    contactName?: string;
    companyName?: string;
    currentState?: string;
    nextAction?: string;
  };
}

export interface SelectedItem extends WorkQueueItem {
  // Extended with additional detail data
  explanation?: any;
  readinessStatus?: any;
  allowedActions?: string[];
}

/**
 * Main Operator Console component
 * Layout: Work Queue (left) + Detail Panel (right) + Action Bar (bottom)
 */
export function OperatorConsole() {
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<any | null>(null);
  const [isDrilldownOpen, setIsDrilldownOpen] = useState(false);
  const { enforcementMode } = useOperatorGovernance();
  const { workQueue, readiness, isLoading, error, refreshData } =
    useOperatorData();

  const handleItemSelect = (item: WorkQueueItem) => {
    // Load additional details for the selected item
    setSelectedItem(item as SelectedItem);
  };

  const handleActionComplete = () => {
    // Refresh data after action completion
    refreshData();
    setSelectedItem(null);
  };

  const handleMetricClick = (metric: any) => {
    setSelectedMetric(metric);
    setIsDrilldownOpen(true);
  };

  const handleCloseDrilldown = () => {
    setIsDrilldownOpen(false);
    setSelectedMetric(null);
  };

  return (
    <div className='h-screen flex flex-col bg-gray-50'>
      {/* UAT Banner - Top (only visible in UAT) */}
      <UatBanner
        tenantId='uat-tenant-001' // TODO: Get from auth context
        correlationId={`op_console_${Date.now()}`}
      />

      {/* Scorecard Strip - Intelligence Overview */}
      <ScorecardStrip
        tenantId='uat-tenant-001' // TODO: Get from auth context
        onMetricClick={handleMetricClick}
      />

      {/* Readiness Banner - Top */}
      <ReadinessBanner
        readiness={readiness}
        enforcementMode={enforcementMode}
        onRefresh={refreshData}
      />

      {/* Main Content Area */}
      <div className='flex-1 flex overflow-hidden'>
        {/* Work Queue Panel - Left */}
        <div className='w-1/2 border-r border-gray-200'>
          <WorkQueuePanel
            items={workQueue}
            selectedItemId={selectedItem?.id}
            onItemSelect={handleItemSelect}
            isLoading={isLoading}
            error={error}
          />
        </div>

        {/* Detail Panel - Right */}
        <div className='w-1/2 flex flex-col'>
          <DetailPanel
            item={selectedItem}
            onActionComplete={handleActionComplete}
          />

          {/* Action Bar - Bottom of right panel */}
          {selectedItem && (
            <ActionBar
              item={selectedItem}
              onActionComplete={handleActionComplete}
            />
          )}
        </div>
      </div>

      {/* Scorecard Drilldown Drawer */}
      <ScorecardDrilldownDrawer
        isOpen={isDrilldownOpen}
        onClose={handleCloseDrilldown}
        tenantId='uat-tenant-001' // TODO: Get from auth context
        metric={selectedMetric}
      />
    </div>
  );
}
