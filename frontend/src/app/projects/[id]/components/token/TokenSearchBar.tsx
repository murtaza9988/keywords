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
      <div className="relative flex-grow min-w-[200px]">
        <input
          type="text"
          placeholder="Search tokens..."
          value={searchTerm}
          onChange={onSearchChange}
          className="w-full pl-8 pr-20 py-2 text-ui-body border border-border rounded-md bg-white shadow-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-all duration-200 hover:border-gray-400"
        />
        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted" />
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center">
          {searchTerm && (
            <>
              <button 
                onClick={onCreateToken}
                className="p-1 mr-1 text-blue-600 hover:text-blue-700 hover:cursor-pointer"
                title="Create token from search term"
              >
                <PlusCircle className="h-4 w-4" />
              </button>
              <button onClick={onClearSearch} className="p-1">
                <X className="h-4 w-4 text-muted hover:text-foreground" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
