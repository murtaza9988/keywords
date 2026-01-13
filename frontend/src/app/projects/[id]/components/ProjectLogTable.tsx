import React, { useCallback, useEffect, useMemo, useState } from 'react';
import apiClient from '@/lib/apiClient';
import { ProjectActivityLogEntry, PaginationInfo } from '@/lib/types';
import { Button } from '@/components/ui/Button';

interface ProjectLogTableProps {
  projectId: string;
}

type SortKey = 'created_at' | 'username' | 'action' | 'entity_type';

const formatDetails = (details?: Record<string, unknown> | null) => {
  if (!details || typeof details !== 'object') return '';
  return Object.entries(details)
    .map(([key, value]) => {
      if (value === null || value === undefined) return `${key}: —`;
      if (Array.isArray(value)) return `${key}: ${value.join(', ')}`;
      if (typeof value === 'object') return `${key}: ${JSON.stringify(value)}`;
      return `${key}: ${String(value)}`;
    })
    .join(' | ');
};

export const ProjectLogTable: React.FC<ProjectLogTableProps> = ({ projectId }) => {
  const [logs, setLogs] = useState<ProjectActivityLogEntry[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    total: 0,
    page: 1,
    limit: 50,
    pages: 1,
  });
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    if (!projectId) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await apiClient.fetchProjectLogs(projectId, {
        page: pagination.page,
        limit: pagination.limit,
        sort: sortKey,
        direction,
      });
      setLogs(data.logs);
      setPagination(data.pagination);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load project logs.';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, pagination.page, pagination.limit, sortKey, direction]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleSort = (nextKey: SortKey) => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    if (sortKey === nextKey) {
      setDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(nextKey);
      setDirection('desc');
    }
  };

  const sortedIndicator = (key: SortKey) =>
    sortKey === key ? (direction === 'asc' ? '▲' : '▼') : '';

  const visibleLogs = useMemo(() => logs, [logs]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-sm text-muted">
          {pagination.total.toLocaleString()} actions
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted">Rows:</span>
          <select
            className="border border-border rounded px-2 py-1 text-sm"
            value={pagination.limit}
            onChange={(event) =>
              setPagination((prev) => ({
                ...prev,
                page: 1,
                limit: Number(event.target.value),
              }))
            }
          >
            {[25, 50, 100, 200].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() =>
              setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))
            }
            disabled={pagination.page <= 1 || isLoading}
          >
            Prev
          </Button>
          <span className="text-sm text-muted">
            Page {pagination.page} of {pagination.pages}
          </span>
          <Button
            variant="secondary"
            onClick={() =>
              setPagination((prev) => ({
                ...prev,
                page: Math.min(prev.pages, prev.page + 1),
              }))
            }
            disabled={pagination.page >= pagination.pages || isLoading}
          >
            Next
          </Button>
        </div>
      </div>
      <div className="overflow-auto border border-border rounded-lg">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-surface">
            <tr>
              <th
                className="px-3 py-2 text-left font-semibold text-foreground cursor-pointer"
                onClick={() => handleSort('created_at')}
              >
                Date/Time {sortedIndicator('created_at')}
              </th>
              <th
                className="px-3 py-2 text-left font-semibold text-foreground cursor-pointer"
                onClick={() => handleSort('username')}
              >
                User {sortedIndicator('username')}
              </th>
              <th
                className="px-3 py-2 text-left font-semibold text-foreground cursor-pointer"
                onClick={() => handleSort('action')}
              >
                Action {sortedIndicator('action')}
              </th>
              <th
                className="px-3 py-2 text-left font-semibold text-foreground cursor-pointer"
                onClick={() => handleSort('entity_type')}
              >
                Entity {sortedIndicator('entity_type')}
              </th>
              <th className="px-3 py-2 text-left font-semibold text-foreground">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-white">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted">
                  Loading activity...
                </td>
              </tr>
            ) : errorMessage ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-red-500">
                  {errorMessage}
                </td>
              </tr>
            ) : visibleLogs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted">
                  No activity yet.
                </td>
              </tr>
            ) : (
              visibleLogs.map((log) => (
                <tr key={log.id} className="odd:bg-table-row-alt even:bg-table-row">
                  <td className="px-3 py-2 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">{log.username}</td>
                  <td className="px-3 py-2">{log.action.replace(/_/g, ' ')}</td>
                  <td className="px-3 py-2">
                    {log.entity_type || '—'}
                    {log.entity_id ? ` (${log.entity_id})` : ''}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted">
                    {formatDetails(log.details)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
