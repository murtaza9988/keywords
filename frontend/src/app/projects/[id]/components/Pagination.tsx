import React, { memo, useMemo } from 'react';

interface PaginationProps {
  total: number;
  page: number;
  limit: number;
  pages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

const Pagination: React.FC<PaginationProps> = memo(({ total, page, pages, onPageChange, disabled }) => {
  const pageNumbers = useMemo(() => {
    if (pages < 1) return null;

    const maxButtons = 5;
    const buttons: number[] = [];
    if (pages <= maxButtons) {
      return Array.from({ length: pages }, (_, i) => i + 1);
    }

    let start = Math.max(1, Math.floor((page - 1) / maxButtons) * maxButtons + 1);
    const end = Math.min(pages, start + maxButtons - 1);

    if (end - start + 1 < maxButtons) {
      start = Math.max(1, end - maxButtons + 1);
    }

    for (let i = start; i <= end; i++) {
      buttons.push(i);
    }

    return buttons;
  }, [page, pages]);

  return (
    <div className="flex items-center justify-between mt-4 px-2">
      <div className="text-ui-body text-foreground">
        Showing page {page} of {pages} ({total.toLocaleString()} total)
      </div>
      <div className="flex space-x-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={disabled || page === 1}
          className={`px-3 py-1 border rounded-md transition-all duration-300 ease-in-out ${
            page === 1 || disabled
              ? 'text-ui-muted text-ui-size-meta border-border cursor-not-allowed'
              : 'text-foreground text-ui-size-meta border-border hover:bg-surface-muted cursor-pointer'
          }`}
        >
          Previous
        </button>
        {pageNumbers?.map((pageNum) => (
          <button
            key={pageNum}
            onClick={() => onPageChange(pageNum)}
            disabled={disabled}
            className={`px-3 py-1 border rounded-md transition-all duration-300 ease-in-out ${
              pageNum === page
                ? 'bg-blue-600 text-ui-size-meta text-white border-blue-600 cursor-pointer'
                : 'text-ui-muted text-ui-size-meta border-border hover:bg-surface-muted cursor-pointer disabled:text-muted disabled:border-border disabled:cursor-not-allowed'
            }`}
          >
            {pageNum}
          </button>
        ))}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={disabled || page === pages}
          className={`px-3 py-1 border rounded-md transition-all duration-300 ease-in-out ${
            page === pages || disabled
              ? 'text-ui-muted text-ui-size-meta border-border cursor-not-allowed'
              : 'text-foreground text-ui-size-meta border-border hover:bg-surface-muted cursor-pointer'
          }`}
        >
          Next
        </button>
      </div>
    </div>
  );
});
Pagination.displayName = 'Pagination';

export default Pagination;
