/**
 * Keywords API module
 * Handles all keyword-related API operations including grouping, blocking, and confirmations
 */
import type {
  FetchKeywordsResponse,
  KeywordChildrenData,
  PaginationInfo,
  ProcessingStatusResponse,
  GroupKeywordsResponse,
  BlockTokenResponse,
  UnblockKeywordsResponse,
  ConfirmationResponse,
  Keyword,
} from '../types';
import { request, invalidateCache } from './client';
import { mapKeyword } from './types/transforms';
import type { ApiKeywordListResponse, ApiKeywordChildrenResponse, ApiInitialDataResponse } from './types';

// ============================================================================
// Keyword Fetching
// ============================================================================

export async function fetchKeywords(
  projectId: string,
  queryParams: URLSearchParams,
  useCache = false
): Promise<FetchKeywordsResponse> {
  const url = `/api/projects/${projectId}/keywords?${queryParams.toString()}`;
  const data = await request<ApiKeywordListResponse>('get', url, undefined, undefined, useCache);

  const ungroupedKeywords = (data?.ungroupedKeywords || []).map(mapKeyword);
  const groupedKeywords = (data?.groupedKeywords || []).map(mapKeyword);
  const confirmedKeywords = (data?.confirmedKeywords || []).map(mapKeyword);
  const blockedKeywords = (data?.blockedKeywords || []).map(mapKeyword);
  const pagination: PaginationInfo = data?.pagination || { total: 0, page: 1, limit: 100, pages: 0 };

  return { ungroupedKeywords, groupedKeywords, confirmedKeywords, blockedKeywords, pagination };
}

export async function fetchInitialData(projectId: string): Promise<ApiInitialDataResponse> {
  const url = `/api/projects/${projectId}/initial-data`;
  const data = await request<ApiInitialDataResponse>('get', url, undefined, undefined, true);

  if (data?.keywords) {
    for (const viewKey in data.keywords) {
      if (Object.prototype.hasOwnProperty.call(data.keywords, viewKey)) {
        data.keywords[viewKey] = data.keywords[viewKey].map(mapKeyword) as Keyword[];
      }
    }
  }

  return data;
}

export async function fetchKeywordChildren(
  projectId: string,
  groupId: string
): Promise<KeywordChildrenData> {
  if (!groupId) {
    console.warn('fetchKeywordChildren called with invalid groupId');
    return { children: [] };
  }

  const timestamp = Date.now();
  const data = await request<ApiKeywordChildrenResponse>(
    'get',
    `/api/projects/${projectId}/groups/${groupId}/children?_t=${timestamp}`,
    undefined,
    undefined,
    false
  );

  const mappedChildren = (data?.children || []).map(mapKeyword);
  return { children: mappedChildren };
}

// ============================================================================
// Processing Status
// ============================================================================

export async function checkProcessingStatus(projectId: string): Promise<ProcessingStatusResponse> {
  return request<ProcessingStatusResponse>(
    'get',
    `/api/projects/${projectId}/processing-status?_t=${Date.now()}`,
    undefined,
    undefined,
    false
  );
}

// ============================================================================
// Grouping Operations
// ============================================================================

export async function groupKeywords(
  projectId: string,
  keywordIds: number[],
  groupName: string
): Promise<GroupKeywordsResponse> {
  const data = await request<GroupKeywordsResponse>('post', `/api/projects/${projectId}/group`, {
    keywordIds,
    groupName,
  });

  invalidateCache(`/api/projects/${projectId}/keywords`);
  invalidateCache(`/api/projects/${projectId}/stats`);
  invalidateCache('/api/projects/with-stats');

  return data;
}

export async function regroupKeywords(
  projectId: string,
  keywordIds: number[],
  groupName: string
): Promise<GroupKeywordsResponse> {
  const data = await request<GroupKeywordsResponse>('post', `/api/projects/${projectId}/regroup`, {
    keywordIds,
    groupName,
  });

  invalidateCache(`/api/projects/${projectId}/keywords`);
  invalidateCache(`/api/projects/${projectId}/stats`);
  invalidateCache(`/api/projects/${projectId}/groups`);
  invalidateCache('/api/projects/with-stats');

  return data;
}

export async function ungroupKeywords(
  projectId: string,
  keywordIds: number[]
): Promise<UnblockKeywordsResponse> {
  const data = await request<UnblockKeywordsResponse>('post', `/api/projects/${projectId}/ungroup`, {
    keywordIds,
  });

  invalidateCache(`/api/projects/${projectId}/keywords`);
  invalidateCache(`/api/projects/${projectId}/stats`);
  invalidateCache('/api/projects/with-stats');

  return data;
}

// ============================================================================
// Blocking Operations
// ============================================================================

export async function blockToken(projectId: string, blockTokenValue: string): Promise<BlockTokenResponse> {
  const data = await request<BlockTokenResponse>('post', `/api/projects/${projectId}/block-token`, {
    token: blockTokenValue,
  });

  invalidateCache(`/api/projects/${projectId}/keywords`);
  invalidateCache(`/api/projects/${projectId}/stats`);
  invalidateCache('/api/projects/with-stats');

  return data;
}

export async function unblockKeywords(
  projectId: string,
  keywordIds: number[]
): Promise<UnblockKeywordsResponse> {
  const data = await request<UnblockKeywordsResponse>('post', `/api/projects/${projectId}/unblock`, {
    keywordIds,
  });

  invalidateCache(`/api/projects/${projectId}/keywords`);
  invalidateCache(`/api/projects/${projectId}/stats`);
  invalidateCache('/api/projects/with-stats');

  return data;
}

export async function getBlockTokenCount(
  projectId: string,
  tokenToBlock: string
): Promise<{ count: number }> {
  return request<{ count: number }>(
    'get',
    `/api/projects/${projectId}/block-token-count?token=${encodeURIComponent(tokenToBlock)}`,
    undefined,
    undefined
  );
}

// ============================================================================
// Confirmation Operations
// ============================================================================

export async function confirmKeywords(
  projectId: string,
  keywordIds: number[]
): Promise<ConfirmationResponse> {
  const data = await request<ConfirmationResponse>('post', `/api/projects/${projectId}/confirm`, {
    keywordIds,
  });

  invalidateCache(`/api/projects/${projectId}/keywords`);
  invalidateCache(`/api/projects/${projectId}/stats`);
  invalidateCache('/api/projects/with-stats');

  return data;
}

export async function unconfirmKeywords(
  projectId: string,
  keywordIds: number[]
): Promise<ConfirmationResponse> {
  const data = await request<ConfirmationResponse>('post', `/api/projects/${projectId}/unconfirm`, {
    keywordIds,
  });

  invalidateCache(`/api/projects/${projectId}/keywords`);
  invalidateCache(`/api/projects/${projectId}/stats`);
  invalidateCache('/api/projects/with-stats');

  return data;
}

// ============================================================================
// Export Operations
// ============================================================================

export { exportGroupedKeywords, exportParentKeywords, importParentKeywords } from './csv';
