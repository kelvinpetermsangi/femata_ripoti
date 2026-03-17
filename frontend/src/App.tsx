import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import ReportPage from './pages/ReportPage';
import ChatPage from './pages/ChatPage';
import TrackDashboardPage from './pages/TrackDashboardPage';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminRoute from './components/AdminRoute';
import AdminLayout from './components/AdminLayout';
import AdminHomePage from './pages/AdminHomePage';
import AdminCasesPage from './pages/AdminCasesPage';
import AdminAnalyticsPage from './pages/AdminAnalyticsPage';
import AdminAnalyticsReportPage from './pages/AdminAnalyticsReportPage';
import AdminAccessPage from './pages/AdminAccessPage';
import AdminProfilePage from './pages/AdminProfilePage';
import AdminInboxPage from './pages/AdminInboxPage';
import AdminZoneManagementPage from './pages/AdminZoneManagementPage';
import AdminTrainingPage from './pages/AdminTrainingPage';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/index.html" element={<Navigate to="/" replace />} />
          <Route path="/report" element={<ReportPage />} />
          <Route path="/track" element={<TrackDashboardPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route element={<AdminRoute />}>
          <Route path="/dashboard/analytics/report" element={<AdminAnalyticsReportPage />} />
          <Route path="/dashboard" element={<AdminLayout />}>
              <Route index element={<AdminHomePage />} />
              <Route path="cases" element={<AdminCasesPage />} />
              <Route path="analytics" element={<AdminAnalyticsPage />} />
              <Route path="access" element={<AdminAccessPage />} />
              <Route path="zones" element={<AdminZoneManagementPage />} />
              <Route path="profile" element={<AdminProfilePage />} />
              <Route path="inbox" element={<AdminInboxPage />} />
              <Route path="training" element={<AdminTrainingPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
