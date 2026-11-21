import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { IssueFormModal } from '@/components/issues/IssueFormModal';
import type { Project, ProjectRole } from '@/types';

export interface ProjectContextValue {
  project: Project;
  role: ProjectRole;
  canManageProject: boolean;
  canCreateIssue: boolean;
  canComment: boolean;
  openCreateIssue: () => void;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({
  project,
  role,
  children,
}: {
  project: Project;
  role: ProjectRole;
  children: ReactNode;
}) {
  const [createOpen, setCreateOpen] = useState(false);

  const value = useMemo<ProjectContextValue>(
    () => ({
      project,
      role,
      canManageProject: role === 'owner' || role === 'admin',
      canCreateIssue: role !== 'viewer',
      canComment: role !== 'viewer',
      openCreateIssue: () => setCreateOpen(true),
    }),
    [project, role],
  );

  return (
    <ProjectContext.Provider value={value}>
      {children}
      <IssueFormModal
        mode="create"
        open={createOpen}
        projectId={project.id}
        onClose={() => setCreateOpen(false)}
      />
    </ProjectContext.Provider>
  );
}

export function useProjectContext(): ProjectContextValue {
  const context = useContext(ProjectContext);
  if (!context) throw new Error('useProjectContext must be used within <ProjectProvider>');
  return context;
}
