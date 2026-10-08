import { Navigate, Route, Routes } from 'react-router-dom';

import { AnalysisEventsPage } from './pages/AnalysisEventsPage';
import { AnalysisScopePage } from './pages/AnalysisScopePage';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { NotFoundPage } from './pages/NotFoundPage';
import { ReportsListPage } from './pages/ReportsListPage';
import { ReviewReportPage } from './pages/ReviewReportPage';
import { PostDisasterReportPage } from './pages/PostDisasterReportPage';
import { ReviewWarningPage } from './pages/ReviewWarningPage';
import { WarningFormPage } from './pages/WarningFormPage';
import { WarningsListPage } from './pages/WarningsListPage';
import { WarningStatusPage } from './pages/WarningStatusPage';
import { PENDING_PATH } from './lib/routes';

function App() {
  return (
    <Routes>
      <Route element={<DashboardLayout />}>
        <Route index element={<Navigate to={PENDING_PATH} replace />} />
        <Route
          path="reports/pending"
          element={<ReportsListPage status="PENDING_VERIFICATION" />}
        />
        <Route
          path="reports/verified"
          element={<ReportsListPage status="VERIFIED" />}
        />
        <Route
          path="reports/rejected"
          element={<ReportsListPage status="REJECTED" />}
        />
        <Route path="analysis" element={<AnalysisEventsPage />} />
        <Route path="analysis/:eventId" element={<AnalysisScopePage />} />
        <Route
          path="analysis/:eventId/report"
          element={<PostDisasterReportPage />}
        />
        <Route path="reports/:id" element={<ReviewReportPage />} />
        <Route path="warnings" element={<WarningsListPage />} />
        <Route path="warnings/new" element={<WarningFormPage />} />
        <Route path="warnings/review" element={<ReviewWarningPage />} />
        <Route path="warnings/:id/edit" element={<WarningFormPage />} />
        <Route path="warnings/:id" element={<WarningStatusPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default App;
