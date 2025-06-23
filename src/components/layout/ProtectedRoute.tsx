import React, { ReactNode } from 'react';
import { useAuth } from '../../contexts/AuthContext';
// import './ProtectedRoute.css';

interface ProtectedRouteProps {
  children: ReactNode;
  fallback?: ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  fallback 
}) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Carregando...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (React.isValidElement(fallback)) {
      return fallback;
    }
    return (
      <div className="unauthorized-container">
        <h2>Acesso Negado</h2>
        <p>Você precisa estar logado para acessar esta página.</p>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute; 