import { Route, Routes } from 'react-router-dom';

import { HealthStatus } from './components/HealthStatus';

function App() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <h1 className="p-6 text-3xl font-bold">Disaster Warning System</h1>
      <main className="p-6">
        <Routes>
          <Route
            path="/"
            element={
              <>
                <HealthStatus />
                <p className="mt-4">No active alerts.</p>
              </>
            }
          />
        </Routes>
      </main>
    </div>
  );
}

export default App;
