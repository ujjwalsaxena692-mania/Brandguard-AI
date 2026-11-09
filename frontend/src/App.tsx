import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { RequireAuth } from '@/components/auth/require-auth'
import { AuthProvider } from '@/hooks/use-auth'
import { AppShell } from '@/layouts/AppShell'
import { AuthLayout } from '@/layouts/AuthLayout'
import { AnalysisReportsPage } from '@/pages/AnalysisReportsPage'
import { AnalyticsPage } from '@/pages/AnalyticsPage'
import { ApprovalQueuePage } from '@/pages/ApprovalQueuePage'
import { ContentSubmissionPage } from '@/pages/ContentSubmissionPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { KnowledgeHubPage } from '@/pages/KnowledgeHubPage'
import { LoginPage } from '@/pages/LoginPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { RevisionHistoryPage } from '@/pages/RevisionHistoryPage'
import { SettingsPage } from '@/pages/SettingsPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>

          <Route
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="/knowledge-hub" element={<KnowledgeHubPage />} />
            <Route path="/submit" element={<ContentSubmissionPage />} />
            <Route path="/reports" element={<AnalysisReportsPage />} />
            <Route path="/approvals" element={<ApprovalQueuePage />} />
            <Route path="/history" element={<RevisionHistoryPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
