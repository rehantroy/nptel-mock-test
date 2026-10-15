import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { ModeSelection } from './pages/ModeSelection';
import { WeekSelection } from './pages/WeekSelection';
import { CustomTestConfig } from './pages/CustomTestConfig';
import { ActiveTest } from './pages/ActiveTest';
import { ResultsScreen } from './pages/ResultsScreen';
import { AnswerReview } from './pages/AnswerReview';
import { QuestionBank } from './pages/QuestionBank';
import { ImportVerification } from './pages/ImportVerification';
import { AttemptHistory } from './pages/AttemptHistory';
import { SettingsPage } from './pages/SettingsPage';
import { initializePreloadedData } from './lib/preloadData';

export function App() {
  useEffect(() => {
    initializePreloadedData();
  }, []);
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="modes" element={<ModeSelection />} />
          <Route path="modes/week-wise" element={<WeekSelection />} />
          <Route path="modes/custom" element={<CustomTestConfig />} />
          <Route path="test/:attemptId" element={<ActiveTest />} />
          <Route path="results/:attemptId" element={<ResultsScreen />} />
          <Route path="review/:attemptId" element={<AnswerReview />} />
          <Route path="bank" element={<QuestionBank />} />
          <Route path="import" element={<ImportVerification />} />
          <Route path="history" element={<AttemptHistory />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
