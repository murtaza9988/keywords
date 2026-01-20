/**
 * API barrel export
 * Re-exports all API modules for convenient importing
 */

// Core client utilities
export { request, invalidateCache, clearCache, getCachedData, setCachedData } from './client';

// Auth API
export { login } from './auth';

// Projects API
export {
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
} from './projects';

// Keywords API
export {
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
} from './keywords';

// Tokens API
export {
  fetchTokens,
  blockTokens,
  unblockTokens,
  mergeTokens,
  unmergeToken,
  unmergeIndividualToken,
  createToken,
} from './tokens';

// CSV API
export {
  fetchCSVUploads,
  downloadCSVUpload,
  uploadCSV,
  exportGroupedKeywords,
  exportParentKeywords,
  importParentKeywords,
} from './csv';

// Types
export * from './types';
