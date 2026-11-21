import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Pagination as PaginationMeta } from '@/types';
import { Button } from './Button';

export function Pagination({
  pagination,
  onPageChange,
  itemLabel = 'issues',
}: {
  pagination: PaginationMeta;
  onPageChange: (page: number) => void;
  itemLabel?: string;
}) {
  const { page, totalPages, total, limit } = pagination;
  if (total === 0) return null;

  const singular = itemLabel.replace(/ies$/, 'y').replace(/s$/, '');
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  return (
    <nav
      className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 pt-4 sm:flex-row"
      aria-label="Pagination"
    >
      <p className="text-xs text-slate-600" data-testid="pagination-summary">
        Showing <span className="font-medium text-slate-700">{start}</span>–
        <span className="font-medium text-slate-700">{end}</span> of{' '}
        <span className="font-medium text-slate-700">{total}</span>{' '}
        {total === 1 ? singular : itemLabel}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={!pagination.hasPrevPage}
          leftIcon={<ChevronLeft className="h-3.5 w-3.5" />}
          aria-label="Previous page"
        >
          Previous
        </Button>
        <span className="px-1 text-xs font-medium text-slate-600">
          Page {page} of {Math.max(totalPages, 1)}
        </span>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={!pagination.hasNextPage}
          rightIcon={<ChevronRight className="h-3.5 w-3.5" />}
          aria-label="Next page"
        >
          Next
        </Button>
      </div>
    </nav>
  );
}
