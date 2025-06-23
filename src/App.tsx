import React from 'react';
import './App.css';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/layout/ProtectedRoute';
import AuthPage from './pages/AuthPage';
import MapaRastreamento from './MapaRastreamento';
import TestAPI from './components/TestAPI';
import HistoryPage from './pages/HistoryPage';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
// import './ProtectedRoute.css';


function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/" element={
            <ProtectedRoute fallback={<AuthPage />}>
              <MapaRastreamento />
            </ProtectedRoute>
          } />
          <Route path="/history" element={
            <ProtectedRoute fallback={<AuthPage />}>
              <HistoryPage />
            </ProtectedRoute>
          } />
        </Routes>
        {/* Componente de teste - remover depois */}
        {/* <TestAPI /> */}
      </AuthProvider>
    </Router>
  );
}

export default App;
