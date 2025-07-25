import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { isFaceRecognitionSupported } from '../../utils/faceRecognition';
import { faceAuthService } from '../../services/faceAuthService';
import FaceRegistration from './FaceRegistration';
import './FaceSettings.css';

interface FaceSettingsProps {
  onClose: () => void;
  className?: string;
}

interface FaceDataStatus {
  hasFaceData: boolean;
  isSupported: boolean;
  isLoading: boolean;
}

const FaceSettings: React.FC<FaceSettingsProps> = ({
  onClose,
  className = ''
}) => {
  const { user } = useAuth();
  const [status, setStatus] = useState<FaceDataStatus>({
    hasFaceData: false,
    isSupported: false,
    isLoading: true
  });
  const [showRegistration, setShowRegistration] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Verificar suporte e status dos dados faciais
  const checkFaceSupport = async () => {
    try {
      setStatus(prev => ({ ...prev, isLoading: true }));
      
      const supported = isFaceRecognitionSupported();
      console.log('📱 Suporte ao reconhecimento facial:', supported);
      
      if (supported) {
        const faceDataResponse = await faceAuthService.checkFaceData();
        console.log('📊 Status dos dados faciais:', faceDataResponse);
        
        setStatus({
          hasFaceData: faceDataResponse.hasFaceData,
          isSupported: true,
          isLoading: false
        });
      } else {
        setStatus({
          hasFaceData: false,
          isSupported: false,
          isLoading: false
        });
      }
    } catch (error) {
      console.error('❌ Erro ao verificar suporte:', error);
      setStatus({
        hasFaceData: false,
        isSupported: false,
        isLoading: false
      });
      setError('Erro ao verificar suporte ao reconhecimento facial');
    }
  };

  useEffect(() => {
    checkFaceSupport();
  }, []);

  // Remover dados faciais
  const handleRemoveFaceData = async () => {
    if (!window.confirm('Tem certeza que deseja remover seus dados faciais? Isso desabilitará o login por reconhecimento facial.')) {
      return;
    }

    try {
      setStatus(prev => ({ ...prev, isLoading: true }));
      setError(null);
      
      const response = await faceAuthService.removeFaceData();
      
      if (response.success) {
        console.log('✅ Dados faciais removidos com sucesso');
        setStatus(prev => ({ ...prev, hasFaceData: false }));
      } else {
        console.log('❌ Erro ao remover dados faciais:', response.message);
        setError(response.message);
      }
    } catch (error) {
      console.error('❌ Erro ao remover dados faciais:', error);
      setError('Erro interno ao remover dados faciais');
    } finally {
      setStatus(prev => ({ ...prev, isLoading: false }));
    }
  };

  // Atualizar dados faciais
  const handleUpdateFaceData = () => {
    setShowRegistration(true);
  };

  // Callbacks para o registro
  const handleRegistrationSuccess = (message: string) => {
    console.log('✅ Registro facial realizado:', message);
    setShowRegistration(false);
    setStatus(prev => ({ ...prev, hasFaceData: true }));
    setError(null);
  };

  const handleRegistrationError = (error: string) => {
    console.log('❌ Erro no registro facial:', error);
    setError(error);
  };

  const handleRegistrationCancel = () => {
    setShowRegistration(false);
  };

  // Se mostrar registro, renderizar componente FaceRegistration
  if (showRegistration) {
    return (
      <FaceRegistration
        onRegistrationSuccess={handleRegistrationSuccess}
        onRegistrationError={handleRegistrationError}
        onCancel={handleRegistrationCancel}
        className={className}
      />
    );
  }

  return (
    <div className={`face-settings-container ${className}`}>
      <div className="face-settings-header">
        <h3>👤 Reconhecimento Facial</h3>
        <button onClick={onClose} className="close-button">
          ✕
        </button>
      </div>

      <div className="face-settings-content">
        {status.isLoading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Verificando configurações...</p>
          </div>
        ) : !status.isSupported ? (
          <div className="not-supported">
            <div className="icon">📱</div>
            <h4>Dispositivo Não Suportado</h4>
            <p>Seu dispositivo não suporta reconhecimento facial ou não possui câmera.</p>
            <p className="requirements">
              <strong>Requisitos:</strong><br />
              • Câmera frontal<br />
              • Navegador moderno<br />
              • HTTPS (para produção)
            </p>
          </div>
        ) : (
          <>
            {/* Status atual */}
            <div className="status-card">
              <div className="status-icon">
                {status.hasFaceData ? '✅' : '❌'}
              </div>
              <div className="status-content">
                <h4>Status Atual</h4>
                <p>
                  {status.hasFaceData 
                    ? 'Reconhecimento facial configurado e ativo'
                    : 'Reconhecimento facial não configurado'
                  }
                </p>
              </div>
            </div>

            {/* Ações */}
            <div className="actions-section">
              {status.hasFaceData ? (
                <>
                  <button
                    onClick={handleUpdateFaceData}
                    className="btn-primary"
                  >
                    🔄 Atualizar Dados Faciais
                  </button>
                  
                  <button
                    onClick={handleRemoveFaceData}
                    className="btn-danger"
                    disabled={status.isLoading}
                  >
                    🗑️ Remover Dados Faciais
                  </button>
                </>
              ) : (
                <button
                  onClick={handleUpdateFaceData}
                  className="btn-primary"
                >
                  👤 Configurar Reconhecimento Facial
                </button>
              )}
            </div>

            {/* Informações */}
            <div className="info-section">
              <h4>ℹ️ Como Funciona</h4>
              <ul>
                <li>Capture múltiplas fotos do seu rosto</li>
                <li>Os dados são armazenados de forma segura</li>
                <li>Use para login rápido e seguro</li>
                <li>Pode ser removido a qualquer momento</li>
              </ul>
            </div>
          </>
        )}

        {/* Mensagem de erro */}
        {error && (
          <div className="error-message">
            <p>❌ {error}</p>
            <button onClick={() => setError(null)} className="btn-secondary">
              Fechar
            </button>
          </div>
        )}
      </div>

      <div className="face-settings-actions">
        <button onClick={onClose} className="btn-secondary">
          Voltar
        </button>
      </div>
    </div>
  );
};

export default FaceSettings; 