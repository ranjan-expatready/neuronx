'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import { routingApi } from '../../lib/api-client';

export default function RoutingPage() {
  const { user, isAdmin, isOperator, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // New region form state
  const [newRegion, setNewRegion] = useState('');
  const [newTeam, setNewTeam] = useState('');

  useEffect(() => {
    if (authLoading) return;
    
    // Redirect if not authorized
    if (!isAdmin && !isOperator) {
      router.push('/');
      return;
    }

    loadConfig();
  }, [authLoading, isAdmin, isOperator, router]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      // Use a default tenant ID for MVP/stub if not in user session
      const tenantId = 'default-tenant'; 
      const response = await routingApi.getPolicy(tenantId);
      
      if (response.success && response.data) {
        setConfig(response.data);
      } else {
        setError(response.error || 'Failed to load configuration');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);
      
      const tenantId = 'default-tenant';
      const response = await routingApi.updatePolicy(config, tenantId);
      
      if (response.success) {
        setSuccessMessage('Configuration saved successfully');
        setConfig(response.data);
      } else {
        setError(response.error || 'Failed to save configuration');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handleAddRegion = () => {
    if (!newRegion || !newTeam) return;
    
    setConfig((prev: any) => ({
      ...prev,
      geographicPreferences: {
        ...prev.geographicPreferences,
        [newRegion]: [newTeam], // Currently supporting single team per region for MVP simplicity
      },
    }));
    
    setNewRegion('');
    setNewTeam('');
  };

  const handleRemoveRegion = (region: string) => {
    setConfig((prev: any) => {
      const newPreferences = { ...prev.geographicPreferences };
      delete newPreferences[region];
      return {
        ...prev,
        geographicPreferences: newPreferences,
      };
    });
  };

  const handleTeamChange = (region: string, team: string) => {
    setConfig((prev: any) => ({
      ...prev,
      geographicPreferences: {
        ...prev.geographicPreferences,
        [region]: [team],
      },
    }));
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading configuration...</div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="text-center py-10">
        <h2 className="text-xl font-semibold text-gray-800">Configuration Not Found</h2>
        <p className="mt-2 text-gray-600">{error}</p>
        <button 
          onClick={loadConfig}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Routing Policy Editor</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage lead routing rules and geographic preferences.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`px-4 py-2 rounded-md text-white font-medium ${
            saving ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 border-l-4 border-green-400 p-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-green-700">{successMessage}</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6">
        <div className="md:grid md:grid-cols-3 md:gap-6">
          <div className="md:col-span-1">
            <h3 className="text-lg font-medium leading-6 text-gray-900">Geographic Preferences</h3>
            <p className="mt-1 text-sm text-gray-500">
              Map geographic regions to specific sales teams. Leads from these regions will be routed accordingly.
            </p>
          </div>
          <div className="mt-5 md:mt-0 md:col-span-2">
            <div className="space-y-4">
              {Object.entries(config.geographicPreferences || {}).map(([region, teams]: [string, any]) => (
                <div key={region} className="flex items-center space-x-4 bg-gray-50 p-3 rounded-md">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-500 uppercase">Region</label>
                    <div className="text-sm font-medium text-gray-900">{region}</div>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-500 uppercase">Team</label>
                    <input
                      type="text"
                      value={Array.isArray(teams) ? teams[0] : teams}
                      onChange={(e) => handleTeamChange(region, e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
                    />
                  </div>
                  <button
                    onClick={() => handleRemoveRegion(region)}
                    className="text-red-600 hover:text-red-800 text-sm font-medium"
                  >
                    Remove
                  </button>
                </div>
              ))}

              <div className="border-t border-gray-200 pt-4 mt-4">
                <h4 className="text-sm font-medium text-gray-900 mb-3">Add New Rule</h4>
                <div className="flex items-end space-x-4">
                  <div className="flex-1">
                    <label htmlFor="new-region" className="block text-sm font-medium text-gray-700">Region</label>
                    <input
                      type="text"
                      id="new-region"
                      placeholder="e.g. north-america"
                      value={newRegion}
                      onChange={(e) => setNewRegion(e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
                    />
                  </div>
                  <div className="flex-1">
                    <label htmlFor="new-team" className="block text-sm font-medium text-gray-700">Team ID</label>
                    <input
                      type="text"
                      id="new-team"
                      placeholder="e.g. team-enterprise"
                      value={newTeam}
                      onChange={(e) => setNewTeam(e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
                    />
                  </div>
                  <button
                    onClick={handleAddRegion}
                    disabled={!newRegion || !newTeam}
                    className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Read-only view of other settings for now */}
      <div className="bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6 opacity-75">
        <div className="md:grid md:grid-cols-3 md:gap-6">
          <div className="md:col-span-1">
            <h3 className="text-lg font-medium leading-6 text-gray-900">Advanced Settings</h3>
            <p className="mt-1 text-sm text-gray-500">
               Algorithm and Thresholds (Read Only)
            </p>
          </div>
          <div className="mt-5 md:mt-0 md:col-span-2">
            <dl className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2">
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Algorithm</dt>
                <dd className="mt-1 text-sm text-gray-900">{config.algorithm}</dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">High Load Threshold</dt>
                <dd className="mt-1 text-sm text-gray-900">{config.thresholds?.highLoadPercentage}%</dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Rebalance Interval</dt>
                <dd className="mt-1 text-sm text-gray-900">{config.thresholds?.rebalanceIntervalMinutes} min</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
