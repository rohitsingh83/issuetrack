import { Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute, PublicOnlyRoute } from '@/components/auth/ProtectedRoute';
import { ProjectLayout } from '@/components/layout/ProjectLayout';
import { DashboardPage } from '@/pages/DashboardPage';
import { ProjectsPage } from '@/pages/ProjectsPage';
import { BoardPage } from '@/pages/BoardPage';
import { ProjectIssuesPage } from '@/pages/ProjectIssuesPage';
import { IssueDetailPage } from '@/pages/IssueDetailPage';
import { ProjectSettingsPage } from '@/pages/ProjectSettingsPage';
import { AllIssuesPage } from '@/pages/AllIssuesPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

export default function App() {
  return (
    <>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicOnlyRoute>
              <LoginPage />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicOnlyRoute>
              <RegisterPage />
            </PublicOnlyRoute>
          }
        />

        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="issues" element={<AllIssuesPage />} />
          <Route path="profile" element={<ProfilePage />} />

          <Route path="projects/:projectId" element={<ProjectLayout />}>
            <Route index element={<Navigate to="board" replace />} />
            <Route path="board" element={<BoardPage />} />
            <Route path="issues" element={<ProjectIssuesPage />} />
            <Route path="issues/:issueId" element={<IssueDetailPage />} />
            <Route path="settings" element={<ProjectSettingsPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>

      <Toaster
        position="bottom-right"
        richColors
        closeButton
        toastOptions={{
          className: 'text-sm',
          classNames: {
            success: '!text-emerald-900 [&_[data-title]]:!text-emerald-900',
            error: '!text-rose-900 [&_[data-title]]:!text-rose-900',
            warning: '!text-amber-900 [&_[data-title]]:!text-amber-900',
            info: '!text-sky-900 [&_[data-title]]:!text-sky-900',
          },
        }}
      />
    </>
  );
}
