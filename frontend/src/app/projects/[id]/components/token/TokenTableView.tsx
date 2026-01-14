import React from 'react';
import { TokenActiveView } from '../types';

interface TokenViewTabsProps {
  activeView: TokenActiveView;
  onViewChange: (view: TokenActiveView) => void;
  limit: number;
  limitOptions: number[]; 
  onLimitChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
}

export function TokenViewTabs({
  activeView,
  onViewChange,
  limit,
  limitOptions,
  onLimitChange,
}: TokenViewTabsProps) {
  return (
    <div className="flex justify-between items-center mb-3">
      <div className="flex border border-border p-0.5 rounded bg-surface-muted">
        <nav className="-mb-px flex space-x-6">
          {(['current', 'all', 'blocked', 'merged'] as TokenActiveView[]).map(view => (
            <button
              key={view}
              onClick={() => onViewChange(view)}
              className={`py-1.5 px-1 text-[13px] font-medium cursor-pointer ${
                activeView === view
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-muted hover:text-foreground hover:border-border border-b-2 border-transparent'
              }`}
            >
              {view.charAt(0).toUpperCase() + view.slice(1)}
            </button>
          ))}
        </nav>
      </div>

      <div>
        <select
          value={limit}
          onChange={onLimitChange}
          className="border border-border rounded-md px-2 py-1.5 cursor-pointer bg-white text-[13px] text-foreground focus:ring-blue-500 focus:border-blue-500"
        >
          {limitOptions.map(option => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
