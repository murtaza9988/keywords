import React from 'react';
import { Search, X, PlusCircle } from 'lucide-react';

interface TokenSearchBarProps {
  searchTerm: string;
  onSearchChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onClearSearch: () => void;
  onCreateToken: () => void;
}

export function TokenSearchBar({
  searchTerm,
  onSearchChange,
  onClearSearch,
  onCreateToken
}: TokenSearchBarProps) {
  return (
    <div className="flex flex-wrap gap-2 mb-3 items-center">
      <div className="relative flex-grow min-w-[200px] mb-3">
        <input
          type="text"
          placeholder="Search tokens..."
          value={searchTerm}
          onChange={onSearchChange}
          className="w-full pl-8 pr-20 py-1.5 text-xs border border-[#d1d1d1] rounded-md text-[13px] bg-white text-gray-800 shadow-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-all duration-200 appearance-none  hover:border-gray-400"
        />
        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center">
          {searchTerm && (
            <>
              <button 
                onClick={onCreateToken}
                className="p-1 mr-1 text-blue-500 hover:text-blue-700 hover:cursor-pointer"
                title="Create token from search term"
              >
                <PlusCircle className="h-4 w-4" />
              </button>
              <button onClick={onClearSearch} className="p-1">
                <X className="h-4 w-4 text-gray-500 hover:text-gray-700" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}