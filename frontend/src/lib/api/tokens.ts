/**
 * Tokens API module
 * Handles all token-related API operations including blocking, merging, and creation
 */
import type { TokenListResponse, BlockTokenResponse } from '../types';
import { request, invalidateCache } from './client';
import type { ApiTokenOperationResponse, ApiCreateTokenResponse } from './types';

// ============================================================================
// Token Fetching
// ============================================================================

export async function fetchTokens(
  projectId: string,
  queryParams: URLSearchParams,
  useCache = false
): Promise<TokenListResponse> {
  const url = `/api/projects/${projectId}/tokens?${queryParams.toString()}`;
  const data = await request<TokenListResponse>('get', url, undefined, undefined, useCache);
  return {
    tokens: data.tokens || [],
    pagination: data.pagination || { total: 0, page: 1, limit: 100, pages: 0 },
  };
}

// ============================================================================
// Token Blocking Operations
// ============================================================================

export async function blockTokens(projectId: string, tokens: string[]): Promise<BlockTokenResponse> {
  const data = await request<BlockTokenResponse>('post', `/api/projects/${projectId}/block-tokens`, {
    tokens,
  });

  invalidateCache(`/api/projects/${projectId}/keywords`);
  invalidateCache(`/api/projects/${projectId}/stats`);
  invalidateCache('/api/projects/with-stats');

  return data;
}

export async function unblockTokens(projectId: string, tokens: string[]): Promise<BlockTokenResponse> {
  const data = await request<BlockTokenResponse>('post', `/api/projects/${projectId}/unblock-tokens`, {
    tokens,
  });

  invalidateCache(`/api/projects/${projectId}/keywords`);
  invalidateCache(`/api/projects/${projectId}/stats`);
  invalidateCache('/api/projects/with-stats');

  return data;
}

// ============================================================================
// Token Merge Operations
// ============================================================================

export async function mergeTokens(
  projectId: string,
  parentToken: string,
  childTokens: string[]
): Promise<ApiTokenOperationResponse> {
  const data = await request<ApiTokenOperationResponse>(
    'post',
    `/api/projects/${projectId}/merge-tokens`,
    {
      parent_token: parentToken,
      child_tokens: childTokens,
    }
  );

  invalidateCache(`/api/projects/${projectId}/tokens`);
  invalidateCache(`/api/projects/${projectId}/keywords`);
  invalidateCache(`/api/projects/${projectId}/stats`);
  invalidateCache('/api/projects/with-stats');

  return data;
}

export async function unmergeToken(
  projectId: string,
  tokenName: string
): Promise<ApiTokenOperationResponse> {
  const data = await request<ApiTokenOperationResponse>(
    'post',
    `/api/projects/${projectId}/unmerge-token`,
    {
      tokenName,
    }
  );

  invalidateCache(`/api/projects/${projectId}/tokens`);
  invalidateCache(`/api/projects/${projectId}/keywords`);
  invalidateCache(`/api/projects/${projectId}/stats`);
  invalidateCache('/api/projects/with-stats');

  return data;
}

export async function unmergeIndividualToken(
  projectId: string,
  parentToken: string,
  childToken: string
): Promise<ApiTokenOperationResponse> {
  const data = await request<ApiTokenOperationResponse>(
    'post',
    `/api/projects/${projectId}/unmerge-individual-token?parent_token=${encodeURIComponent(parentToken)}&child_token=${encodeURIComponent(childToken)}`,
    undefined,
    undefined
  );

  invalidateCache(`/api/projects/${projectId}/tokens`);
  invalidateCache(`/api/projects/${projectId}/keywords`);
  invalidateCache(`/api/projects/${projectId}/stats`);
  invalidateCache('/api/projects/with-stats');

  return data;
}

// ============================================================================
// Token Creation
// ============================================================================

export async function createToken(
  projectId: string,
  searchTerm: string,
  tokenName: string
): Promise<ApiCreateTokenResponse> {
  const data = await request<ApiCreateTokenResponse>('post', `/api/projects/${projectId}/create-token`, {
    search_term: searchTerm,
    token_name: tokenName,
  });

  invalidateCache(`/api/projects/${projectId}/tokens`);
  invalidateCache(`/api/projects/${projectId}/keywords`);
  invalidateCache(`/api/projects/${projectId}/stats`);
  invalidateCache('/api/projects/with-stats');

  return data;
}
