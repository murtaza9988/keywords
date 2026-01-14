import apiClient from '@/lib/apiClient';
import type { Project, ProjectStats, ProjectsWithStatsResponse } from '@/lib/types';

export const fetchProjects = (): Promise<Project[]> => apiClient.fetchProjects();

export const fetchProjectsWithStats = (): Promise<ProjectsWithStatsResponse> =>
  apiClient.fetchProjectsWithStats();

export const fetchProjectStats = (projectId: string): Promise<ProjectStats> =>
  apiClient.fetchSingleProjectStats(projectId);

export const createProject = (name: string): Promise<Project> => apiClient.createProject(name);

export const updateProject = (projectId: number, name: string): Promise<Project> =>
  apiClient.updateProject(projectId, name);

export const deleteProject = (projectId: number): Promise<boolean> =>
  apiClient.deleteProject(projectId);
