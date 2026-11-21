import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IssueFormModal } from '@/components/issues/IssueFormModal';
import { renderWithProviders, mockUser } from '@/test/utils';

const createIssueMock = vi.fn();
const updateIssueMock = vi.fn();

vi.mock('@/hooks/useMembers', () => ({
  useMembers: () => ({
    data: {
      members: [
        { ...mockUser, role: 'owner', addedAt: new Date().toISOString() },
        {
          id: 'user-2',
          name: 'Marcus Webb',
          email: 'marcus@test.dev',
          avatarUrl: null,
          role: 'member',
          addedAt: new Date().toISOString(),
        },
      ],
      owner: mockUser,
      canManage: true,
    },
    isLoading: false,
  }),
}));

vi.mock('@/hooks/useProjects', () => ({
  useProjectLabels: () => ({ data: ['auth', 'ui', 'regression'] }),
}));

vi.mock('@/hooks/useIssues', () => ({
  useCreateIssue: () => ({ mutateAsync: createIssueMock, isPending: false }),
  useUpdateIssue: () => ({ mutateAsync: updateIssueMock, isPending: false }),
}));

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    api: {
      ...actual.api,
      issues: {
        ...actual.api.issues,
        attachments: { upload: vi.fn().mockResolvedValue({ data: {} }) },
      },
    },
  };
});

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), message: vi.fn(), warning: vi.fn() },
}));

function renderModal(onClose = vi.fn()) {
  renderWithProviders(
    <IssueFormModal mode="create" open projectId="project-1" onClose={onClose} />,
  );
  return { onClose };
}

describe('IssueFormModal', () => {
  beforeEach(() => {
    createIssueMock.mockReset();
    createIssueMock.mockResolvedValue({ id: 'new-issue', issueKey: 'WEB-9' });
    updateIssueMock.mockReset();
  });

  it('renders every required create-issue field with an accessible label', () => {
    renderModal();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/priority/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^status/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/assignee/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/due date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/labels/i)).toBeInTheDocument();
  });

  it('rejects titles shorter than three characters without calling the API', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText(/title/i), 'ab');
    await user.click(screen.getByRole('button', { name: /create issue/i }));

    expect(await screen.findByText(/title must be at least 3 characters/i)).toBeInTheDocument();
    expect(createIssueMock).not.toHaveBeenCalled();
  });

  it('creates an issue with the entered values', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.type(screen.getByLabelText(/title/i), 'Checkout crashes on Safari');
    await user.type(screen.getByLabelText(/description/i), 'Steps to reproduce…');
    await user.selectOptions(screen.getByLabelText(/priority/i), 'critical');
    await user.selectOptions(screen.getByLabelText(/assignee/i), 'user-2');
    await user.type(screen.getByLabelText(/add a label/i), 'checkout{Enter}');
    await user.click(screen.getByRole('button', { name: /create issue/i }));

    await waitFor(() => expect(createIssueMock).toHaveBeenCalledTimes(1));
    expect(createIssueMock.mock.calls[0][0]).toMatchObject({
      title: 'Checkout crashes on Safari',
      description: 'Steps to reproduce…',
      priority: 'critical',
      assignee: 'user-2',
      status: 'todo',
      type: 'bug',
      labels: ['checkout'],
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('adds and removes labels as chips', async () => {
    const user = userEvent.setup();
    renderModal();

    const labelInput = screen.getByLabelText(/add a label/i);
    await user.type(labelInput, 'urgent{Enter}');
    expect(screen.getByText('urgent')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /remove label urgent/i }));
    expect(screen.queryByText('urgent')).not.toBeInTheDocument();
  });

  it('pre-fills values when editing an existing issue', async () => {
    renderWithProviders(
      <IssueFormModal
        mode="edit"
        open
        projectId="project-1"
        onClose={vi.fn()}
        issue={{
          id: 'issue-1',
          projectId: 'project-1',
          issueNumber: 1,
          issueKey: 'WEB-1',
          title: 'Existing title',
          description: 'Existing description',
          type: 'task',
          priority: 'low',
          status: 'done',
          reporter: mockUser,
          assignee: null,
          labels: ['ui'],
          dueDate: null,
          attachments: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }}
      />,
    );

    expect(screen.getByLabelText(/title/i)).toHaveValue('Existing title');
    expect(screen.getByLabelText(/^type/i)).toHaveValue('task');
    expect(screen.getByLabelText(/priority/i)).toHaveValue('low');
    expect(screen.getByLabelText(/^status/i)).toHaveValue('done');
    expect(screen.getByText('ui')).toBeInTheDocument();
  });
});
