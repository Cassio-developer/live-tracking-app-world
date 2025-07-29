import React, { useState } from 'react';
import { config } from '../config/api';

const TestAPI: React.FC = () => {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testAPI = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${config.API_URL}/test`);
      const data = await response.json();
      setResult(data);
    } catch (error: any) {
      setResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const testUsuarios = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${config.API_URL}/debug/usuarios`);
      const data = await response.json();
      setResult(data);
    } catch (error: any) {
      setResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h2>🧪 Teste de API</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={testAPI}
          disabled={loading}
          style={{ marginRight: '10px', padding: '10px 20px' }}
        >
          {loading ? 'Testando...' : 'Testar API'}
        </button>
        
        <button 
          onClick={testUsuarios}
          disabled={loading}
          style={{ padding: '10px 20px' }}
        >
          {loading ? 'Testando...' : 'Ver Usuários Conectados'}
        </button>
      </div>

      {result && (
        <div style={{ 
          background: '#f5f5f5', 
          padding: '15px', 
          borderRadius: '8px',
          whiteSpace: 'pre-wrap',
          fontFamily: 'monospace',
          fontSize: '12px'
        }}>
          <strong>Resultado:</strong>
          <br />
          {JSON.stringify(result, null, 2)}
        </div>
      )}

      <div style={{ marginTop: '20px', fontSize: '14px', color: '#666' }}>
        <p><strong>URL da API:</strong> {config.API_URL}</p>
        <p><strong>URL do Socket:</strong> {config.API_URL}</p>
        <p><strong>Ambiente:</strong> {config.IS_PRODUCTION ? 'Produção' : 'Desenvolvimento'}</p>
      </div>
    </div>
  );
};

export default TestAPI; 