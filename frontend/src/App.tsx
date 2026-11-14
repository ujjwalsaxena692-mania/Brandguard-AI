import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth } from '@/components/auth/require-auth'
import { AuthProvider } from '@/hooks/use-auth'
import { OrganisationProvider } from '@/hooks/use-organisation'
import { AppShell } from '@/layouts/AppShell'
import { AuthLayout } from '@/layouts/AuthLayout'
import { AnalysisReportsPage } from '@/pages/AnalysisReportsPage'
import { AnalyticsPage } from '@/pages/AnalyticsPage'
import { BrandSettingsPage } from '@/pages/BrandSettingsPage'
import { ContentHistoryPage } from '@/pages/ContentHistoryPage'
import { ContentSubmissionPage } from '@/pages/ContentSubmissionPage'
import { CorrectionEditorPage } from '@/pages/CorrectionEditorPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { KnowledgeHubPage } from '@/pages/KnowledgeHubPage'
import { LoginPage } from '@/pages/LoginPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { OrganisationPage } from '@/pages/OrganisationPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { ReviewDetailPage } from '@/pages/ReviewDetailPage'
import { ReviewsPage } from '@/pages/ReviewsPage'
import { SettingsPage } from '@/pages/SettingsPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <OrganisationProvider>
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
              <Route path="/corrections" element={<CorrectionEditorPage />} />
              <Route path="/reviews" element={<ReviewsPage />} />
              <Route path="/reviews/:reviewId" element={<ReviewDetailPage />} />
              {/* The old Approval Queue placeholder URL, kept so existing links still work. */}
              <Route path="/approvals" element={<Navigate to="/reviews" replace />} />
              <Route path="/history" element={<ContentHistoryPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/organisation" element={<OrganisationPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/settings/brand" element={<BrandSettingsPage />} />
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </OrganisationProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
