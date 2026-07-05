import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { RequireAuth } from "./components/RequireAuth";
import { OverviewPage } from "./pages/OverviewPage";
import { QueuesPage } from "./pages/QueuesPage";
import { JobsPage } from "./pages/JobsPage";
import { WorkersPage } from "./pages/WorkersPage";
import { LoginPage } from "./pages/LoginPage";

export const App = () => (
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route
      element={(
        <RequireAuth>
          <Layout />
        </RequireAuth>
      )}
    >
      <Route path="/" element={<OverviewPage />} />
      <Route path="/queues" element={<QueuesPage />} />
      <Route path="/jobs" element={<JobsPage />} />
      <Route path="/workers" element={<WorkersPage />} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);
