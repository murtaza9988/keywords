"use client";

import React, { useState, useMemo } from 'react';
import { ProcessingPanel } from './ProcessingPanel';
import { ProcessingFileError, ProcessingStatus } from './types';
import apiClient from '@/lib/apiClient';
import { Button } from '@/components/ui/Button';
import { Download, FileText, TrendingUp, Database, Users, AlertCircle, CheckCircle2, Clock } from 'lucide-react';

interface ProjectStatsSummary {
  totalKeywords: number;
  totalParentKeywords: number;
  parentTokenCount: number;
  childTokenCount: number;
  groupCount: number;
  groupedPages: number;
  confirmedPages: number;
  blockedCount: number;
}

interface ProjectDetailOverviewProps {
  projectId: string;
  stats: ProjectStatsSummary;
  totalChildKeywords: number;
  isUploading: boolean;
  processingStatus: ProcessingStatus;
  processingMessage: string;
  processingStage?: string | null;
  processingStageDetail?: string | null;
  displayProgress: number;
  processingCurrentFile: string | null;
  processingQueue: string[];
  processingSucceededJobs?: number;
  processingFailedJobs?: number;
  processingFileErrors: ProcessingFileError[];
  csvUploadsRefreshKey?: number;
  uploadedFiles?: string[];
  processedFiles?: string[];
  onUploadStart: () => void;
  onUploadBatchStart: (files: File[]) => void;
  onUploadSuccess: (status: ProcessingStatus, message?: string) => void;
  onUploadError: (message: string) => void;
}

interface DownloadInfo {
  size: string;
  lastModified: string;
  isDownloading: boolean;
}

export function ProjectDetailOverview({
  projectId,
  stats,
  totalChildKeywords,
  isUploading,
  processingStatus,
  processingMessage,
  processingStage,
  processingStageDetail,
  displayProgress,
  processingCurrentFile,
  processingQueue,
  processingSucceededJobs,
  processingFailedJobs,
  processingFileErrors,
  csvUploadsRefreshKey,
  uploadedFiles,
  processedFiles,
  onUploadStart,
  onUploadBatchStart,
  onUploadSuccess,
  onUploadError,
}: ProjectDetailOverviewProps): React.ReactElement {
  const [downloadInfo, setDownloadInfo] = useState<Record<string, DownloadInfo>>({});

  const downloadOutput = async (view: 'grouped' | 'confirmed') => {
    const key = `${view}-${projectId}`;
    setDownloadInfo(prev => ({ ...prev, [key]: { ...prev[key], isDownloading: true } }));

    try {
      const blobData = await apiClient.exportGroupedKeywords(projectId, view);
      const url = window.URL.createObjectURL(blobData);
      const link = document.createElement('a');
      link.href = url;
      const filename = `${view}_keywords_${projectId}_${new Date().toISOString().slice(0, 10)}.csv`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);

      // Update download info
      setDownloadInfo(prev => ({
        ...prev,
        [key]: {
          size: `${(blobData.size / 1024).toFixed(1)} KB`,
          lastModified: new Date().toLocaleString(),
          isDownloading: false
        }
      }));
    } catch (error) {
      console.error('Download failed:', error);
      setDownloadInfo(prev => ({ ...prev, [key]: { ...prev[key], isDownloading: false } }));
    }
  };

  const processingStats = useMemo(() => [
    {
      label: 'CSV files successfully processed',
      value: (processingSucceededJobs ?? 0).toLocaleString(),
      icon: CheckCircle2,
      color: 'text-success',
      bgColor: 'bg-success-container'
    },
    {
      label: 'CSV files failed',
      value: (processingFailedJobs ?? 0).toLocaleString(),
      icon: AlertCircle,
      color: 'text-danger',
      bgColor: 'bg-error-container'
    },
    {
      label: 'Files in queue',
      value: processingQueue.length.toString(),
      icon: Clock,
      color: 'text-accent',
      bgColor: 'bg-primary-container'
    }
  ], [processingSucceededJobs, processingFailedJobs, processingQueue.length]);

  const keywordStats = useMemo(() => [
    {
      label: 'Total keywords uploaded',
      value: stats.totalKeywords.toLocaleString(),
      icon: Database,
      color: 'text-foreground',
      bgColor: 'bg-surface-muted'
    },
    {
      label: 'Total parent keywords',
      value: stats.totalParentKeywords.toLocaleString(),
      icon: Users,
      color: 'text-foreground',
      bgColor: 'bg-surface-muted'
    },
    {
      label: 'Total child keywords',
      value: totalChildKeywords.toLocaleString(),
      icon: Users,
      color: 'text-foreground',
      bgColor: 'bg-surface-muted'
    }
  ], [stats.totalKeywords, stats.totalParentKeywords, totalChildKeywords]);

  const tokenStats = useMemo(() => [
    {
      label: 'Parent tokens',
      value: stats.parentTokenCount.toLocaleString(),
      icon: FileText,
      color: 'text-foreground',
      bgColor: 'bg-surface-muted'
    },
    {
      label: 'Child tokens',
      value: stats.childTokenCount.toLocaleString(),
      icon: FileText,
      color: 'text-foreground',
      bgColor: 'bg-surface-muted'
    }
  ], [stats.parentTokenCount, stats.childTokenCount]);

  const groupingStats = useMemo(() => [
    {
      label: 'Total groups',
      value: stats.groupCount.toLocaleString(),
      icon: Users,
      color: 'text-foreground',
      bgColor: 'bg-surface-muted'
    },
    {
      label: 'Grouped pages',
      value: stats.groupedPages.toLocaleString(),
      icon: FileText,
      color: 'text-foreground',
      bgColor: 'bg-surface-muted'
    },
    {
      label: 'Confirmed pages',
      value: stats.confirmedPages.toLocaleString(),
      icon: CheckCircle2,
      color: 'text-foreground',
      bgColor: 'bg-surface-muted'
    },
    {
      label: 'Blocked parent keywords',
      value: stats.blockedCount.toLocaleString(),
      icon: AlertCircle,
      color: 'text-foreground',
      bgColor: 'bg-surface-muted'
    }
  ], [stats.groupCount, stats.groupedPages, stats.confirmedPages, stats.blockedCount]);

  const StatCard = ({ title, stats }: { title: string; stats: typeof processingStats }) => (
    <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
      <h3 className="text-ui-title font-semibold mb-3 flex items-center gap-2">
        {title}
      </h3>
      <div className="grid gap-3">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-ui-label text-xs">{stat.label}</p>
                <p className="text-ui-heading font-semibold">{stat.value}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <ProcessingPanel
        projectId={projectId}
        isUploading={isUploading}
        processingStatus={processingStatus}
        processingMessage={processingMessage}
        processingStage={processingStage}
        processingStageDetail={processingStageDetail}
        displayProgress={displayProgress}
        processingCurrentFile={processingCurrentFile}
        processingQueue={processingQueue}
        processingFileErrors={processingFileErrors}
        csvUploadsRefreshKey={csvUploadsRefreshKey}
        uploadedFiles={uploadedFiles}
        processedFiles={processedFiles}
        onUploadStart={onUploadStart}
        onUploadBatchStart={onUploadBatchStart}
        onUploadSuccess={onUploadSuccess}
        onUploadError={onUploadError}
      />

      {/* Progress Visualization */}
      <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <TrendingUp className="h-5 w-5 text-accent" />
          <h3 className="text-ui-title font-semibold">Processing Progress</h3>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-ui-muted">Overall completion</span>
            <span className="text-ui-label font-medium">{Math.round(displayProgress)}%</span>
          </div>
          <div className="w-full bg-surface-muted rounded-full h-3 overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-500 ease-out"
              style={{ width: `${displayProgress}%` }}
            />
          </div>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-ui-meta text-xs">Files Processed</p>
              <p className="text-ui-heading font-semibold">
                {(processingSucceededJobs ?? 0) + (processingFailedJobs ?? 0)}
              </p>
            </div>
            <div>
              <p className="text-ui-meta text-xs">Success Rate</p>
              <p className="text-ui-heading font-semibold">
                {((processingSucceededJobs ?? 0) + (processingFailedJobs ?? 0)) > 0
                  ? Math.round(((processingSucceededJobs ?? 0) / ((processingSucceededJobs ?? 0) + (processingFailedJobs ?? 0))) * 100)
                  : 0}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Download Section */}
      <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Download className="h-5 w-5 text-accent" />
              <h3 className="text-ui-title font-semibold">Export Data</h3>
            </div>
            <p className="text-ui-muted text-sm">
              Download your processed keyword data in CSV format. Files include all grouped and confirmed keywords with their metadata.
            </p>
          </div>
          <div className="flex flex-col gap-3 min-w-[280px]">
            {[
              { key: 'grouped', label: 'Grouped Keywords', description: 'Keywords organized into groups with parent-child relationships' },
              { key: 'confirmed', label: 'Confirmed Keywords', description: 'Final confirmed keyword groups ready for use' }
            ].map(({ key, label, description }) => {
              const info = downloadInfo[`${key}-${projectId}`];
              return (
                <div key={key} className="border border-border rounded-lg p-3 bg-surface-muted">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-ui-label font-medium">{label}</h4>
                      <p className="text-ui-meta text-xs mt-1">{description}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => downloadOutput(key as 'grouped' | 'confirmed')}
                      disabled={info?.isDownloading}
                      className="shrink-0"
                    >
                      {info?.isDownloading ? (
                        <>
                          <div className="animate-spin rounded-full h-3 w-3 border border-current border-t-transparent mr-2" />
                          Downloading...
                        </>
                      ) : (
                        <>
                          <Download className="h-3 w-3 mr-2" />
                          Download CSV
                        </>
                      )}
                    </Button>
                  </div>
                  {info && !info.isDownloading && (
                    <div className="text-ui-meta text-xs space-y-1">
                      <div>Size: {info.size}</div>
                      <div>Last downloaded: {info.lastModified}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Grouped Stats Cards */}
      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Processing Stats" stats={processingStats} />
        <StatCard title="Keyword Overview" stats={keywordStats} />
        <StatCard title="Token Analysis" stats={tokenStats} />
        <StatCard title="Grouping Results" stats={groupingStats} />
      </div>
    </div>
  );
}
