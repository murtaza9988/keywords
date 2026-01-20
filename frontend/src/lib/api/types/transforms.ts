/**
 * Response transformation utilities
 * Functions to transform raw API responses to domain types
 */
import type { Keyword, Project } from '../../types';
import type { ApiKeyword, ApiProject } from './api.types';

/**
 * Transform an API keyword response to a domain Keyword
 */
export const mapKeyword = (keywordData: ApiKeyword): Keyword => {
  const normalizedStatus: Keyword['status'] =
    keywordData.status === 'ungrouped' ||
    keywordData.status === 'grouped' ||
    keywordData.status === 'blocked' ||
    keywordData.status === 'confirmed'
      ? keywordData.status
      : 'ungrouped';

  return {
    id: keywordData.id,
    project_id: keywordData.project_id ?? 0,
    keyword: keywordData.keyword ?? '',
    tokens: Array.isArray(keywordData.tokens) ? keywordData.tokens : [],
    volume: typeof keywordData.volume === 'number' ? keywordData.volume : 0,
    length:
      typeof keywordData.length === 'number' ? keywordData.length : (keywordData.keyword ?? '').length,
    difficulty: typeof keywordData.difficulty === 'number' ? keywordData.difficulty : 0,
    rating: typeof keywordData.rating === 'number' ? keywordData.rating : undefined,
    isParent: !!keywordData.isParent,
    groupId: typeof keywordData.groupId === 'string' ? keywordData.groupId : null,
    groupName: typeof keywordData.groupName === 'string' ? keywordData.groupName : null,
    status: normalizedStatus,
    childCount: typeof keywordData.childCount === 'number' ? keywordData.childCount : 0,
    original_volume: typeof keywordData.original_volume === 'number' ? keywordData.original_volume : 0,
    serpFeatures: Array.isArray(keywordData.serpFeatures) ? keywordData.serpFeatures : [],
  };
};

/**
 * Transform an array of API keywords to domain Keywords
 */
export const mapKeywords = (keywords: ApiKeyword[]): Keyword[] => {
  return keywords.map(mapKeyword);
};

/**
 * Transform an API project response to a domain Project
 */
export const mapProject = (projectData: ApiProject): Project => ({
  id: projectData.id,
  name: projectData.name ?? 'Unnamed Project',
  created_at: projectData.created_at ?? new Date().toISOString(),
  updated_at: projectData.updated_at ?? new Date().toISOString(),
});

/**
 * Transform an array of API projects to domain Projects
 */
export const mapProjects = (projects: ApiProject[]): Project[] => {
  return projects.map(mapProject);
};
