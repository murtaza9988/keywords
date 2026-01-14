import type { ChangeEvent, Dispatch, SetStateAction } from 'react';

import type {
  Keyword,
  PaginationInfo,
  TokenActiveView,
  TokenData,
  TokenKeywordSummary,
  TokenSortParams,
} from '../types';

export type {
  Keyword,
  PaginationInfo,
  TokenActiveView,
  TokenData,
  TokenKeywordSummary,
  TokenSortParams,
};

export interface TokenManagementProps {
  projectId: string;
  onBlockTokenSuccess: () => void;
  onUnblockTokenSuccess: () => void;
  onTokenDataChange: () => void;
  addSnackbarMessage: (text: string, type: 'success' | 'error' | 'info') => void;
  activeViewKeywords: TokenData[];
  toggleTokenSelection: (token: string) => void;
  activeView: 'ungrouped' | 'grouped' | 'blocked';
}

export interface TokenMergePanelProps {
  isProcessingAction: boolean;
  selectedTokensCount: number;
  onBlockSelected: () => void;
  onUnblockSelected: () => void;
  onMergeSelected: () => void;
  isBlockedView: boolean;
  activeView: TokenActiveView;
  onViewChange: (view: TokenActiveView) => void;
  limit: number;
  limitOptions: number[];
  onLimitChange: (event: ChangeEvent<HTMLSelectElement>) => void;
}

export interface UseTokenManagementParams {
  projectId: string;
  onBlockTokenSuccess: () => void;
  onUnblockTokenSuccess: () => void;
  onTokenDataChange: () => void;
  addSnackbarMessage: (text: string, type: 'success' | 'error' | 'info') => void;
  activeViewKeywords: TokenData[];
  toggleTokenSelection: (token: string) => void;
  activeView: 'ungrouped' | 'grouped' | 'blocked';
}

export interface UseTokenManagementResult {
  activeTokenView: TokenActiveView;
  tokens: TokenData[];
  pagination: PaginationInfo;
  sortParams: TokenSortParams;
  searchTerm: string;
  showMinimumCharInfo: boolean;
  isLoading: boolean;
  isProcessingAction: boolean;
  selectedTokenNames: Set<string>;
  expandedTokens: Set<string>;
  hoveredToken: string | null;
  showCreateToken: boolean;
  newTokenName: string;
  isCreatingToken: boolean;
  handleSearchChange: (event: ChangeEvent<HTMLInputElement>) => void;
  handleClearSearch: () => void;
  handleMergeSelected: () => Promise<void>;
  handleViewChange: (view: TokenActiveView) => void;
  handlePageChange: (newPage: number) => void;
  handleLimitChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  handleSelectAllClick: (event: ChangeEvent<HTMLInputElement>) => void;
  toggleLocalTokenSelection: (tokenName: string) => void;
  toggleTokenExpansion: (tokenName: string) => void;
  handleBlockSelected: () => Promise<void>;
  handleUnblockSelected: () => Promise<void>;
  handleBlockSingleToken: (tokenName: string) => Promise<void>;
  handleCreateToken: () => void;
  handleConfirmCreateToken: () => Promise<void>;
  handleCancelCreateToken: () => void;
  handleUnblockSingleToken: (tokenName: string) => Promise<void>;
  handleUnmergeToken: (tokenName: string) => Promise<void>;
  handleSort: (column: string) => void;
  handleTokenClick: (tokenName: string) => void;
  getTopKeywords: (token: TokenData) => TokenKeywordSummary[];
  handleUnmergeIndividualToken: (parentToken: string, childToken: string) => Promise<void>;
  setHoveredToken: Dispatch<SetStateAction<string | null>>;
  setNewTokenName: Dispatch<SetStateAction<string>>;
}
