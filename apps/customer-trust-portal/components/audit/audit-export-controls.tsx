'use client';

import { useState } from 'react';
import {
  Download,
  FileText,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export function AuditExportControls() {
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  const handleExport = async (format: 'json' | 'csv' | 'pdf') => {
    if (isExporting) return;

    setIsExporting(true);
    setExportStatus({ type: null, message: '' });

    try {
      const response = await apiClient.exportAuditLog(format, {
        startDate: '2024-01-01',
        endDate: new Date().toISOString().split('T')[0],
        includeMetadata: true,
      });

      // Create download link
      const url = window.URL.createObjectURL(response);
      const link = document.createElement('a');
      link.href = url;
      link.download = `neuronx-audit-log-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setExportStatus({
        type: 'success',
        message: `Audit log exported successfully as ${format.toUpperCase()}`,
      });
    } catch (error) {
      console.error('Export failed:', error);
      setExportStatus({
        type: 'error',
        message: 'Failed to export audit log. Please try again.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleComplianceReportExport = async (
    format: 'json' | 'csv' | 'pdf'
  ) => {
    if (isExporting) return;

    setIsExporting(true);
    setExportStatus({ type: null, message: '' });

    try {
      const response = await apiClient.exportComplianceReport(format);

      const url = window.URL.createObjectURL(response);
      const link = document.createElement('a');
      link.href = url;
      link.download = `neuronx-compliance-report-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setExportStatus({
        type: 'success',
        message: `Compliance report exported successfully as ${format.toUpperCase()}`,
      });
    } catch (error) {
      console.error('Compliance report export failed:', error);
      setExportStatus({
        type: 'error',
        message: 'Failed to export compliance report. Please try again.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className='trust-card'>
      <div className='flex items-center justify-between mb-4'>
        <div>
          <h3 className='text-lg font-medium text-gray-900'>Export Controls</h3>
          <p className='text-sm text-gray-500 mt-1'>
            Download audit logs and compliance reports for external review
          </p>
        </div>

        <div className='flex items-center space-x-2'>
          <Shield className='h-5 w-5 text-green-500' />
          <span className='text-sm text-gray-600'>Secure Exports</span>
        </div>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
        {/* Audit Log Export */}
        <div>
          <h4 className='font-medium text-gray-900 mb-3 flex items-center'>
            <FileText className='h-4 w-4 mr-2' />
            Audit Log Export
          </h4>

          <div className='space-y-2'>
            <button
              onClick={() => handleExport('json')}
              disabled={isExporting}
              className='w-full trust-button-secondary justify-start'
            >
              <Download className='h-4 w-4 mr-2' />
              Export as JSON
            </button>

            <button
              onClick={() => handleExport('csv')}
              disabled={isExporting}
              className='w-full trust-button-secondary justify-start'
            >
              <FileSpreadsheet className='h-4 w-4 mr-2' />
              Export as CSV
            </button>

            <button
              onClick={() => handleExport('pdf')}
              disabled={isExporting}
              className='w-full trust-button-secondary justify-start'
            >
              <FileText className='h-4 w-4 mr-2' />
              Export as PDF
            </button>
          </div>

          <p className='text-xs text-gray-500 mt-2'>
            Includes full audit trail with metadata and change tracking
          </p>
        </div>

        {/* Compliance Report Export */}
        <div>
          <h4 className='font-medium text-gray-900 mb-3 flex items-center'>
            <CheckCircle className='h-4 w-4 mr-2' />
            Compliance Report
          </h4>

          <div className='space-y-2'>
            <button
              onClick={() => handleComplianceReportExport('json')}
              disabled={isExporting}
              className='w-full trust-button-secondary justify-start'
            >
              <Download className='h-4 w-4 mr-2' />
              Export as JSON
            </button>

            <button
              onClick={() => handleComplianceReportExport('csv')}
              disabled={isExporting}
              className='w-full trust-button-secondary justify-start'
            >
              <FileSpreadsheet className='h-4 w-4 mr-2' />
              Export as CSV
            </button>

            <button
              onClick={() => handleComplianceReportExport('pdf')}
              disabled={isExporting}
              className='w-full trust-button-secondary justify-start'
            >
              <FileText className='h-4 w-4 mr-2' />
              Export as PDF
            </button>
          </div>

          <p className='text-xs text-gray-500 mt-2'>
            Current compliance status and certification details
          </p>
        </div>
      </div>

      {/* Export Status */}
      {exportStatus.type && (
        <div
          className={`mt-4 p-3 rounded-md ${
            exportStatus.type === 'success'
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}
        >
          <div className='flex items-center'>
            {exportStatus.type === 'success' ? (
              <CheckCircle className='h-4 w-4 text-green-400 mr-2' />
            ) : (
              <AlertTriangle className='h-4 w-4 text-red-400 mr-2' />
            )}
            <span
              className={`text-sm ${
                exportStatus.type === 'success'
                  ? 'text-green-800'
                  : 'text-red-800'
              }`}
            >
              {exportStatus.message}
            </span>
          </div>
        </div>
      )}

      {/* Security Notice */}
      <div className='mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md'>
        <div className='flex items-start'>
          <Shield className='h-4 w-4 text-blue-400 mt-0.5 mr-2 flex-shrink-0' />
          <div className='text-sm text-blue-800'>
            <p className='font-medium mb-1'>Export Security</p>
            <p>
              All exports are encrypted and include tamper-proof digital
              signatures for regulatory compliance.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
