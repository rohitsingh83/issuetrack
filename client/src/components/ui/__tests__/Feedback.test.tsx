import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState, ErrorState, BoardSkeleton, PageLoader } from '@/components/ui/Feedback';
import { Pagination } from '@/components/ui/Pagination';
import { Badge, PriorityBadge, RoleBadge, StatusBadge } from '@/components/ui/Badge';
import { PriorityBadge as PriorityBadgeAlias } from '@/components/ui/Badge';

describe('UI states', () => {
  it('renders an empty state with title, description and action', () => {
    render(
      <EmptyState
        title="No issues yet"
        description="Create your first issue"
        action={<button type="button">Create issue</button>}
      />,
    );
    expect(screen.getByRole('heading', { name: /no issues yet/i })).toBeInTheDocument();
    expect(screen.getByText(/create your first issue/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create issue/i })).toBeInTheDocument();
  });

  it('renders an error state with a retry action', () => {
    const onRetry = vi.fn();
    render(<ErrorState title="Could not load" message="Network error" onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/could not load/i);
    screen.getByRole('button', { name: /try again/i }).click();
    expect(onRetry).toHaveBeenCalled();
  });

  it('renders loading skeletons with an aria-busy region', () => {
    render(<BoardSkeleton />);
    expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  it('renders a labelled page loader', () => {
    render(<PageLoader label="Loading issues…" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Loading issues…')).toBeInTheDocument();
  });

  it('communicates badges with text, not colour alone', () => {
    render(
      <div>
        <StatusBadge status="in-progress" />
        <PriorityBadge priority="critical" />
        <RoleBadge role="admin" />
        <Badge>custom</Badge>
      </div>,
    );
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('custom')).toBeInTheDocument();
  });

  it('summarises the visible page range', () => {
    const onPageChange = vi.fn();
    render(
      <Pagination
        pagination={{
          page: 2,
          limit: 10,
          total: 47,
          totalPages: 5,
          hasNextPage: true,
          hasPrevPage: true,
        }}
        onPageChange={onPageChange}
      />,
    );
    expect(screen.getByTestId('pagination-summary')).toHaveTextContent(/11–20 of 47 issues/);
    screen.getByRole('button', { name: /next page/i }).click();
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('keeps the hidden alias exported for tree-shaking parity', () => {
    expect(PriorityBadgeAlias).toBe(PriorityBadge);
  });
});
