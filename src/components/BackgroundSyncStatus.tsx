import React, { useEffect } from 'react';
import { useBackgroundSync } from '../hooks/useBackgroundSync';
import './BackgroundSyncStatus.css';

const BackgroundSyncStatus: React.FC = () => {
  const { 
    status, 
    checkPendingSyncs, 
    forceSync, 
    clearLocationCache 
  } = useBackgroundSync();

  useEffect(() => {
    // Verificar sincronizações pendentes ao montar
    checkPendingSyncs();
  }, [checkPendingSyncs]);

  if (!status.isSupported) {
    return null; // Não mostrar se não for suportado
  }

  return (
    <div className="background-sync-status">
      <div className="sync-header">
        <h4>🔄 Background Sync</h4>
        <div className="sync-indicators">
          <span className={`indicator ${status.isOnline ? 'online' : 'offline'}`}>
            {status.isOnline ? '🌐 Online' : '📴 Offline'}
          </span>
          {status.pendingSyncs > 0 && (
            <span className="indicator pending">
              📦 {status.pendingSyncs} pendente{status.pendingSyncs > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      <div className="sync-actions">
        {status.pendingSyncs > 0 && (
          <>
            <button 
              onClick={forceSync}
              className="btn-sync"
              title="Forçar sincronização"
            >
              🔄 Sincronizar
            </button>
            <button 
              onClick={clearLocationCache}
              className="btn-clear"
              title="Limpar cache"
            >
              🗑️ Limpar
            </button>
          </>
        )}
      </div>

      <div className="sync-info">
        <p>
          <strong>Status:</strong> {status.isRegistered ? '✅ Registrado' : '❌ Não registrado'}
        </p>
        <p>
          <strong>Habilitado:</strong> {status.isEnabled ? '✅ Sim' : '❌ Não'}
        </p>
        <p>
          <strong>Conexão:</strong> {status.isOnline ? 'Conectado' : 'Desconectado'}
        </p>
        {status.pendingSyncs > 0 && (
          <p>
            <strong>Pendente:</strong> {status.pendingSyncs} localização{status.pendingSyncs > 1 ? 'ões' : 'ão'}
          </p>
        )}
      </div>
    </div>
  );
};

export default BackgroundSyncStatus; 