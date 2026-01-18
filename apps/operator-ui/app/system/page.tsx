/**
 * System Health & Safety - WI-032: Operator Control Plane
 *
 * Read-only system status and safety monitoring dashboard.
 */

'use client';

import { useState, useEffect } from 'react';
import { systemApi } from '../../../lib/api-client';
import { SystemHealth, ComponentStatus, SystemAlert } from '../../../lib/types';
import {
  Card,
  StatusBadge,
  LoadingSpinner,
  ErrorMessage,
} from '../../../components/ui';

export default function SystemPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadHealth = async () => {
      try {
        setLoading(true);
        const response = await systemApi.getHealth();

        if (response.success && response.data) {
          setHealth(response.data);
        } else {
          setError(response.error || 'Failed to load system health');
        }
      } catch (err) {
        setError('Network error loading system health');
      } finally {
        setLoading(false);
      }
    };

    loadHealth();

    // Refresh every 30 seconds
    const interval = setInterval(loadHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const acknowledgeAlert = async (alertId: string) => {
    try {
      const response = await systemApi.acknowledgeAlert(alertId);
      if (response.success) {
        // Refresh health data
        const healthResponse = await systemApi.getHealth();
        if (healthResponse.success && healthResponse.data) {
          setHealth(healthResponse.data);
        }
      }
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    }
  };

  if (loading) {
    return (
      <div className='flex justify-center py-8'>
        <LoadingSpinner size='lg' />
      </div>
    );
  }

  if (error || !health) {
    return (
      <ErrorMessage
        title='Error Loading System Health'
        message={error || 'No health data available'}
      />
    );
  }

  const criticalAlerts = health.alerts.filter(a => a.severity === 'critical');
  const warningAlerts = health.alerts.filter(a => a.severity === 'warning');
  const unacknowledgedAlerts = health.alerts.filter(a => !a.acknowledged);

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>
            System Health & Safety
          </h1>
          <p className='text-gray-600'>
            NeuronX operational status and safety monitoring
          </p>
        </div>
        <div className='flex items-center space-x-4'>
          <div className='text-sm text-gray-600'>
            Last updated: {new Date(health.timestamp).toLocaleString()}
          </div>
          <button
            onClick={() => window.location.reload()}
            className='btn-secondary'
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
        <Card>
          <div className='text-center'>
            <div className='text-2xl font-bold text-blue-600'>
              {health.metrics.opportunitiesProcessed.toLocaleString()}
            </div>
            <div className='text-sm text-gray-600'>Opportunities Processed</div>
          </div>
        </Card>

        <Card>
          <div className='text-center'>
            <div className='text-2xl font-bold text-green-600'>
              {health.metrics.decisionsMade.toLocaleString()}
            </div>
            <div className='text-sm text-gray-600'>Decisions Made</div>
          </div>
        </Card>

        <Card>
          <div className='text-center'>
            <div className='text-2xl font-bold text-purple-600'>
              {health.metrics.actionsExecuted.toLocaleString()}
            </div>
            <div className='text-sm text-gray-600'>Actions Executed</div>
          </div>
        </Card>

        <Card>
          <div className='text-center'>
            <div
              className={`text-2xl font-bold ${health.metrics.safetyIncidents > 0 ? 'text-red-600' : 'text-green-600'}`}
            >
              {health.metrics.safetyIncidents}
            </div>
            <div className='text-sm text-gray-600'>Safety Incidents</div>
          </div>
        </Card>
      </div>

      {/* Component Status */}
      <Card title='Component Status'>
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
          <ComponentStatusCard
            name='Stage Gate'
            status={health.components.stageGate}
          />
          <ComponentStatusCard
            name='Playbook Engine'
            status={health.components.playbookEngine}
          />
          <ComponentStatusCard
            name='Decision Engine'
            status={health.components.decisionEngine}
          />
          <ComponentStatusCard
            name='Experiment System'
            status={health.components.experimentSystem}
          />
        </div>
      </Card>

      {/* Enforcement Status */}
      <Card title='Enforcement Status'>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
          <div>
            <h3 className='text-lg font-medium text-gray-900 mb-3'>
              Stage Gate
            </h3>
            <StatusBadge
              status={health.enforcement.stageGateMode.replace('_', ' ')}
            />
            <p className='text-sm text-gray-600 mt-1'>
              {health.enforcement.stageGateMode === 'monitor_only' &&
                'Logging violations without blocking'}
              {health.enforcement.stageGateMode === 'block' &&
                'Blocking invalid stage transitions'}
              {health.enforcement.stageGateMode === 'block_and_revert' &&
                'Blocking and reverting invalid changes'}
            </p>
          </div>

          <div>
            <h3 className='text-lg font-medium text-gray-900 mb-3'>
              Playbook Engine
            </h3>
            <StatusBadge
              status={
                health.enforcement.playbookEnforcement ? 'Active' : 'Inactive'
              }
            />
            <p className='text-sm text-gray-600 mt-1'>
              {health.enforcement.playbookEnforcement
                ? 'Enforcing playbook compliance'
                : 'Playbook enforcement disabled'}
            </p>
          </div>
        </div>

        <div className='mt-6'>
          <h3 className='text-lg font-medium text-gray-900 mb-3'>
            Safety Features
          </h3>
          <div className='flex flex-wrap gap-2'>
            <StatusBadge
              status={
                health.enforcement.voiceSafetyEnabled
                  ? 'Voice Safety: ON'
                  : 'Voice Safety: OFF'
              }
            />
            <StatusBadge
              status={
                health.enforcement.decisionBlocking
                  ? 'Decision Blocking: ON'
                  : 'Decision Blocking: OFF'
              }
            />
          </div>
        </div>
      </Card>

      {/* Alerts */}
      {unacknowledgedAlerts.length > 0 && (
        <Card title={`Active Alerts (${unacknowledgedAlerts.length})`}>
          <div className='space-y-3'>
            {unacknowledgedAlerts.map(alert => (
              <AlertCard
                key={alert.alertId}
                alert={alert}
                onAcknowledge={() => acknowledgeAlert(alert.alertId)}
              />
            ))}
          </div>
        </Card>
      )}

      {/* Recent Alerts History */}
      {health.alerts.length > unacknowledgedAlerts.length && (
        <Card title='Recent Alerts History'>
          <div className='space-y-3'>
            {health.alerts
              .filter(a => a.acknowledged)
              .slice(0, 10)
              .map(alert => (
                <AlertCard key={alert.alertId} alert={alert} showAcknowledged />
              ))}
          </div>
        </Card>
      )}

      {/* Performance Metrics */}
      <Card title='Performance Metrics'>
        <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
          <div className='text-center'>
            <div className='text-2xl font-bold text-blue-600'>
              {(health.metrics.averageResponseTime * 1000).toFixed(0)}ms
            </div>
            <div className='text-sm text-gray-600'>Average Response Time</div>
          </div>

          <div className='text-center'>
            <div className='text-2xl font-bold text-green-600'>
              {(health.metrics.dataCompleteness * 100).toFixed(1)}%
            </div>
            <div className='text-sm text-gray-600'>Data Completeness</div>
          </div>

          <div className='text-center'>
            <div className='text-2xl font-bold text-purple-600'>
              {health.enforcement.decisionBlocking ? 'ENFORCED' : 'MONITOR'}
            </div>
            <div className='text-sm text-gray-600'>Decision Authority</div>
          </div>
        </div>
      </Card>

      {/* System Status Summary */}
      <Card title='System Status Summary'>
        <div className='prose max-w-none'>
          <p>
            <strong>NeuronX Status:</strong> All core systems operational.
            Decision authority is{' '}
            {health.enforcement.decisionBlocking
              ? 'enforced'
              : 'in monitor mode'}
            . Stage transitions are{' '}
            {health.enforcement.stageGateMode.replace('_', ' ')}.
            {health.enforcement.voiceSafetyEnabled
              ? ' Voice safety is active.'
              : ' Voice safety is disabled.'}
          </p>

          {criticalAlerts.length > 0 && (
            <p className='text-red-700'>
              <strong>Critical Issues:</strong> {criticalAlerts.length} critical
              alert(s) require immediate attention.
            </p>
          )}

          {warningAlerts.length > 0 && (
            <p className='text-yellow-700'>
              <strong>Warnings:</strong> {warningAlerts.length} warning(s)
              should be reviewed.
            </p>
          )}

          {health.metrics.safetyIncidents > 0 && (
            <p className='text-orange-700'>
              <strong>Safety:</strong> {health.metrics.safetyIncidents} safety
              incident(s) recorded in the last 24 hours.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}

interface ComponentStatusCardProps {
  name: string;
  status: ComponentStatus;
}

function ComponentStatusCard({ name, status }: ComponentStatusCardProps) {
  return (
    <div className='text-center p-4 border border-gray-200 rounded-lg'>
      <div className='text-lg font-medium text-gray-900 mb-2'>{name}</div>
      <StatusBadge status={status.status} />
      <div className='text-sm text-gray-600 mt-2'>{status.message}</div>
      <div className='text-xs text-gray-500 mt-1'>
        Checked: {new Date(status.lastChecked).toLocaleTimeString()}
      </div>
    </div>
  );
}

interface AlertCardProps {
  alert: SystemAlert;
  onAcknowledge?: () => void;
  showAcknowledged?: boolean;
}

function AlertCard({ alert, onAcknowledge, showAcknowledged }: AlertCardProps) {
  return (
    <div
      className={`border rounded-lg p-4 ${
        alert.severity === 'critical'
          ? 'border-red-200 bg-red-50'
          : alert.severity === 'warning'
            ? 'border-yellow-200 bg-yellow-50'
            : alert.severity === 'medium'
              ? 'border-orange-200 bg-orange-50'
              : 'border-blue-200 bg-blue-50'
      }`}
    >
      <div className='flex items-start justify-between'>
        <div className='flex-1'>
          <div className='flex items-center space-x-2 mb-1'>
            <StatusBadge status={alert.category} />
            <StatusBadge status={alert.severity} variant='urgency' />
            {alert.acknowledged && showAcknowledged && (
              <span className='text-xs text-gray-500'>(Acknowledged)</span>
            )}
          </div>
          <h4 className='font-medium text-gray-900'>{alert.title}</h4>
          <p className='text-sm text-gray-700 mt-1'>{alert.description}</p>
          <div className='text-xs text-gray-500 mt-2'>
            {new Date(alert.timestamp).toLocaleString()}
          </div>
        </div>

        {!alert.acknowledged && onAcknowledge && (
          <button onClick={onAcknowledge} className='btn-secondary text-xs'>
            Acknowledge
          </button>
        )}
      </div>
    </div>
  );
}
