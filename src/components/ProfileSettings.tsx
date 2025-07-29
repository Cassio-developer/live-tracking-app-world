import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import FaceSettings from './auth/FaceSettings';
import BackgroundSyncStatus from './BackgroundSyncStatus';
import './ProfileSettings.css';

interface ProfileSettingsProps {
  onClose: () => void;
  className?: string;
}

const ProfileSettings: React.FC<ProfileSettingsProps> = ({
  onClose,
  className = ''
}) => {
  const { user, logout } = useAuth();
  const [showFaceSettings, setShowFaceSettings] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    if (window.confirm('Tem certeza que deseja sair?')) {
      setIsLoading(true);
      try {
        await logout();
        onClose();
      } catch (error) {
        console.error('Erro ao fazer logout:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleFaceSettingsClose = () => {
    setShowFaceSettings(false);
  };

  // Se mostrar configurações faciais, renderizar componente FaceSettings
  if (showFaceSettings) {
    return (
      <FaceSettings
        onClose={handleFaceSettingsClose}
        className={className}
      />
    );
  }

  return (
    <div className={`profile-settings-container ${className}`}>
      <div className="profile-settings-header">
        <h3>⚙️ Configurações do Perfil</h3>
        <button onClick={onClose} className="close-button">
          ✕
        </button>
      </div>

      <div className="profile-settings-content">
        {/* Informações do usuário */}
        <div className="user-info-card">
          <div className="user-avatar avatar-modern avatar-large">
            {user?.avatar ? (
              <img src={user.avatar} alt="Avatar" />
            ) : (
              <div className="avatar-placeholder">
                {user?.nome?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
          </div>
          
          <div className="user-details">
            <h4>{user?.nome || 'Usuário'}</h4>
            <p className="user-role">
              {user?.isAdmin ? '👑 Administrador' : '👤 Usuário'}
            </p>
            <p className="user-id">ID: {user?.id}</p>
          </div>
        </div>

        {/* Opções de configuração */}
        <div className="settings-options">
          <div className="settings-section">
            <h4>🔐 Segurança</h4>
            
            <button
              onClick={() => setShowFaceSettings(true)}
              className="settings-option"
            >
              <div className="option-icon">👤</div>
              <div className="option-content">
                <strong>Reconhecimento Facial</strong>
                <p>Configure login com reconhecimento facial</p>
              </div>
              <div className="option-arrow">→</div>
            </button>

            <button
              onClick={() => window.alert('Funcionalidade em desenvolvimento')}
              className="settings-option"
            >
              <div className="option-icon">🔑</div>
              <div className="option-content">
                <strong>Alterar Senha</strong>
                <p>Modifique sua senha de acesso</p>
              </div>
              <div className="option-arrow">→</div>
            </button>
          </div>

          <div className="settings-section">
            <h4>📱 Aplicativo</h4>
            
            <BackgroundSyncStatus />
            
            <button
              onClick={() => window.alert('Funcionalidade em desenvolvimento')}
              className="settings-option"
            >
              <div className="option-icon">🔔</div>
              <div className="option-content">
                <strong>Notificações</strong>
                <p>Configure alertas e notificações</p>
              </div>
              <div className="option-arrow">→</div>
            </button>

            <button
              onClick={() => window.alert('Funcionalidade em desenvolvimento')}
              className="settings-option"
            >
              <div className="option-icon">🌙</div>
              <div className="option-content">
                <strong>Tema Escuro</strong>
                <p>Alterar aparência do aplicativo</p>
              </div>
              <div className="option-arrow">→</div>
            </button>
          </div>

          <div className="settings-section">
            <h4>ℹ️ Informações</h4>
            
            <button
              onClick={() => window.alert('Versão 1.0.0\nDesenvolvido com React + Node.js')}
              className="settings-option"
            >
              <div className="option-icon">ℹ️</div>
              <div className="option-content">
                <strong>Sobre o App</strong>
                <p>Informações sobre a aplicação</p>
              </div>
              <div className="option-arrow">→</div>
            </button>

            <button
              onClick={() => window.alert('Funcionalidade em desenvolvimento')}
              className="settings-option"
            >
              <div className="option-icon">📞</div>
              <div className="option-content">
                <strong>Suporte</strong>
                <p>Entre em contato conosco</p>
              </div>
              <div className="option-arrow">→</div>
            </button>
          </div>
        </div>
      </div>

      <div className="profile-settings-actions">
        <button
          onClick={handleLogout}
          className="btn-danger"
          disabled={isLoading}
        >
          {isLoading ? 'Saindo...' : 'Sair da Conta'}
        </button>
        
        <button onClick={onClose} className="btn-secondary">
          Fechar
        </button>
      </div>
    </div>
  );
};

export default ProfileSettings; 