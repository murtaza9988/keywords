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
      className={`absolute z-[1000] left-0 bg-white border border-border rounded-md shadow-lg p-2 max-h-[300px] overflow-y-auto ${
        index < 4 ? 'top-full mt-1' : 'bottom-full mb-1'
      }`}
    >
      <table className="text-xs">
        <thead>
          <tr>
            <th className="px-2 py-1 text-left font-medium text-muted">Keyword</th>
            <th className="px-2 py-1 text-right font-medium text-muted">LEN</th>
            <th className="px-2 py-1 text-right font-medium text-muted">Vol.</th>
            <th className="px-2 py-1 text-right font-medium text-muted">Diff.</th>
          </tr>
        </thead>
        <tbody>
          {topKeywords.length > 0 ? (
            topKeywords.map((keyword, idx) => (
              <tr key={idx} className="border-t border-border">
                <td className="px-2 py-1 text-left text-foreground">{keyword.tokenName}</td>
                <td className="px-2 py-1 text-right text-muted">
                  {keyword.tokenName?.length ?? 'N/A'}
                </td>
                <td className="px-2 py-1 text-right text-muted">
                  {keyword.volume?.toLocaleString() ?? 'N/A'}
                </td>
                <td className="px-2 py-1 text-right text-muted">
                  {keyword.difficulty != null ? Number(keyword.difficulty).toFixed(2) : 'N/A'}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={4} className="px-2 py-1 text-center text-muted">
                No keywords found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
