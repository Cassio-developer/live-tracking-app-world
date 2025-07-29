import { useState, useEffect, useCallback } from 'react';
import { config } from '../config/api';

interface BackgroundSyncStatus {
  isSupported: boolean;
  isRegistered: boolean;
  isOnline: boolean;
  pendingSyncs: number;
  isEnabled: boolean;
}

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  userId: string;
  token: string;
}

export const useBackgroundSync = () => {
  const [status, setStatus] = useState<BackgroundSyncStatus>({
    isSupported: false,
    isRegistered: false,
    isOnline: navigator.onLine,
    pendingSyncs: 0,
    isEnabled: config.BACKGROUND_SYNC_ENABLED
  });

  // Verificar suporte ao Background Sync
  useEffect(() => {
    const checkSupport = () => {
      const isSupported = 'serviceWorker' in navigator && 'caches' in window;
      
      setStatus(prev => ({ ...prev, isSupported }));
    };

    checkSupport();
  }, []);

  // Monitorar status online/offline
  useEffect(() => {
    const handleOnline = () => setStatus(prev => ({ ...prev, isOnline: true }));
    const handleOffline = () => setStatus(prev => ({ ...prev, isOnline: false }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Registrar Background Sync
  const registerBackgroundSync = useCallback(async () => {
    try {
      if (!status.isSupported) {
        throw new Error('Background Sync não é suportado');
      }

      const registration = await navigator.serviceWorker.ready;
      await (registration as any).sync.register('location-sync');
      
      setStatus(prev => ({ ...prev, isRegistered: true }));
      
      return true;
    } catch (error) {
      console.error('❌ Erro ao registrar Background Sync:', error);
      return false;
    }
  }, [status.isSupported]);

  // Salvar localização para sincronização posterior
  const saveLocationForSync = useCallback(async (locationData: LocationData) => {
    // Se background sync estiver desabilitado, usar método tradicional
    if (!status.isEnabled) {
      try {
        const response = await fetch(`${config.API_URL}/api/location/update`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${locationData.token}`
          },
          body: JSON.stringify(locationData)
        });

        if (response.ok) {
          return { success: true, synced: true };
        } else {
          console.warn('⚠️ Falha no envio via método tradicional');
          return { success: false, synced: false };
        }
      } catch (error) {
        console.error('❌ Erro no método tradicional:', error);
        return { success: false, synced: false };
      }
    }

    try {
      // Tentar enviar diretamente primeiro
      const response = await fetch(`${config.API_URL}/api/location/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${locationData.token}`
        },
        body: JSON.stringify(locationData)
      });

      if (response.ok) {
        return { success: true, synced: true };
      } else {
        // Se falhar, salvar para sincronização posterior
        await saveToCache(locationData);
        await registerBackgroundSync();
        
        setStatus(prev => ({ 
          ...prev, 
          pendingSyncs: prev.pendingSyncs + 1 
        }));
        
        return { success: true, synced: false };
      }
    } catch (error) {
      console.error('❌ Erro ao salvar localização:', error);
      
      // Salvar no cache mesmo em caso de erro
      await saveToCache(locationData);
      await registerBackgroundSync();
      
      setStatus(prev => ({ 
        ...prev, 
        pendingSyncs: prev.pendingSyncs + 1 
      }));
      
      return { success: true, synced: false };
    }
  }, [registerBackgroundSync, status.isEnabled]);

  // Salvar no cache
  const saveToCache = async (locationData: LocationData) => {
    try {
      const cache = await caches.open('location-data');
      const cacheKey = new Request(`/location-${Date.now()}.json`);
      const cacheResponse = new Response(JSON.stringify(locationData), {
        headers: { 'Content-Type': 'application/json' }
      });
      
      await cache.put(cacheKey, cacheResponse);
    } catch (error) {
      console.error('❌ Erro ao salvar no cache:', error);
    }
  };

  // Verificar sincronizações pendentes
  const checkPendingSyncs = useCallback(async () => {
    try {
      const cache = await caches.open('location-data');
      const requests = await cache.keys();
      
      setStatus(prev => ({ ...prev, pendingSyncs: requests.length }));
      
      return requests.length;
    } catch (error) {
      console.error('❌ Erro ao verificar sincronizações pendentes:', error);
      return 0;
    }
  }, []);

  // Forçar sincronização
  const forceSync = useCallback(async () => {
    try {
      await registerBackgroundSync();
    } catch (error) {
      console.error('❌ Erro ao forçar sincronização:', error);
    }
  }, [registerBackgroundSync]);

  // Limpar cache de localizações
  const clearLocationCache = useCallback(async () => {
    try {
      const cache = await caches.open('location-data');
      const requests = await cache.keys();
      
      for (const request of requests) {
        await cache.delete(request);
      }
      
      setStatus(prev => ({ ...prev, pendingSyncs: 0 }));
    } catch (error) {
      console.error('❌ Erro ao limpar cache:', error);
    }
  }, []);

  return {
    status,
    registerBackgroundSync,
    saveLocationForSync,
    checkPendingSyncs,
    forceSync,
    clearLocationCache
  };
}; 