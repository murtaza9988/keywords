"use client";
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown, Loader2 } from 'lucide-react';
import apiClient from '@/lib/apiClient';
import { ActivityLog } from '@/lib/types';
import { cn } from '@/lib/cn';

type SortColumn = 'createdAt' | 'user' | 'action' | 'projectId' | 'id';

interface LogsTableProps {
  projectId?: string;
  isActive?: boolean;
  refreshKey?: number;
  scope?: 'project' | 'global';
}

const formatDetails = (details?: Record<string, unknown> | null) => {
  if (!details) return '';
  try {
    return JSON.stringify(details);
  } catch {
    return String(details);
  }
};

const formatErrorMessage = (error: unknown) => {
  if (!(error instanceof Error)) {
    return 'Unable to load activity logs.';
  }
  const message = error.message || '';
  const lowerMessage = message.toLowerCase();
  if (lowerMessage.includes('session expired') || lowerMessage.includes('login again')) {
    return 'Session expired. Please log in again to view activity logs.';
  }
  if (
    lowerMessage.includes('could not validate credentials') ||
    lowerMessage.includes('unauthorized') ||
    lowerMessage.includes('forbidden') ||
    lowerMessage.includes('401') ||
    lowerMessage.includes('403')
  ) {
    return 'You are not authorized to view activity logs.';
  }
  if (lowerMessage.includes('project not found')) {
    return 'Project not found. Unable to load activity logs.';
  }
  if (lowerMessage.includes('not found') || lowerMessage.includes('404')) {
    return 'Logs endpoint not found. Check API proxy configuration.';
  }
  return message;
};

export function LogsTable({
  projectId,
  isActive = true,
  refreshKey = 0,
  scope = 'project',
}: LogsTableProps) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [sortColumn, setSortColumn] = useState<SortColumn>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const pageSize = 200;
  const pollingIntervalMs = 10000;
  const isFetchingRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    let poller: ReturnType<typeof setInterval> | null = null;

    const fetchLogs = async () => {
      if (!isActive) return;
      if (scope === 'project' && !projectId) {
        if (isMounted) {
          setIsLoading(false);
          setErrorMessage('Project id is missing. Unable to load activity logs.');
        }
        return;
      }
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;
      setIsLoading(true);
      setErrorMessage('');
      try {
        if (scope === 'project' && projectId) {
          const collectedLogs: ActivityLog[] = [];
          let page = 1;
          let totalPages = 1;
          let total = 0;
          while (page <= totalPages) {
            const data = await apiClient.fetchProjectLogs(projectId, {
              page,
              limit: pageSize,
            });
            if (!isMounted) return;
            collectedLogs.push(...data.logs);
            total = data.pagination.total;
            totalPages = data.pagination.pages || 1;
            page += 1;
            if (data.logs.length === 0) {
              break;
            }
          }
          if (isMounted) {
            setLogs(collectedLogs);
            setTotalCount(total);
          }
        } else {
          const data = await apiClient.fetchAllActivityLogs({ page: 1, limit: pageSize });
          if (isMounted) {
            setLogs(data.logs);
            setTotalCount(data.pagination.total);
          }
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(formatErrorMessage(error));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
        isFetchingRef.current = false;
      }
    };

    fetchLogs();
    if (isActive) {
      poller = setInterval(fetchLogs, pollingIntervalMs);
    }
    return () => {
      isMounted = false;
      if (poller) {
        clearInterval(poller);
      }
    };
  }, [projectId, isActive, refreshKey, scope, pageSize]);

  const actionOptions = useMemo(() => {
    const uniqueActions = new Set(logs.map((log) => log.action));
    return ['all', ...Array.from(uniqueActions).sort()];
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const lowerSearch = searchTerm.trim().toLowerCase();
    return logs.filter((log) => {
      if (actionFilter !== 'all' && log.action !== actionFilter) {
        return false;
      }
      if (!lowerSearch) return true;
      const detailsText = formatDetails(log.details).toLowerCase();
      return (
        log.user.toLowerCase().includes(lowerSearch) ||
        log.action.toLowerCase().includes(lowerSearch) ||
        detailsText.includes(lowerSearch) ||
        String(log.projectId).includes(lowerSearch) ||
        String(log.id).includes(lowerSearch)
      );
    });
  }, [logs, searchTerm, actionFilter]);

  const sortedLogs = useMemo(() => {
    const sorted = [...filteredLogs];
    sorted.sort((a, b) => {
      let comparison = 0;
      switch (sortColumn) {
        case 'createdAt': {
          const aTime = new Date(a.createdAt).getTime();
          const bTime = new Date(b.createdAt).getTime();
          comparison = aTime - bTime;
          break;
        }
        case 'projectId':
          comparison = a.projectId - b.projectId;
          break;
        case 'id':
          comparison = a.id - b.id;
          break;
        case 'user':
          comparison = a.user.localeCompare(b.user);
          break;
        case 'action':
          comparison = a.action.localeCompare(b.action);
          break;
        default:
          comparison = 0;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }, [filteredLogs, sortColumn, sortDirection]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const renderSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) {
      return <ChevronsUpDown className="h-3 w-3 text-muted" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="h-3 w-3 text-muted" />
    ) : (
      <ArrowDown className="h-3 w-3 text-muted" />
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-ui-label">Search logs</label>
          <input
            type="text"
            placeholder="Filter by user, action, details, or ID"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="w-72 max-w-full rounded-md border border-border bg-white px-3 py-1.5 text-ui-body text-foreground shadow-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-ui-label">Action</label>
          <select
            value={actionFilter}
            onChange={(event) => setActionFilter(event.target.value)}
            className="rounded-md border border-border bg-white px-3 py-1.5 text-ui-body text-foreground shadow-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-500"
          >
            {actionOptions.map((action) => (
              <option key={action} value={action}>
                {action === 'all' ? 'All actions' : action}
              </option>
            ))}
          </select>
        </div>
        <div className="text-ui-meta text-muted ml-auto">
          Showing {sortedLogs.length.toLocaleString()} of {(totalCount ?? logs.length).toLocaleString()} entries
        </div>
      </div>

      <div className="rounded-lg border border-border bg-white shadow-sm overflow-hidden">
        <div className="max-h-[420px] overflow-auto">
          <table className="min-w-full table-fixed text-ui-body">
            <thead className="bg-surface-muted sticky top-0 z-10">
              <tr>
                <th
                  scope="col"
                  className="px-3 py-2 text-left text-ui-label cursor-pointer"
                  onClick={() => handleSort('createdAt')}
                >
                  <div className="flex items-center gap-1">
                    Timestamp
                    {renderSortIcon('createdAt')}
                  </div>
                </th>
                <th
                  scope="col"
                  className="px-3 py-2 text-left text-ui-label cursor-pointer"
                  onClick={() => handleSort('user')}
                >
                  <div className="flex items-center gap-1">
                    User
                    {renderSortIcon('user')}
                  </div>
                </th>
                <th
                  scope="col"
                  className="px-3 py-2 text-left text-ui-label cursor-pointer"
                  onClick={() => handleSort('action')}
                >
                  <div className="flex items-center gap-1">
                    Action
                    {renderSortIcon('action')}
                  </div>
                </th>
                <th
                  scope="col"
                  className="px-3 py-2 text-left text-ui-label cursor-pointer"
                  onClick={() => handleSort('projectId')}
                >
                  <div className="flex items-center gap-1">
                    Project
                    {renderSortIcon('projectId')}
                  </div>
                </th>
                <th
                  scope="col"
                  className="px-3 py-2 text-left text-ui-label cursor-pointer"
                  onClick={() => handleSort('id')}
                >
                  <div className="flex items-center gap-1">
                    Log ID
                    {renderSortIcon('id')}
                  </div>
                </th>
                <th scope="col" className="px-3 py-2 text-left text-ui-label">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-ui-muted">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading activity logs...
                    </div>
                  </td>
                </tr>
              ) : errorMessage ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-ui-body text-red-500">
                    {errorMessage}
                  </td>
                </tr>
              ) : sortedLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-ui-muted">
                    {scope === 'project'
                      ? 'No activity logs for this project yet.'
                      : 'No activity logs match your filters.'}
                  </td>
                </tr>
              ) : (
                sortedLogs.map((log, index) => {
                  const detailsText = formatDetails(log.details);
                  return (
                    <tr
                      key={`${log.id}-${log.createdAt}`}
                      className={cn(index % 2 === 0 ? 'bg-table-row' : 'bg-table-row-alt')}
                    >
                      <td className="px-3 py-2 text-muted">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-foreground">{log.user}</td>
                      <td className="px-3 py-2 text-foreground">{log.action}</td>
                      <td className="px-3 py-2 text-muted">{log.projectId}</td>
                      <td className="px-3 py-2 text-muted">{log.id}</td>
                      <td className="px-3 py-2 text-muted">
                        {detailsText ? (
                          <span className="block break-words">{detailsText}</span>
                        ) : (
                          <span className="italic text-muted">No details</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
