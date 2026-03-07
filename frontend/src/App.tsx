import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { Layout } from '@/components/Layout'
import { DashboardLayout } from '@/components/DashboardLayout'
import { HomePage } from '@/pages/HomePage'
import { TariffsPage } from '@/pages/TariffsPage'
import { HowItWorksPage } from '@/pages/HowItWorksPage'
import { LoginPage } from '@/pages/LoginPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { ConfirmEmailPage } from '@/pages/ConfirmEmailPage'
import { BookingPage } from '@/pages/BookingPage'
import { DashboardOverview } from '@/pages/dashboard/DashboardOverview'
import { DashboardVisits } from '@/pages/dashboard/DashboardVisits'
import { DashboardVisitDetail } from '@/pages/dashboard/DashboardVisitDetail'
import { DashboardSubscription } from '@/pages/dashboard/DashboardSubscription'
import { DashboardSlots } from '@/pages/dashboard/DashboardSlots'
import { DashboardProfile } from '@/pages/dashboard/DashboardProfile'
import { ExecutorLayout } from '@/components/ExecutorLayout'
import { ExecutorOverview } from '@/pages/executor/ExecutorOverview'
import { ExecutorVisitsPage } from '@/pages/executor/ExecutorVisitsPage'
import { ExecutorVisitDetailPage } from '@/pages/executor/ExecutorVisitDetailPage'
import { ExecutorProfile } from '@/pages/executor/ExecutorProfile'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="tariffs" element={<TariffsPage />} />
            <Route path="booking" element={<BookingPage />} />
            <Route path="how-it-works" element={<HowItWorksPage />} />
          </Route>
          <Route path="dashboard" element={<DashboardLayout />}>
            <Route index element={<DashboardOverview />} />
            <Route path="slots" element={<DashboardSlots />} />
            <Route path="visits" element={<DashboardVisits />} />
            <Route path="visits/:visitId" element={<DashboardVisitDetail />} />
            <Route path="subscription" element={<DashboardSubscription />} />
            <Route path="profile" element={<DashboardProfile />} />
          </Route>
          <Route path="executor" element={<ExecutorLayout />}>
            <Route index element={<ExecutorOverview />} />
            <Route path="visits" element={<ExecutorVisitsPage />} />
            <Route path="visits/:visitId" element={<ExecutorVisitDetailPage />} />
            <Route path="profile" element={<ExecutorProfile />} />
          </Route>
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="auth/confirm-email" element={<ConfirmEmailPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
