import React, { useState } from 'react';
import { authService } from '../services/authService';

const TestAPI: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const testGetUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await authService.testGetUsers();
      setUsers(response.users);
    } catch (err: any) {
      setError(err.message || 'Erro ao buscar usuários');
      console.error('Erro:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      position: 'fixed', 
      top: '50%', 
      left: '50%', 
      transform: 'translate(-50%, -50%)',
      background: 'white',
      padding: '20px',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      zIndex: 9999,
      maxWidth: '400px',
      width: '90%'
    }}>
      <h3>Teste da API</h3>
      
      <button 
        onClick={testGetUsers}
        disabled={loading}
        style={{
          background: '#007bff',
          color: 'white',
          border: 'none',
          padding: '10px 20px',
          borderRadius: '4px',
          cursor: loading ? 'not-allowed' : 'pointer',
          marginBottom: '10px'
        }}
      >
        {loading ? 'Carregando...' : 'Testar API - Listar Usuários'}
      </button>

      {error && (
        <div style={{ color: 'red', marginBottom: '10px' }}>
          Erro: {error}
        </div>
      )}

      {users.length > 0 && (
        <div>
          <h4>Usuários encontrados ({users.length}):</h4>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {users.map((user, index) => (
              <li key={index} style={{ 
                padding: '8px', 
                border: '1px solid #ddd', 
                marginBottom: '5px', 
                borderRadius: '4px' 
              }}>
                <strong>Nome:</strong> {user.nome}<br/>
                <strong>Admin:</strong> {user.isAdmin ? 'Sim' : 'Não'}<br/>
                <strong>Criado em:</strong> {new Date(user.createdAt).toLocaleString()}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default TestAPI; 