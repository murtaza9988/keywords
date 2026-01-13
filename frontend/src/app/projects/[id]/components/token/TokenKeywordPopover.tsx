/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { TokenData } from '../types';

interface TokenKeywordPopoverProps {
  token: TokenData;
  getTopKeywords: (token: TokenData) => any[];
  index: number;
}

export function TokenKeywordPopover({ token, getTopKeywords, index }: TokenKeywordPopoverProps) {
  const topKeywords = getTopKeywords(token);
  
  return (
    <div
      className={`absolute z-[1000] left-0 bg-white border border-gray-200 rounded-md shadow-lg p-2 max-h-[300px] overflow-y-auto ${
        index < 4 ? 'top-full mt-1' : 'bottom-full mb-1'
      }`}
    >
      <table className="text-xs">
        <thead>
          <tr>
            <th className="px-2 py-1 text-left font-medium text-gray-600">Keyword</th>
            <th className="px-2 py-1 text-right font-medium text-gray-600">LEN</th>
            <th className="px-2 py-1 text-right font-medium text-gray-600">Vol.</th>
            <th className="px-2 py-1 text-right font-medium text-gray-600">Diff.</th>
          </tr>
        </thead>
        <tbody>
          {topKeywords.length > 0 ? (
            topKeywords.map((keyword, idx) => (
              <tr key={idx} className="border-t border-gray-100">
                <td className="px-2 py-1 text-left text-gray-800">{keyword.tokenName}</td>
                <td className="px-2 py-1 text-right text-gray-600">
                  {keyword.tokenName?.length ?? 'N/A'}
                </td>
                <td className="px-2 py-1 text-right text-gray-600">
                  {keyword.volume?.toLocaleString() ?? 'N/A'}
                </td>
                <td className="px-2 py-1 text-right text-gray-600">
                  {keyword.difficulty != null ? Number(keyword.difficulty).toFixed(2) : 'N/A'}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={4} className="px-2 py-1 text-center text-gray-500">
                No keywords found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}