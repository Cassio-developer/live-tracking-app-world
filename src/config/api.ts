// Configuração centralizada das URLs da API
export const API_CONFIG = {
  // URL da API REST
  API_URL: process.env.REACT_APP_API_URL || 'http://localhost:4000',
  
  // URL do Socket.io
  SOCKET_URL: process.env.REACT_APP_SOCKET_URL || 'http://localhost:4000',
  
  // Verifica se está em produção
  IS_PRODUCTION: process.env.NODE_ENV === 'production'
}; 