import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KanbanBoard } from '@/components/issues/KanbanBoard';
import { makeIssue, renderWithProviders } from '@/test/utils';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), message: vi.fn(), warning: vi.fn() },
}));

const issues = [
  makeIssue({
    id: 'issue-1',
    issueKey: 'WEB-1',
    title: 'Crash on checkout',
    status: 'todo',
    priority: 'critical',
  }),
  makeIssue({
    id: 'issue-2',
    issueKey: 'WEB-2',
    title: 'Improve empty states',
    status: 'in-progress',
    priority: 'low',
  }),
  makeIssue({
    id: 'issue-3',
    issueKey: 'WEB-3',
    title: 'Ship dark mode',
    status: 'done',
    priority: 'medium',
  }),
];

describe('KanbanBoard', () => {
  it('renders the three columns with the correct cards in each', () => {
    renderWithProviders(
      <div>
        <KanbanBoard issues={issues} onStatusChange={vi.fn()} />
      </div>,
    );

    const todo = screen.getByTestId('kanban-column-todo');
    const inProgress = screen.getByTestId('kanban-column-in-progress');
    const done = screen.getByTestId('kanban-column-done');

    expect(within(todo).getByText('Crash on checkout')).toBeInTheDocument();
    expect(within(inProgress).getByText('Improve empty states')).toBeInTheDocument();
    expect(within(done).getByText('Ship dark mode')).toBeInTheDocument();

    expect(within(todo).queryByText('Ship dark mode')).not.toBeInTheDocument();
  });

  it('shows an empty placeholder for columns without issues', () => {
    renderWithProviders(<KanbanBoard issues={[issues[0]]} onStatusChange={vi.fn()} />);
    expect(screen.getByTestId('kanban-column-done')).toHaveTextContent(/no issues/i);
  });

  it('changes status through the accessible card menu (keyboard fallback)', async () => {
    const onStatusChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <KanbanBoard issues={issues} onStatusChange={onStatusChange} canEditIssue={() => true} />,
    );

    await user.click(screen.getByRole('button', { name: /open actions for WEB-1/i }));
    await user.click(screen.getByRole('menuitem', { name: /move to done/i }));

    expect(onStatusChange).toHaveBeenCalledTimes(1);
    expect(onStatusChange).toHaveBeenCalledWith(expect.objectContaining({ id: 'issue-1' }), 'done');
  });

  it('exposes drag handles and status information for assistive tech', () => {
    renderWithProviders(<KanbanBoard issues={issues} onStatusChange={vi.fn()} />);
    expect(
      screen.getByRole('button', { name: /drag WEB-1 to change its status/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/WEB-1: Crash on checkout\. Status To Do/i)).toBeInTheDocument();
  });

  it('calls onCreate with the column status', async () => {
    const onCreate = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <KanbanBoard issues={issues} onStatusChange={vi.fn()} onCreate={onCreate} canCreate />,
    );

    await user.click(screen.getByRole('button', { name: /create issue in in progress/i }));
    expect(onCreate).toHaveBeenCalledWith('in-progress');
  });

  it('does not expose drag handles when the user cannot edit', () => {
    renderWithProviders(
      <KanbanBoard issues={issues} onStatusChange={vi.fn()} canEditIssue={() => false} />,
    );

    // Read-only users get a decorative grip icon, not a focusable/disabled drag control.
    expect(screen.queryByRole('button', { name: /drag WEB-1/i })).not.toBeInTheDocument();
    expect(screen.getByRole('article', { name: /WEB-1/i })).toBeInTheDocument();
  });
});
