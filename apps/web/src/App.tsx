import { Route, Routes } from 'react-router-dom';
import { CallProvider } from './call/CallProvider';
import { DashboardPage } from './pages/DashboardPage';
import { RacePage } from './race/RacePage';
import { PhonePage } from './pages/PhonePage';

export function App() {
  return (
    <CallProvider>
      <Routes>
        <Route path="/" element={<PhonePage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/race" element={<RacePage />} />
        <Route path="*" element={<PhonePage />} />
      </Routes>
    </CallProvider>
  );
}
