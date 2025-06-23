import React from 'react';

interface StatusUsuarioProps {
  online: boolean;
  nome: string;
  timestamp: number;
  emMovimento: boolean;
  tempoParadoSegundos: number;
}

const StatusUsuario: React.FC<StatusUsuarioProps> = ({ online, nome, timestamp, emMovimento, tempoParadoSegundos }) => {
  return (
    <div style={{ minWidth: 120 }}>
      <b>{nome}</b><br />
      Status: <span style={{ color: online ? 'green' : 'red' }}>{online ? 'Online' : 'Offline'}</span><br />
      {emMovimento ? (
        <span>Em movimento</span>
      ) : (
        <span>Parado há {tempoParadoSegundos} seg</span>
      )}<br />
      <small>Última atualização: {new Date(timestamp).toLocaleTimeString()}</small>
    </div>
  );
};

export default StatusUsuario; 