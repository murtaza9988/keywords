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
    <div className="flex justify-between items-center mb-3.5">
      <div className="flex border border-[#eaeaea] p-0.3 rounded bg-gray-50">
        <nav className="-mb-px flex space-x-8">
          {(['current', 'all', 'blocked', 'merged'] as TokenActiveView[]).map(view => (
            <button
              key={view}
              onClick={() => onViewChange(view)}
              className={`py-2 px-1 text-[13px] font-light cursor-pointer ${
                activeView === view
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-800 hover:text-gray-700 hover:border-gray-300 border-b-2 border-transparent'
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
          className="border border-gray-300 rounded-md p-1 cursor-pointer bg-white text-[13px] text-gray-800 focus:ring-blue-500 focus:border-blue-500"
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