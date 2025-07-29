import React from 'react';
import StatusUsuario from './StatusUsuario';
import './DrawerUsuarios.css';

interface UsuarioDrawer {
  id: string;
  nome: string;
  avatar: string;
  timestamp: number;
  emMovimento: boolean;
  tempoParadoSegundos: number;
}

interface DrawerUsuariosProps {
  usuarios: UsuarioDrawer[];
  aberto: boolean;
  onClose: () => void;
  isAdmin?: boolean;
  onRemoverUsuario?: (id: string) => void;
  meuId: string;
}

const DrawerUsuarios: React.FC<DrawerUsuariosProps> = ({ usuarios, aberto, onClose, isAdmin, onRemoverUsuario, meuId }) => {

  return (
    <div className={`drawer-usuarios-overlay${aberto ? ' aberto' : ''}`}>
      <div className="drawer-usuarios">
        <button className="drawer-fechar" onClick={onClose}>×</button>
        <h3>Usuários Online</h3>
        <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {usuarios.length === 0 && <p>Nenhum usuário online.</p>}
          {usuarios.map(usuario => (
            <div key={usuario.id} className="drawer-usuario-item">
              <div className="avatar-modern avatar-small" style={{ marginRight: 10 }}>
                <img src={usuario.avatar} alt="avatar" />
              </div>
              <StatusUsuario
                online={true}
                nome={usuario.nome}
                timestamp={usuario.timestamp}
                emMovimento={usuario.emMovimento}
                tempoParadoSegundos={usuario.tempoParadoSegundos}
              />
              {isAdmin && usuario.id !== meuId && (
                <button
                  style={{ marginLeft: 10, background: '#dc3545', color: '#fff', border: 'none', borderRadius: 6, padding: '0.3rem 0.7rem', cursor: 'pointer' }}
                  onClick={() => onRemoverUsuario && onRemoverUsuario(usuario.id)}
                  title="Remover usuário"
                >
                  Remover
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DrawerUsuarios; 