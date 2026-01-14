import apiClient from '@/lib/apiClient';
import type {
  BlockTokenResponse,
  ConfirmationResponse,
  FetchKeywordsResponse,
  GroupKeywordsResponse,
  InitialDataResponse,
  KeywordChildrenData,
  ProcessingStatusResponse,
  UnblockKeywordsResponse,
} from '@/lib/types';

export const fetchKeywords = (
  projectId: string,
  queryParams: URLSearchParams,
  useCache = false
): Promise<FetchKeywordsResponse> =>
  apiClient.fetchKeywords(projectId, queryParams, useCache);

export const fetchInitialData = (projectId: string): Promise<InitialDataResponse> =>
  apiClient.fetchInitialData(projectId) as Promise<InitialDataResponse>;

export const fetchKeywordChildren = (
  projectId: string,
  groupId: string
): Promise<KeywordChildrenData> => apiClient.fetchChildren(projectId, groupId);

export const exportGroupedKeywords = (projectId: string, view?: string): Promise<Blob> =>
  apiClient.exportGroupedKeywords(projectId, view);

export const exportParentKeywords = (projectId: string): Promise<Blob> =>
  apiClient.exportParentKeywords(projectId);

export const importParentKeywords = (projectId: string, formData: FormData): Promise<unknown> =>
  apiClient.importParentKeywords(projectId, formData);

export const blockToken = (projectId: string, token: string): Promise<BlockTokenResponse> =>
  apiClient.blockToken(projectId, token);

export const confirmKeywords = (
  projectId: string,
  keywordIds: number[]
): Promise<ConfirmationResponse> => apiClient.confirmKeywords(projectId, keywordIds);

export const unconfirmKeywords = (
  projectId: string,
  keywordIds: number[]
): Promise<ConfirmationResponse> => apiClient.unconfirmKeywords(projectId, keywordIds);

export const groupKeywords = (
  projectId: string,
  keywordIds: number[],
  groupName: string
): Promise<GroupKeywordsResponse> => apiClient.groupKeywords(projectId, keywordIds, groupName);

export const regroupKeywords = (
  projectId: string,
  keywordIds: number[],
  groupName: string
): Promise<GroupKeywordsResponse> => apiClient.regroupKeywords(projectId, keywordIds, groupName);

export const ungroupKeywords = (
  projectId: string,
  keywordIds: number[]
): Promise<UnblockKeywordsResponse> => apiClient.ungroupKeywords(projectId, keywordIds);

export const unblockKeywords = (
  projectId: string,
  keywordIds: number[]
): Promise<UnblockKeywordsResponse> => apiClient.unblockKeywords(projectId, keywordIds);

export const checkProcessingStatus = (projectId: string): Promise<ProcessingStatusResponse> =>
  apiClient.checkProcessingStatus(projectId);
