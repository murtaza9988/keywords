/**
 * Projects API module
 * Handles all project-related API operations
 */
import type {
  Project,
  ProjectStats,
  ProjectsWithStatsResponse,
  ActivityLogListResponse,
  Note,
} from '../types';
import { request, invalidateCache } from './client';
import { mapProject } from './types/transforms';
import type { ApiProject, ApiActivityLogListResponse, ApiProjectsWithStatsResponse } from './types';

// ============================================================================
// Project CRUD Operations
// ============================================================================

export async function fetchProjects(): Promise<Project[]> {
  const data = await request<ApiProject[]>('get', '/api/projects', undefined, undefined, true);
  return data.map(mapProject);
}

export async function fetchProjectsWithStats(): Promise<ProjectsWithStatsResponse> {
  const data = await request<ApiProjectsWithStatsResponse>(
    'get',
    '/api/projects/with-stats',
    undefined,
    undefined,
    true
  );
  return data as ProjectsWithStatsResponse;
}

export async function fetchProjectStats(projectId: string): Promise<ProjectStats> {
  const data = await request<ProjectStats>(
    'get',
    `/api/projects/${projectId}/stats`,
    undefined,
    undefined,
    true
  );
  return data;
}

export async function createProject(name: string): Promise<Project> {
  const data = await request<ApiProject>('post', '/api/projects', { name });
  invalidateCache('/api/projects');
  invalidateCache('/api/projects/with-stats');
  return mapProject(data);
}

export async function updateProject(projectId: number, name: string): Promise<Project> {
  const data = await request<ApiProject>('put', `/api/projects/${projectId}`, { name });
  invalidateCache('/api/projects');
  invalidateCache(`/api/projects/${projectId}`);
  invalidateCache('/api/projects/with-stats');
  return mapProject(data);
}

export async function deleteProject(projectId: number): Promise<boolean> {
  await request('delete', `/api/projects/${projectId}`);
  invalidateCache(`/api/projects/${projectId}`);
  invalidateCache('/api/projects');
  invalidateCache('/api/projects/with-stats');
  return true;
}

// ============================================================================
// Activity Logs
// ============================================================================

export async function fetchProjectLogs(
  projectId: string,
  options: { page?: number; limit?: number } = {}
): Promise<ActivityLogListResponse> {
  const params = new URLSearchParams();
  if (options.page) {
    params.set('page', String(options.page));
  }
  if (options.limit) {
    params.set('limit', String(options.limit));
  }
  const query = params.toString();
  const url = query ? `/api/projects/${projectId}/logs?${query}` : `/api/projects/${projectId}/logs`;

  const data = await request<ApiActivityLogListResponse>('get', url, undefined, undefined, false);

  const logs = data.logs.map((log) => ({
    ...log,
    projectId: log.projectId ?? log.project_id ?? Number(projectId),
    createdAt: log.createdAt ?? log.created_at ?? new Date().toISOString(),
    details: log.details ?? null,
  }));

  return { logs, pagination: data.pagination };
}

export async function fetchAllActivityLogs(
  filters: {
    projectId?: number;
    user?: string;
    action?: string;
    startDate?: string | Date;
    endDate?: string | Date;
    page?: number;
    limit?: number;
  } = {}
): Promise<ActivityLogListResponse> {
  const params = new URLSearchParams();
  if (filters.projectId !== undefined) {
    params.set('projectId', String(filters.projectId));
  }
  if (filters.user) {
    params.set('user', filters.user);
  }
  if (filters.action) {
    params.set('action', filters.action);
  }
  if (filters.startDate) {
    const value =
      filters.startDate instanceof Date ? filters.startDate.toISOString() : filters.startDate;
    params.set('startDate', value);
  }
  if (filters.endDate) {
    const value = filters.endDate instanceof Date ? filters.endDate.toISOString() : filters.endDate;
    params.set('endDate', value);
  }
  if (filters.page) {
    params.set('page', String(filters.page));
  }
  if (filters.limit) {
    params.set('limit', String(filters.limit));
  }
  const query = params.toString();
  const url = query ? `/api/logs?${query}` : '/api/logs';

  const data = await request<ApiActivityLogListResponse>('get', url, undefined, undefined, false);

  const logs = data.logs.map((log) => ({
    ...log,
    projectId: log.projectId ?? log.project_id ?? 0,
    createdAt: log.createdAt ?? log.created_at ?? new Date().toISOString(),
    details: log.details ?? null,
  }));

  return { logs, pagination: data.pagination };
}

// ============================================================================
// Notes
// ============================================================================

export async function fetchNotes(projectId: string): Promise<Note> {
  const url = `/api/projects/${projectId}/notes`;
  try {
    const data = await request<Note>('get', url, undefined, undefined, false);
    return data;
  } catch (error) {
    console.error('Error fetching notes:', error);
    return {
      id: 0,
      project_id: Number(projectId),
      note1: '',
      note2: '',
      created_at: new Date(),
      updated_at: new Date(),
    };
  }
}

export async function saveNotes(projectId: string, note1: string, note2: string): Promise<Note> {
  const url = `/api/projects/${projectId}/notes`;
  try {
    const data = await request<Note>('post', url, { note1, note2 }, undefined, false);
    return data;
  } catch (error) {
    console.error('Error saving notes:', error);
    throw error;
  }
}

// ============================================================================
// Processing
// ============================================================================

export async function resetProcessing(
  projectId: string
): Promise<{ message: string; cleared: Record<string, unknown> }> {
  const data = await request<{ message: string; cleared: Record<string, unknown> }>(
    'post',
    `/api/projects/${projectId}/reset-processing`
  );

  invalidateCache(`/api/projects/${projectId}`);

  return data;
}

export async function runGrouping(projectId: string): Promise<{
  message: string;
  ungrouped_before: number;
  ungrouped_after: number;
  keywords_grouped: number;
}> {
  const data = await request<{
    message: string;
    ungrouped_before: number;
    ungrouped_after: number;
    keywords_grouped: number;
  }>('post', `/api/projects/${projectId}/run-grouping`);

  invalidateCache(`/api/projects/${projectId}/keywords`);
  invalidateCache(`/api/projects/${projectId}/stats`);

  return data;
}

// ============================================================================
// Group Suggestions
// ============================================================================

export async function fetchGroupNameSuggestions(projectId: string, search: string): Promise<string[]> {
  if (!search || search.trim().length === 0) {
    return [];
  }
  try {
    const sanitizedSearch = encodeURIComponent(search.trim());
    const url = `/api/projects/${projectId}/group-suggestions?search=${sanitizedSearch}`;
    const data = await request<string[]>('get', url, undefined, undefined, false);
    return data;
  } catch (error) {
    console.error('Error fetching group name suggestions:', error);
    return [];
  }
}

// ============================================================================
// SERP Features
// ============================================================================

export async function fetchSerpFeatures(projectId: string): Promise<string[]> {
  try {
    const data = await request<{ features: string[] }>(
      'get',
      `/api/projects/${projectId}/serp-features`,
      undefined,
      undefined,
      false
    );

    return data.features || [];
  } catch (error) {
    console.error('Error fetching SERP features:', error);
    return [];
  }
}
