import { Navigate, Route, Routes } from 'react-router-dom';

import { DashboardLayout } from './components/layout/DashboardLayout';
import { NotFoundPage } from './pages/NotFoundPage';
import { ReportsListPage } from './pages/ReportsListPage';
import { ReviewReportPage } from './pages/ReviewReportPage';
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
        <Route path="reports/:id" element={<ReviewReportPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default App;
