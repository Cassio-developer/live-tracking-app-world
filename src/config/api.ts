// Configuração centralizada das URLs da API
export const config = {
  API_URL: process.env.REACT_APP_API_URL || 'http://localhost:4000',
  SOCKET_URL: process.env.REACT_APP_SOCKET_URL || 'http://localhost:4000',
  BACKGROUND_SYNC_ENABLED: process.env.REACT_APP_BACKGROUND_SYNC_ENABLED === 'true',
  BACKGROUND_SYNC_INTERVAL: parseInt(process.env.REACT_APP_BACKGROUND_SYNC_INTERVAL || '30000'),
  IS_PRODUCTION: process.env.NODE_ENV === 'production'
}; 