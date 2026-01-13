/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import FileUploader from './FileUploader';
import ProcessingProgressBar from './ProcessingProgressBar';
import { Loader2 } from 'lucide-react';
import { ActiveKeywordView, ProcessingStatus } from './types';
import apiClient from '@/lib/apiClient';
import { debounce } from 'lodash';

interface FiltersSectionProps {
  projectIdStr: string;
  isUploading: boolean;
  processingStatus: ProcessingStatus;
  includeFilter: string;
  excludeFilter: string;
  groupName: string;
  activeView: ActiveKeywordView;
  selectedKeywordIds: Set<number>;
  isProcessingAction: boolean;
  selectedTokens: string[];
  handleUploadStart: (totalFiles: number) => void;
  handleUploadSuccess: (status: ProcessingStatus, message?: string, fileName?: string) => void;
  handleUploadError: (message: string, fileName?: string) => void;
  handleUploadComplete: (summary: { totalFiles: number; successCount: number; failureCount: number }) => void;
  handleIncludeFilterChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleExcludeFilterChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setGroupName: (value: string) => void;
  handleGroupKeywords: () => void;
  handleUngroupKeywords: () => void;
  handleUnblockKeywords: () => void;
  removeToken: (token: string) => void;
  handleClearAllFilters: () => void;
  processingProgress?: number;
  processingStage?: string;
  processingQueueLength?: number;
  processingCurrentFile?: string;
  setIncludeMatchType: (value: 'any' | 'all') => void;
  setExcludeMatchType: (value: 'any' | 'all') => void;
  includeMatchType: 'any' | 'all';
  excludeMatchType: 'any' | 'all';
  handleConfirmKeywords?: () => void;
  handleUnconfirmKeywords?: () => void;
}

export const FiltersSection: React.FC<FiltersSectionProps> = ({
  projectIdStr,
  isUploading,
  processingStatus,
  includeFilter,
  excludeFilter,
  groupName,
  activeView,
  selectedKeywordIds,
  isProcessingAction,
  selectedTokens,
  handleUploadStart,
  handleUploadSuccess,
  handleUploadError,
  handleUploadComplete,
  handleIncludeFilterChange,
  handleExcludeFilterChange,
  setGroupName,
  handleGroupKeywords,
  handleUngroupKeywords,
  handleUnblockKeywords,
  removeToken,
  handleClearAllFilters,
  setIncludeMatchType,
  setExcludeMatchType,
  includeMatchType,
  excludeMatchType,
  handleConfirmKeywords,
  handleUnconfirmKeywords,
  processingProgress,
  processingStage,
  processingQueueLength,
  processingCurrentFile
}) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const suggestionRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [localIncludeFilter, setLocalIncludeFilter] = useState(includeFilter);
  const [localExcludeFilter, setLocalExcludeFilter] = useState(excludeFilter);
  const includeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const excludeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isConfirmButtonVisible = activeView === 'grouped';
  const isUnconfirmButtonVisible = activeView === 'confirmed';

  useEffect(() => {
    setLocalIncludeFilter(includeFilter);
  }, [includeFilter]);
  
  useEffect(() => {
    setLocalExcludeFilter(excludeFilter);
  }, [excludeFilter]);

  const isGroupButtonVisible = activeView === 'ungrouped' || activeView === 'grouped';
  const isUngroupButtonVisible = activeView === 'grouped';
  const isUnblockButtonVisible = activeView === 'blocked';

  const isProcessing = processingStatus === 'queued' || processingStatus === 'processing';
  const showLoader = isUploading || isProcessing;
  
  const [debouncedFetchSuggestions] = useState(() => 
    debounce((query: string) => {
      fetchSuggestions(query);
    }, 300)
  );

  const fetchSuggestions = useCallback(async (query: string) => {
    if (!projectIdStr || query.length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    
    try {
      setIsLoadingSuggestions(true);
      const results = await apiClient.fetchGroupNameSuggestions(projectIdStr, query);
      setSuggestions(results);
      setShowSuggestions(true);
    } catch (error) {
      console.error('Error fetching group name suggestions:', error);
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, [projectIdStr]);

  const handleGroupNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setGroupName(value);
    
    if (value.length >= 1) {
      debouncedFetchSuggestions(value);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleLocalIncludeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalIncludeFilter(newValue);
    if (includeTimerRef.current) {
      clearTimeout(includeTimerRef.current);
      includeTimerRef.current = null;
    }
    if (newValue.length >= 1 || newValue.length === 0) {
      includeTimerRef.current = setTimeout(() => {
        const syntheticEvent = {
          target: { value: newValue }
        } as React.ChangeEvent<HTMLInputElement>;
        
        handleIncludeFilterChange(syntheticEvent);
      }, 400);
    }
  };
  
  const handleLocalExcludeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalExcludeFilter(newValue);
    if (excludeTimerRef.current) {
      clearTimeout(excludeTimerRef.current);
      excludeTimerRef.current = null;
    }
    if (newValue.length >= 1 || newValue.length === 0) {
      excludeTimerRef.current = setTimeout(() => {
        const syntheticEvent = {
          target: { value: newValue }
        } as React.ChangeEvent<HTMLInputElement>;
        
        handleExcludeFilterChange(syntheticEvent);
      }, 400);
    }
  };
  
  const clearIncludeFilter = () => {
    setLocalIncludeFilter('');
    const syntheticEvent = {
      target: { value: '' }
    } as React.ChangeEvent<HTMLInputElement>;
    handleIncludeFilterChange(syntheticEvent);
  };
  
  const clearExcludeFilter = () => {
    setLocalExcludeFilter('');
    const syntheticEvent = {
      target: { value: '' }
    } as React.ChangeEvent<HTMLInputElement>;
    handleExcludeFilterChange(syntheticEvent);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setGroupName(suggestion);
    setShowSuggestions(false);
    if (inputRef.current) {
      inputRef.current.blur();
    }
  };

  useEffect(() => {
    return () => {
      if (includeTimerRef.current) {
        clearTimeout(includeTimerRef.current);
      }
      if (excludeTimerRef.current) {
        clearTimeout(excludeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionRef.current && 
        !suggestionRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="flex flex-col gap-1 shrink-0">
      <div className="flex flex-wrap items-center gap-4 pb-5 bg-gray-50 p-2">
        <div className="flex flex-col">
          <label className="block text-[13px] font-light mb-1 text-gray-800">Upload Csv:</label>
          <div className="flex items-center [100px]">
            <FileUploader
              projectId={projectIdStr}
              onUploadStart={handleUploadStart}
              onUploadSuccess={handleUploadSuccess}
              onUploadError={handleUploadError}
              onUploadComplete={handleUploadComplete}
            />
          </div>
        </div>
        <div className="min-w-[200px] flex flex-col">
          <label htmlFor="includeFilter" className="block text-[13px] font-light text-gray-800 mb-1">Include:</label>
          <div className="flex items-center gap-2">
            <select
              value={includeMatchType}
              onChange={(e) => setIncludeMatchType(e.target.value as 'any' | 'all')}
              className="p-2 border border-[#d1d1d1] rounded-md text-[13px] bg-white text-gray-800 shadow-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-all duration-200 appearance-none cursor-pointer hover:border-gray-400"
            >
              <option value="any">Any</option>
              <option value="all">All</option>
            </select>
            <input
              id="includeFilter"
              type="text"
              placeholder="Contains... (e.g., improve,increase)"
              value={localIncludeFilter}
              onChange={handleLocalIncludeChange}
              className="flex-1 p-2 border border-[#d1d1d1] rounded-md text-[13px] bg-white text-gray-800 shadow-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-all duration-200 hover:border-gray-400"
            />
          </div>
        </div>
        <div className="min-w-[180px] flex flex-col">
          <label htmlFor="excludeFilter" className="block text-[13px] font-light text-gray-800 mb-1">Exclude:</label>
          <div className="flex items-center gap-2">
            <select
              value={excludeMatchType}
              onChange={(e) => setExcludeMatchType(e.target.value as 'any' | 'all')}
              className="p-2 border border-[#d1d1d1] rounded-md text-[13px] bg-white text-gray-800 shadow-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-all duration-200 appearance-none cursor-pointer hover:border-gray-400"
            >
              <option value="any">Any</option>
              <option value="all">All</option>
            </select>
            <input
              id="excludeFilter"
              type="text"
              placeholder="Not contain... (e.g., slow,delay)"
              value={localExcludeFilter}
              onChange={handleLocalExcludeChange}
              className="flex-1 p-2 border border-[#d1d1d1] rounded-md text-[13px] bg-white text-gray-800 shadow-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-all duration-200 hover:border-gray-400"
            />
          </div>
        </div>
        <div className="min-w-[180px] flex flex-col relative">
          <label htmlFor="groupNameInput" className="block text-[13px]  text-gray-800 mb-1">Group Name:</label>
          <div className="flex gap-1 items-end">
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                id="groupNameInput"
                type="text"
                placeholder="Enter group name..."
                value={groupName}
                onChange={handleGroupNameChange}
                onFocus={() => {
                  if (groupName.length >= 1) {
                    fetchSuggestions(groupName);
                    setShowSuggestions(true);
                  }
                }}
                disabled={selectedKeywordIds.size === 0 || isProcessingAction}
                className="w-full p-2 border border-[#d1d1d1] rounded-md text-[13px] bg-white text-gray-800 shadow-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-all duration-200 hover:border-gray-400"
              />
              {showSuggestions && (
                <div 
                  ref={suggestionRef}
                  className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-52 overflow-y-auto"
                >
                  {isLoadingSuggestions ? (
                    <div className="flex items-center justify-center p-2">
                      <Loader2 size={16} className="animate-spin mr-2" />
                      <span>Loading...</span>
                    </div>
                  ) : suggestions.length > 0 ? (
                    suggestions.map((suggestion, index) => (
                      <div
                        key={index}
                        className="px-3 py-2 cursor-pointer hover:bg-blue-50 text-[13px]"
                        onClick={() => handleSuggestionClick(suggestion)}
                      >
                        {suggestion}
                      </div>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-gray-500 text-[13px]">No matching groups found</div>
                  )}
                </div>
              )}
            </div>
            {isGroupButtonVisible && (
              <button
                onClick={handleGroupKeywords}
                disabled={selectedKeywordIds.size === 0 || !groupName.trim() || isProcessingAction}
                className="bg-blue-600 cursor-pointer text-white px-2 py-1.5 border border-[#d1d1d1] rounded-md text-[13px] shadow-sm hover:bg-blue-700 transition-all duration-200 disabled:bg-gray-400 disabled:shadow-none"
              >
                Group
              </button>
            )}
            {isConfirmButtonVisible && (
              <button
                onClick={handleConfirmKeywords}
                disabled={selectedKeywordIds.size === 0 || isProcessingAction}
                className="bg-green-600 cursor-pointer text-white px-1 py-1.5 rounded-md text-[13px] shadow-sm hover:bg-green-700 transition-all duration-200 disabled:bg-gray-400 disabled:shadow-none"
              >
                Confirm
              </button>
            )}
            <button
              onClick={
                isUngroupButtonVisible
                  ? handleUngroupKeywords
                  : isUnconfirmButtonVisible
                    ? handleUnconfirmKeywords
                    : isUnblockButtonVisible
                      ? handleUnblockKeywords
                      : undefined
              }
              disabled={(!isUngroupButtonVisible && !isUnconfirmButtonVisible && !isUnblockButtonVisible) || selectedKeywordIds.size === 0 || isProcessingAction}
              className="bg-yellow-500 cursor-pointer text-white px-1 py-1.5 rounded-md text-[13px] shadow-sm hover:bg-yellow-600 transition-all duration-200 disabled:bg-gray-400 disabled:shadow-none"
            >
              {isProcessingAction && (isUngroupButtonVisible || isUnconfirmButtonVisible || isUnblockButtonVisible) ? (
                "Processing..."
              ) : isUngroupButtonVisible ? (
                "Ungroup"
              ) : isUnconfirmButtonVisible ? (
                "Unconfirm"
              ) : isUnblockButtonVisible ? (
                "Unblock"
              ) : (
                "Action"
              )}
            </button>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {showLoader && (
          <div className="flex items-center text-blue-600 h-6">
            <div className="flex items-center">
              <Loader2 size={16} className="animate-spin mr-2" />
              <span className="text-xs">
                {isUploading ? "Uploading..." : "Processing..."}
              </span>
            </div>
          </div>
        )}
        <ProcessingProgressBar
          status={processingStatus}
          progress={processingProgress || 0}
          stage={processingStage}
          currentFile={processingCurrentFile}
          queueLength={processingQueueLength}
        />
        {processingStatus === 'error' && !isUploading && !isProcessing && (
          <div className="text-red-600 h-6 flex items-center">
            Processing failed. Try uploading again.
          </div>
        )}
        <div className="flex items-center gap-x-3 min-h-[32px] flex-wrap">
          <span className="text-[13px] font-light text-gray-800 uppercase mr-2 shrink-0">Filters:</span>
          {selectedTokens.map(token => (
            <span key={`f-${token}`} className="inline-flex items-center px-2 rounded-full text-[13px] bg-gray-600 text-white m-1 shadow-sm">
              T: {token} <button onClick={() => removeToken(token)} className="cursor-pointer ml-1.5 opacity-70 hover:opacity-100">×</button>
            </span>
          ))}
          {includeFilter && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[13px] bg-green-100 text-green-800 m-1 shadow-sm">
              Inc ({includeMatchType}): {includeFilter} <button onClick={clearIncludeFilter} className="cursor-pointer ml-1.5 opacity-70 hover:opacity-100">×</button>
            </span>
          )}
          {excludeFilter && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[13px] bg-red-100 text-red-800 m-1 shadow-sm">
              Exc ({excludeMatchType}): {excludeFilter} <button onClick={clearExcludeFilter} className="cursor-pointer ml-1.5 opacity-70 hover:opacity-100">×</button>
            </span>
          )}
          {(selectedTokens.length > 0 || includeFilter || excludeFilter) && (
            <button onClick={handleClearAllFilters} className="cursor-pointer text-[13px] text-blue-600 hover:underline ml-auto px-2 py-1 shrink-0 transition-all duration-200 hover:text-blue-800">Clear All</button>
          )}
        </div>
      </div>
    </div>
  );
};
