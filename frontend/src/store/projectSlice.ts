import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Project, Keyword, ActiveKeywordView, ProjectMetadata, ProjectState, NormalizedKeywordsState } from '../lib/types';
import { createSelector } from 'reselect';

// Helper to create empty normalized state for a project
const createEmptyNormalizedState = (): NormalizedKeywordsState => ({
  byId: {},
  viewIds: {
    ungrouped: [],
    grouped: [],
    confirmed: [],
    blocked: [],
  },
  childrenByGroupId: {},
  sortedCacheKeys: {
    ungrouped: {},
    grouped: {},
    confirmed: {},
    blocked: {},
  },
  filteredCacheKeys: {
    ungrouped: {},
    grouped: {},
    confirmed: {},
    blocked: {},
  },
});

// Helper to ensure project state exists
const ensureProjectState = (state: ProjectState, projectId: string): NormalizedKeywordsState => {
  if (!state.byProject[projectId]) {
    state.byProject[projectId] = createEmptyNormalizedState();
  }
  return state.byProject[projectId];
};

// Helper to normalize keywords array into byId map and return IDs
const normalizeKeywords = (keywords: Keyword[]): { byId: Record<number, Keyword>; ids: number[] } => {
  const byId: Record<number, Keyword> = {};
  const ids: number[] = [];
  for (const keyword of keywords) {
    byId[keyword.id] = keyword;
    ids.push(keyword.id);
  }
  return { byId, ids };
};

const initialState: ProjectState = {
  projects: [],
  byProject: {},
  metaData: {},
  stats: {}
};

const projectSlice = createSlice({
  name: 'project',
  initialState,
  reducers: {
    setProjects: (state, action: PayloadAction<Project[]>) => {
      state.projects = action.payload;
    },

    setKeywordsForView: (state, action: PayloadAction<{
      projectId: string;
      view: ActiveKeywordView;
      keywords: Keyword[];
      totalCount?: number;
    }>) => {
      const { projectId, view, keywords, totalCount } = action.payload;
      const projectState = ensureProjectState(state, projectId);

      // Normalize keywords
      const { byId, ids } = normalizeKeywords(keywords);

      // Merge into byId (don't replace, in case other views have the same keywords)
      Object.assign(projectState.byId, byId);

      // Update view IDs
      projectState.viewIds[view] = ids;

      // Invalidate derived caches for this view
      projectState.sortedCacheKeys[view] = {};
      projectState.filteredCacheKeys[view] = {};

      if (totalCount !== undefined) {
        if (!state.metaData[projectId]) {
          state.metaData[projectId] = {};
        }
        state.metaData[projectId][`${view}Count`] = totalCount;
      }
    },

    setChildrenForGroup: (state, action: PayloadAction<{
      projectId: string;
      groupId: string;
      children: Keyword[];
    }>) => {
      const { projectId, groupId, children } = action.payload;
      const projectState = ensureProjectState(state, projectId);

      // Normalize and store children
      const { byId, ids } = normalizeKeywords(children);
      Object.assign(projectState.byId, byId);
      projectState.childrenByGroupId[groupId] = ids;
    },

    clearChildrenForGroup: (state, action: PayloadAction<{
      projectId: string;
      groupId: string;
    }>) => {
      const { projectId, groupId } = action.payload;
      const projectState = state.byProject[projectId];
      if (projectState) {
        delete projectState.childrenByGroupId[groupId];
      }
    },

    clearProjectKeywords: (state, action: PayloadAction<{
      projectId: string;
    }>) => {
      const { projectId } = action.payload;
      delete state.byProject[projectId];
      delete state.metaData[projectId];
    },

    addProject: (state, action: PayloadAction<Project>) => {
      if (!state.projects.some(p => p.id === action.payload.id)) {
        state.projects.push(action.payload);
        state.projects.sort((a, b) => a.name.localeCompare(b.name));
      }
    },

    removeProject: (state, action: PayloadAction<{
      projectId: number;
    }>) => {
      const { projectId } = action.payload;
      state.projects = state.projects.filter(p => p.id !== projectId);
      const projectIdStr = String(projectId);
      delete state.byProject[projectIdStr];
      delete state.metaData[projectIdStr];
      delete state.stats[projectIdStr];
    },

    updateProject: (state, action: PayloadAction<Project>) => {
      const index = state.projects.findIndex((p) => p.id === action.payload.id);
      if (index !== -1) {
        state.projects[index] = action.payload;
        state.projects.sort((a, b) => a.name.localeCompare(b.name));
      }
    },

    setCachedKeywords: (state, action: PayloadAction<{
      projectId: string;
      view: ActiveKeywordView;
      keywords: Keyword[];
      isComplete: boolean;
    }>) => {
      const { projectId, view, keywords, isComplete } = action.payload;
      const projectState = ensureProjectState(state, projectId);

      const { byId, ids } = normalizeKeywords(keywords);

      if (!projectState.viewIds[view].length || isComplete) {
        // Replace
        Object.assign(projectState.byId, byId);
        projectState.viewIds[view] = ids;
      } else {
        // Append new keywords only
        const existingIds = new Set(projectState.viewIds[view]);
        const newIds = ids.filter(id => !existingIds.has(id));
        Object.assign(projectState.byId, byId);
        projectState.viewIds[view] = [...projectState.viewIds[view], ...newIds];
      }

      // Invalidate derived caches
      projectState.sortedCacheKeys[view] = {};
      projectState.filteredCacheKeys[view] = {};
    },

    setCachedSortedKeywords: (state, action: PayloadAction<{
      projectId: string;
      view: ActiveKeywordView;
      sortKey: string;
      sortDirection: 'asc' | 'desc';
      keywords: Keyword[];
    }>) => {
      const { projectId, view, sortKey, sortDirection, keywords } = action.payload;
      const projectState = ensureProjectState(state, projectId);

      // Normalize and store
      const { byId, ids } = normalizeKeywords(keywords);
      Object.assign(projectState.byId, byId);

      const cacheKey = `${sortKey}-${sortDirection}`;
      projectState.sortedCacheKeys[view][cacheKey] = ids;
    },

    setProjectStats: (state, action: PayloadAction<{
      projectId: string;
      stats: {
        ungroupedCount: number;
        groupedKeywordsCount: number;
        groupedPages: number;
        confirmedKeywordsCount?: number;
        confirmedPages?: number;
        blockedCount: number;
        totalKeywords: number;
        totalParentKeywords?: number;
        totalChildKeywords?: number;
        groupCount?: number;
        parentTokenCount?: number;
        childTokenCount?: number;
        ungroupedPercent: number;
        groupedPercent: number;
        confirmedPercent?: number;
        blockedPercent: number;
      }
    }>) => {
      const { projectId, stats } = action.payload;
      state.stats[projectId] = stats;
    },

    setCachedFilteredKeywords: (state, action: PayloadAction<{
      projectId: string;
      view: ActiveKeywordView;
      filterKey: string;
      keywords: Keyword[];
    }>) => {
      const { projectId, view, filterKey, keywords } = action.payload;
      const projectState = ensureProjectState(state, projectId);

      // Normalize and store
      const { byId, ids } = normalizeKeywords(keywords);
      Object.assign(projectState.byId, byId);

      projectState.filteredCacheKeys[view][filterKey] = ids;
    },

    updateKeyword: (state, action: PayloadAction<{
      projectId: string;
      keyword: Keyword;
    }>) => {
      const { projectId, keyword } = action.payload;
      const projectState = state.byProject[projectId];

      if (projectState && projectState.byId[keyword.id]) {
        // Update single source of truth - no need to update multiple places!
        projectState.byId[keyword.id] = { ...projectState.byId[keyword.id], ...keyword };

        // Invalidate derived caches since keyword data changed
        projectState.sortedCacheKeys = {
          ungrouped: {},
          grouped: {},
          confirmed: {},
          blocked: {},
        };
        projectState.filteredCacheKeys = {
          ungrouped: {},
          grouped: {},
          confirmed: {},
          blocked: {},
        };
      }
    },

    setProjectMetadata: (state, action: PayloadAction<{
      projectId: string;
      metadata: ProjectMetadata;
    }>) => {
      const { projectId, metadata } = action.payload;

      if (!state.metaData[projectId]) {
        state.metaData[projectId] = {};
      }

      state.metaData[projectId] = {
        ...state.metaData[projectId],
        ...metadata
      };
    },

    clearCaches: (state, action: PayloadAction<{
      projectId?: string;
      view?: ActiveKeywordView;
    }>) => {
      const { projectId, view } = action.payload;

      if (projectId) {
        const projectState = state.byProject[projectId];
        if (projectState) {
          if (view) {
            projectState.sortedCacheKeys[view] = {};
            projectState.filteredCacheKeys[view] = {};
          } else {
            projectState.sortedCacheKeys = {
              ungrouped: {},
              grouped: {},
              confirmed: {},
              blocked: {},
            };
            projectState.filteredCacheKeys = {
              ungrouped: {},
              grouped: {},
              confirmed: {},
              blocked: {},
            };
          }
        }
      } else {
        // Clear all project caches
        for (const pid of Object.keys(state.byProject)) {
          const projectState = state.byProject[pid];
          projectState.sortedCacheKeys = {
            ungrouped: {},
            grouped: {},
            confirmed: {},
            blocked: {},
          };
          projectState.filteredCacheKeys = {
            ungrouped: {},
            grouped: {},
            confirmed: {},
            blocked: {},
          };
        }
      }
    }
  },
});

// Base selectors
const selectProjectState = (state: { project: ProjectState }) => state.project;
const selectByProject = (state: { project: ProjectState }) => state.project.byProject;

export const selectProjects = createSelector(
  [selectProjectState],
  (project) => project.projects
);

// Memoized selector for keywords by view - derives from single source of truth
export const selectKeywordsForView = createSelector(
  [
    selectByProject,
    (_: unknown, projectId: string) => projectId,
    (_: unknown, _pid: string, view: ActiveKeywordView) => view
  ],
  (byProject, projectId, view): Keyword[] => {
    const projectState = byProject[projectId];
    if (!projectState) return [];

    const ids = projectState.viewIds[view];
    return ids.map(id => projectState.byId[id]).filter(Boolean);
  }
);

// Memoized selector for children of a group
export const selectChildrenForGroup = createSelector(
  [
    selectByProject,
    (_: unknown, projectId: string) => projectId,
    (_: unknown, _pid: string, groupId: string) => groupId
  ],
  (byProject, projectId, groupId): Keyword[] => {
    const projectState = byProject[projectId];
    if (!projectState) return [];

    const ids = projectState.childrenByGroupId[groupId];
    if (!ids) return [];

    return ids.map(id => projectState.byId[id]).filter(Boolean);
  }
);

// Alias for backward compatibility
export const selectCachedKeywords = selectKeywordsForView;

// Memoized selector for sorted keywords cache
export const selectCachedSortedKeywords = createSelector(
  [
    selectByProject,
    (_: unknown, projectId: string) => projectId,
    (_: unknown, _pid: string, view: ActiveKeywordView) => view,
    (_: unknown, _pid: string, _view: ActiveKeywordView, sortKey: string) => sortKey,
    (_: unknown, _pid: string, _view: ActiveKeywordView, _sk: string, sortDirection: 'asc' | 'desc') => sortDirection
  ],
  (byProject, projectId, view, sortKey, sortDirection): Keyword[] => {
    const projectState = byProject[projectId];
    if (!projectState) return [];

    const cacheKey = `${sortKey}-${sortDirection}`;
    const ids = projectState.sortedCacheKeys[view]?.[cacheKey];
    if (!ids) return [];

    return ids.map(id => projectState.byId[id]).filter(Boolean);
  }
);

// Memoized selector for filtered keywords cache
export const selectCachedFilteredKeywords = createSelector(
  [
    selectByProject,
    (_: unknown, projectId: string) => projectId,
    (_: unknown, _pid: string, view: ActiveKeywordView) => view,
    (_: unknown, _pid: string, _view: ActiveKeywordView, filterKey: string) => filterKey
  ],
  (byProject, projectId, view, filterKey): Keyword[] => {
    const projectState = byProject[projectId];
    if (!projectState) return [];

    const ids = projectState.filteredCacheKeys[view]?.[filterKey];
    if (!ids) return [];

    return ids.map(id => projectState.byId[id]).filter(Boolean);
  }
);

export const selectProjectMetadata = createSelector(
  [selectProjectState, (_: unknown, projectId: string) => projectId],
  (project, projectId) => project.metaData[projectId] || {}
);

export const selectProjectStats = createSelector(
  [selectProjectState, (_: unknown, projectId: string) => projectId],
  (project, projectId) => project.stats[projectId] || {}
);

// View-specific selectors (backward compatibility)
export const selectUngroupedKeywordsForProject = createSelector(
  [selectByProject, (_: unknown, projectId: string) => projectId],
  (byProject, projectId): Keyword[] => {
    const projectState = byProject[projectId];
    if (!projectState) return [];
    return projectState.viewIds.ungrouped.map(id => projectState.byId[id]).filter(Boolean);
  }
);

export const selectGroupedKeywordsForProject = createSelector(
  [selectByProject, (_: unknown, projectId: string) => projectId],
  (byProject, projectId): Keyword[] => {
    const projectState = byProject[projectId];
    if (!projectState) return [];
    return projectState.viewIds.grouped.map(id => projectState.byId[id]).filter(Boolean);
  }
);

export const selectBlockedKeywordsForProject = createSelector(
  [selectByProject, (_: unknown, projectId: string) => projectId],
  (byProject, projectId): Keyword[] => {
    const projectState = byProject[projectId];
    if (!projectState) return [];
    return projectState.viewIds.blocked.map(id => projectState.byId[id]).filter(Boolean);
  }
);

export const selectConfirmedKeywordsForProject = createSelector(
  [selectByProject, (_: unknown, projectId: string) => projectId],
  (byProject, projectId): Keyword[] => {
    const projectState = byProject[projectId];
    if (!projectState) return [];
    return projectState.viewIds.confirmed.map(id => projectState.byId[id]).filter(Boolean);
  }
);

export const selectChildrenCacheForProject = createSelector(
  [selectByProject, (_: unknown, projectId: string) => projectId],
  (byProject, projectId): Record<string, Keyword[]> => {
    const projectState = byProject[projectId];
    if (!projectState) return {};

    const result: Record<string, Keyword[]> = {};
    for (const [groupId, ids] of Object.entries(projectState.childrenByGroupId)) {
      result[groupId] = ids.map(id => projectState.byId[id]).filter(Boolean);
    }
    return result;
  }
);

export const selectProjectById = createSelector(
  [selectProjectState, (_: unknown, projectId: number) => projectId],
  (project, projectId) => project.projects.find((p) => p.id === projectId)
);

// Selector to get a single keyword by ID (useful for updates)
export const selectKeywordById = createSelector(
  [
    selectByProject,
    (_: unknown, projectId: string) => projectId,
    (_: unknown, _pid: string, keywordId: number) => keywordId
  ],
  (byProject, projectId, keywordId): Keyword | undefined => {
    const projectState = byProject[projectId];
    if (!projectState) return undefined;
    return projectState.byId[keywordId];
  }
);

export const {
  setProjects,
  setKeywordsForView,
  setChildrenForGroup,
  clearChildrenForGroup,
  clearProjectKeywords,
  addProject,
  removeProject,
  updateProject,
  setCachedKeywords,
  setCachedSortedKeywords,
  setCachedFilteredKeywords,
  updateKeyword,
  setProjectMetadata,
  clearCaches,
  setProjectStats,
} = projectSlice.actions;

export default projectSlice.reducer;
