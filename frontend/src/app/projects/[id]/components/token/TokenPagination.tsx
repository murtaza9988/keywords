import React from 'react';
import { PaginationInfo } from '../types';

interface TokenPaginationProps {
  pagination: PaginationInfo;
  onPageChange: (page: number) => void;
  isLoading: boolean;
}

export function TokenPagination({
  pagination,
  onPageChange,
  isLoading,
}: TokenPaginationProps) {
  const totalPages = Math.max(1, pagination.pages || 1);
  const currentPage = Math.min(pagination.page || 1, totalPages);
  const total = pagination.total || 0;
  
  const getPageNumbers = () => {
    const maxPagesToShow = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    const endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
    if (endPage - startPage + 1 < maxPagesToShow) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    const pages = [];
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  };

  const pageNumbers = getPageNumbers();
  if (total === 0) {
    return (
      <div className="mt-2 flex items-center justify-between text-[13px] text-gray-800">
        <div>No results found</div>
      </div>
    );
  }
  
  if (totalPages <= 1) {
    return (
      <div className="mt-2 flex items-center justify-between text-[13px] text-gray-800">
        <div>
          Showing {total.toLocaleString()} {total === 1 ? 'result' : 'results'}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-10 flex items-center justify-between text-[13px] text-gray-800">
      <div>
        Showing page {currentPage} of {totalPages} ({total.toLocaleString()} total)
      </div>
      <div className="flex items-center gap-2 cursor-pointer">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1 || isLoading}
          className="px-2 py-1 border border-gray-300 cursor-pointer rounded-md text-gray-800 hover:bg-gray-300 disabled:opacity-50"
          aria-label="Previous page"
        >
          ‹
        </button>
        
        {pageNumbers.map(page => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            disabled={isLoading}
            className={`px-2 py-1 border rounded-md ${
              page === currentPage
                ? 'bg-blue-600 text-white border-blue-600 cursor-pointer'
                : 'border-gray-300 text-gray-600 hover:bg-gray-300 cursor-pointer'
            } disabled:opacity-50`}
            aria-label={`Page ${page}`}
            aria-current={page === currentPage ? 'page' : undefined}
          >
            {page}
          </button>
        ))}
        
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages || isLoading}
          className="px-2 py-1 border border-gray-300 cursor-pointer rounded-md text-gray-600 hover:bg-gray-300 disabled:opacity-50"
          aria-label="Next page"
        >
          ›
        </button>
      </div>
    </div>
  );
}