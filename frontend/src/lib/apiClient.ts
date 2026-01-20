/**
 * API Client Facade
 *
 * This file maintains backward compatibility with existing code that imports apiClient.
 * All actual implementations have been moved to modular files in the api/ directory:
 *
 * - api/client.ts     - Axios setup, interceptors, cache, base request method
 * - api/auth.ts       - Authentication API
 * - api/projects.ts   - Project API
 * - api/keywords.ts   - Keywords API
 * - api/tokens.ts     - Tokens API
 * - api/csv.ts        - CSV upload/download/export
 * - api/types/        - API type definitions and transformations
 *
 * For new code, prefer importing directly from the specific modules:
 * import { fetchProjects } from '@/lib/api/projects';
 */

import type {
  Project,
  FetchKeywordsResponse,
  LoginResponse,
  KeywordChildrenData,
  ProcessingStatusResponse,
  GroupKeywordsResponse,
  BlockTokenResponse,
  UnblockKeywordsResponse,
  TokenListResponse,
  Note,
  CSVUpload,
  ActivityLogListResponse,
  ProcessingStatus,
  ProjectStats,
  ProjectsWithStatsResponse,
  ConfirmationResponse,
} from './types';

import { clearCache } from './api/client';
import { login } from './api/auth';
import {
  fetchProjects,
  fetchProjectsWithStats,
  fetchProjectStats,
  createProject,
  updateProject,
  deleteProject,
  fetchProjectLogs,
  fetchAllActivityLogs,
  fetchNotes,
  saveNotes,
  resetProcessing,
  runGrouping,
  fetchGroupNameSuggestions,
  fetchSerpFeatures,
} from './api/projects';
import {
  fetchKeywords,
  fetchInitialData,
  fetchKeywordChildren,
  checkProcessingStatus,
  groupKeywords,
  regroupKeywords,
  ungroupKeywords,
  blockToken,
  unblockKeywords,
  getBlockTokenCount,
  confirmKeywords,
  unconfirmKeywords,
} from './api/keywords';
import {
  fetchTokens,
  blockTokens,
  unblockTokens,
  mergeTokens,
  unmergeToken,
  unmergeIndividualToken,
  createToken,
} from './api/tokens';
import {
  fetchCSVUploads,
  downloadCSVUpload,
  uploadCSV,
  exportGroupedKeywords,
  exportParentKeywords,
  importParentKeywords,
} from './api/csv';
import type { ApiInitialDataResponse, ApiTokenOperationResponse, ApiCreateTokenResponse } from './api/types';

/**
 * ApiClient facade class
 * Maintains backward compatibility with existing code
 *
 * @deprecated Prefer importing directly from api/ modules
 */
class ApiClient {
  // ============================================================================
  // Auth
  // ============================================================================

  async login(username: string, password: string): Promise<LoginResponse> {
    return login(username, password);
  }

  // ============================================================================
  // Projects
  // ============================================================================

  async fetchProjects(): Promise<Project[]> {
    return fetchProjects();
  }

  async fetchProjectsWithStats(): Promise<ProjectsWithStatsResponse> {
    return fetchProjectsWithStats();
  }

  async fetchSingleProjectStats(projectId: string): Promise<ProjectStats> {
    return fetchProjectStats(projectId);
  }

  async createProject(name: string): Promise<Project> {
    return createProject(name);
  }

  async updateProject(projectId: number, name: string): Promise<Project> {
    return updateProject(projectId, name);
  }

  async deleteProject(projectId: number): Promise<boolean> {
    return deleteProject(projectId);
  }

  async fetchProjectLogs(
    projectId: string,
    options: { page?: number; limit?: number } = {}
  ): Promise<ActivityLogListResponse> {
    return fetchProjectLogs(projectId, options);
  }

  async fetchAllActivityLogs(
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
    return fetchAllActivityLogs(filters);
  }

  async fetchNotes(projectId: string): Promise<Note> {
    return fetchNotes(projectId);
  }

  async saveNotes(projectId: string, note1: string, note2: string): Promise<Note> {
    return saveNotes(projectId, note1, note2);
  }

  async resetProcessing(projectId: string): Promise<{ message: string; cleared: Record<string, unknown> }> {
    return resetProcessing(projectId);
  }

  async runGrouping(projectId: string): Promise<{
    message: string;
    ungrouped_before: number;
    ungrouped_after: number;
    keywords_grouped: number;
  }> {
    return runGrouping(projectId);
  }

  async fetchGroupNameSuggestions(projectId: string, search: string): Promise<string[]> {
    return fetchGroupNameSuggestions(projectId, search);
  }

  async fetchSerpFeatures(projectId: string): Promise<string[]> {
    return fetchSerpFeatures(projectId);
  }

  // ============================================================================
  // Keywords
  // ============================================================================

  async fetchKeywords(
    projectId: string,
    queryParams: URLSearchParams,
    useCache = false
  ): Promise<FetchKeywordsResponse> {
    return fetchKeywords(projectId, queryParams, useCache);
  }

  async fetchInitialData(projectId: string): Promise<ApiInitialDataResponse> {
    return fetchInitialData(projectId);
  }

  async fetchChildren(projectId: string, groupId: string): Promise<KeywordChildrenData> {
    return fetchKeywordChildren(projectId, groupId);
  }

  async checkProcessingStatus(projectId: string): Promise<ProcessingStatusResponse> {
    return checkProcessingStatus(projectId);
  }

  async groupKeywords(
    projectId: string,
    keywordIds: number[],
    groupName: string
  ): Promise<GroupKeywordsResponse> {
    return groupKeywords(projectId, keywordIds, groupName);
  }

  async regroupKeywords(
    projectId: string,
    keywordIds: number[],
    groupName: string
  ): Promise<GroupKeywordsResponse> {
    return regroupKeywords(projectId, keywordIds, groupName);
  }

  async ungroupKeywords(projectId: string, keywordIds: number[]): Promise<UnblockKeywordsResponse> {
    return ungroupKeywords(projectId, keywordIds);
  }

  async blockToken(projectId: string, blockTokenValue: string): Promise<BlockTokenResponse> {
    return blockToken(projectId, blockTokenValue);
  }

  async unblockKeywords(projectId: string, keywordIds: number[]): Promise<UnblockKeywordsResponse> {
    return unblockKeywords(projectId, keywordIds);
  }

  async getBlockTokenCount(projectId: string, tokenToBlock: string): Promise<{ count: number }> {
    return getBlockTokenCount(projectId, tokenToBlock);
  }

  async confirmKeywords(projectId: string, keywordIds: number[]): Promise<ConfirmationResponse> {
    return confirmKeywords(projectId, keywordIds);
  }

  async unconfirmKeywords(projectId: string, keywordIds: number[]): Promise<ConfirmationResponse> {
    return unconfirmKeywords(projectId, keywordIds);
  }

  // ============================================================================
  // Tokens
  // ============================================================================

  async fetchTokens(
    projectId: string,
    queryParams: URLSearchParams,
    useCache = false
  ): Promise<TokenListResponse> {
    return fetchTokens(projectId, queryParams, useCache);
  }

  async blockTokens(projectId: string, tokens: string[]): Promise<BlockTokenResponse> {
    return blockTokens(projectId, tokens);
  }

  async unblockTokens(projectId: string, tokens: string[]): Promise<BlockTokenResponse> {
    return unblockTokens(projectId, tokens);
  }

  async mergeTokens(
    projectId: string,
    parentToken: string,
    childTokens: string[]
  ): Promise<ApiTokenOperationResponse> {
    return mergeTokens(projectId, parentToken, childTokens);
  }

  async unmergeToken(projectId: string, tokenName: string): Promise<ApiTokenOperationResponse> {
    return unmergeToken(projectId, tokenName);
  }

  async unmergeIndividualToken(
    projectId: string,
    parentToken: string,
    childToken: string
  ): Promise<ApiTokenOperationResponse> {
    return unmergeIndividualToken(projectId, parentToken, childToken);
  }

  async createToken(
    projectId: string,
    searchTerm: string,
    tokenName: string
  ): Promise<ApiCreateTokenResponse> {
    return createToken(projectId, searchTerm, tokenName);
  }

  // ============================================================================
  // CSV
  // ============================================================================

  async fetchCSVUploads(projectId: string): Promise<CSVUpload[]> {
    return fetchCSVUploads(projectId);
  }

  async downloadCSVUpload(projectId: string, uploadId: number): Promise<Blob> {
    return downloadCSVUpload(projectId, uploadId);
  }

  async uploadCSV(
    projectId: string,
    formData: FormData,
    onUploadProgress?: (progress: number) => void
  ): Promise<{ message: string; status: ProcessingStatus; file_name?: string }> {
    return uploadCSV(projectId, formData, onUploadProgress);
  }

  async exportGroupedKeywords(projectId: string, view = 'grouped'): Promise<Blob> {
    return exportGroupedKeywords(projectId, view);
  }

  async exportParentKeywords(projectId: string): Promise<Blob> {
    return exportParentKeywords(projectId);
  }

  async importParentKeywords(projectId: string, formData: FormData): Promise<unknown> {
    return importParentKeywords(projectId, formData);
  }

  // ============================================================================
  // Cache Management
  // ============================================================================

  clearCache(pattern?: string): void {
    clearCache(pattern);
  }
}

const apiClient = new ApiClient();
export default apiClient;
