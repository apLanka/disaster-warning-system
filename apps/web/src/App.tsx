import { Navigate, Route, Routes } from 'react-router-dom';

import { DashboardLayout } from './components/layout/DashboardLayout';
import { DistrictLayout } from './components/layout/DistrictLayout';
import { PENDING_PATH } from './lib/routes';
import { AnalysisEventsPage } from './pages/AnalysisEventsPage';
import { AnalysisScopePage } from './pages/AnalysisScopePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PostDisasterReportPage } from './pages/PostDisasterReportPage';
import { ReportsListPage } from './pages/ReportsListPage';
import { ActiveEventsPage } from './pages/rescue/ActiveEventsPage';
import { AffectedDistrictsPage } from './pages/rescue/AffectedDistrictsPage';
import { AssignedMissionPage } from './pages/rescue/AssignedMissionPage';
import { AvailableTeamsPage } from './pages/rescue/AvailableTeamsPage';
import { CreateAssignmentPage } from './pages/rescue/CreateAssignmentPage';
import { DistrictDashboardPage } from './pages/rescue/DistrictDashboardPage';
import { RescueOperationsPage } from './pages/rescue/RescueOperationsPage';
import { RescueTeamPortalPage } from './pages/rescue/RescueTeamPortalPage';
import { ResourcesPage } from './pages/rescue/ResourcesPage';
import { SheltersPage } from './pages/rescue/SheltersPage';
import { ReviewReportPage } from './pages/ReviewReportPage';
import { ReviewWarningPage } from './pages/ReviewWarningPage';
import { WarningFormPage } from './pages/WarningFormPage';
import { WarningsListPage } from './pages/WarningsListPage';
import { WarningStatusPage } from './pages/WarningStatusPage';

function App() {
  return (
    <Routes>
      {/* Standalone Rescue Team Leader Portal (SQ4 / SQ6) */}
      <Route path="rescue-leader" element={<RescueTeamPortalPage />} />
      <Route path="rescue-leader/portal" element={<RescueTeamPortalPage />} />
      <Route
        path="rescue-leader/missions/:id"
        element={<RescueTeamPortalPage />}
      />
      <Route path="rescue/portal" element={<RescueTeamPortalPage />} />
      <Route
        path="rescue/portal/missions/:id"
        element={<RescueTeamPortalPage />}
      />

      {/* District Officer Dashboard */}
      <Route path="district" element={<DistrictLayout />}>
        <Route index element={<Navigate to="/district/dashboard" replace />} />
        <Route path="dashboard" element={<DistrictDashboardPage />} />
        <Route path="events" element={<ActiveEventsPage />} />
        <Route
          path="events/:eventId/districts"
          element={<AffectedDistrictsPage />}
        />
        <Route
          path="events/:eventId/districts/:districtCode/teams"
          element={<AvailableTeamsPage />}
        />
        <Route path="assign" element={<CreateAssignmentPage />} />
        <Route path="operations" element={<RescueOperationsPage />} />
        <Route path="missions" element={<RescueOperationsPage />} />
        <Route path="missions/:id" element={<AssignedMissionPage />} />
        <Route path="shelters" element={<SheltersPage />} />
        <Route path="resources" element={<ResourcesPage />} />
      </Route>

      {/* DMC Officer Portal */}
      <Route element={<DashboardLayout />}>
        <Route index element={<Navigate to={PENDING_PATH} replace />} />

        {/* Hazard Reports */}
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

        {/* Hazard Warnings Dissemination */}
        <Route path="warnings" element={<WarningsListPage />} />
        <Route path="warnings/new" element={<WarningFormPage />} />
        <Route path="warnings/review" element={<ReviewWarningPage />} />
        <Route path="warnings/:id/edit" element={<WarningFormPage />} />
        <Route path="warnings/:id" element={<WarningStatusPage />} />

        {/* Analysis & Reports */}
        <Route path="analysis" element={<AnalysisEventsPage />} />
        <Route path="analysis/:eventId" element={<AnalysisScopePage />} />
        <Route
          path="analysis/:eventId/report"
          element={<PostDisasterReportPage />}
        />

        {/* Fallback */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default App;
