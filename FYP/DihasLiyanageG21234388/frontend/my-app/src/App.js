import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './Login';
import SignUp from './SignUp';
import HomePage from './HomePage';
import HistoryPage from './HistoryPage';
import ResultsPage from './ResultsPage';

function App() {
  return (
    <Routes>
      {/* When the app starts, go to login */}
      <Route path="/" element={<Login />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/home" element={<HomePage />} />
      <Route path="/history" element={<HistoryPage />} />
      <Route path="/results" element={<ResultsPage />} />

      {/* Redirect any unknown route to login */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;
