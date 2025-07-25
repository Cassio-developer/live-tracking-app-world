import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle, Polyline } from 'react-leaflet';
import { io, Socket } from 'socket.io-client';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './ModalNome.css';
import StatusUsuario from './StatusUsuario';
import DrawerUsuarios from './DrawerUsuarios';
import ProfileSettings from './components/ProfileSettings';
import { useNavigate } from 'react-router-dom';
import { Icon } from 'leaflet';
import { API_CONFIG } from './config/api';
import { useAuth } from './contexts/AuthContext';
import { authService } from './services/authService';
import { z } from 'zod';

interface Localizacao {
  lat: number;
  lng: number;
  timestamp: number;
  avatar: string;
  nome: string;
  accuracy?: number;
  altitude?: number;
  heading?: number;
  speed?: number;
}

const MapaRastreamento: React.FC = () => {
  const { logout, user, checkAuth } = useAuth();
  const navigate = useNavigate();

  // URL do backend (Socket.io)
  // Backend hospedado no Render
  const SOCKET_URL = API_CONFIG.SOCKET_URL;
  const POSICAO_INICIAL: [number, number] = [-23.55052, -46.633308]; // São Paulo

  const tiposAvatar = [
    { label: 'Carro', seedPrefix: 'car' },
    { label: 'Moto', seedPrefix: 'motorcycle' },
    { label: 'Caminhão', seedPrefix: 'truck' },
    { label: 'Ônibus', seedPrefix: 'bus' },
  ];

  function gerarAvatarUrl(seed: string, tipo: string) {
    return `https://api.dicebear.com/7.x/icons/svg?seed=${tipo}-${seed}`;
  }

  // Componente auxiliar para centralizar o mapa
  function CentralizarMapa({ posicao }: { posicao: [number, number] }) {
    const map = useMap();
    useEffect(() => {
      map.setView(posicao);
    }, [posicao, map]);
    return null;
  }

  // Função utilitária para calcular distância entre duas coordenadas (em metros)
  function calcularDistancia([lat1, lng1]: [number, number], [lat2, lng2]: [number, number]) {
    const R = 6371e3; // raio da Terra em metros
    const toRad = (v: number) => (v * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  const loginSchema = z.object({
    nome: z.string().min(1, 'Digite seu nome ou apelido'),

  });
  
  const [erros, setErros] = useState<{ nome?: string; senhaAdmin?: string }>({});
  
  const [posicaoAtual, setPosicaoAtual] = useState<[number, number]>(POSICAO_INICIAL);
  const [localizacoes, setLocalizacoes] = useState<{ [key: string]: Localizacao }>({});
  const socketRef = useRef<Socket | null>(null);
  const [usuariosConectados, setUsuariosConectados] = useState<any[]>([]);

  // Estados para seleção de avatar no modal
  const [tipoAvatarSelecionado, setTipoAvatarSelecionado] = useState<string>(tiposAvatar[0].seedPrefix);
  const [avatarSeedSelecionado, setAvatarSeedSelecionado] = useState<string>(Math.random().toString(36).substring(2, 15));
  
  // O avatarUrl agora é derivado do user ou da seleção no modal
  const avatarUrl = user?.avatar || gerarAvatarUrl(avatarSeedSelecionado, tipoAvatarSelecionado);

  const [showModal, setShowModal] = useState<boolean>(false);
  
  const [nome, setNome] = useState<string>('');
  const [ultimaPosicao, setUltimaPosicao] = useState<[number, number] | null>(null);
  const [ultimoMovimento, setUltimoMovimento] = useState<number>(Date.now());
  const [drawerAberto, setDrawerAberto] = useState(false);
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [rota, setRota] = useState<[number, number][]>([]);

  // Controla a exibição do modal
  useEffect(() => {
    if (user && !user.avatar) {
      setShowModal(true);
    } else {
      setShowModal(false);
    }
  }, [user]);

  // Atualizar status de admin quando o usuário faz login
  useEffect(() => {
    if (user) {
      setIsAdmin(user.isAdmin || false);
      console.log('👤 Status de admin atualizado:', user.isAdmin);
    }
  }, [user]);

  // Modal de seleção de avatar
  const ModalAvatar = () => (
    <div className="modal-nome-overlay">
      <div className="modal-nome-content">
        <h2>Escolha seu Avatar</h2>
        <p>Esta será sua imagem permanente no sistema.</p>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1rem' }}>
          <img src={avatarUrl} alt="Avatar" style={{ width: 64, height: 64, borderRadius: '50%', marginBottom: 8, border: '2px solid #007bff' }} />
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {tiposAvatar.map(tipo => (
              <button
                key={tipo.seedPrefix}
                type="button"
                style={{
                  background: tipoAvatarSelecionado === tipo.seedPrefix ? '#007bff' : '#eee',
                  color: tipoAvatarSelecionado === tipo.seedPrefix ? '#fff' : '#333',
                  border: 'none',
                  borderRadius: 6,
                  padding: '0.3rem 0.8rem',
                  cursor: 'pointer',
                  fontWeight: tipoAvatarSelecionado === tipo.seedPrefix ? 'bold' : 'normal',
                }}
                onClick={() => setTipoAvatarSelecionado(tipo.seedPrefix)}
              >
                {tipo.label}
              </button>
            ))}
          </div>
          <button type="button" style={{ marginBottom: 12 }} onClick={() => setAvatarSeedSelecionado(Math.random().toString(36).substring(2, 15))}>
            Gerar outro
          </button>
        </div>
        <button onClick={handleConfirmarAvatar}>Salvar Avatar</button>
      </div>
    </div>
  );

  // Salva o avatar escolhido
  async function handleConfirmarAvatar() {
    try {
      await authService.updateAvatar(avatarUrl);
      await checkAuth(); // Recarrega os dados do usuário para obter o novo avatar
      setShowModal(false);
    } catch (error) {
      console.error("Erro ao salvar avatar:", error);
      // Opcional: mostrar um erro para o usuário
    }
  }

  useEffect(() => {
    // Conectar com o servidor Socket.io
    socketRef.current = io(SOCKET_URL);

    // Envie identificação ao conectar
    if (user) {
      console.log('🔌 Enviando identificação:', { nome: user.nome, isAdmin: user.isAdmin });
      socketRef.current.emit('identificacao', {
        nome: user.nome,
        avatar: user.avatar,
        isAdmin: user.isAdmin
      });
    }

    // Recebe lista de conectados (apenas admin)
    socketRef.current.on('usuariosConectados', (usuarios) => {
      console.log('📋 Recebida lista de usuários conectados:', usuarios.length, 'usuários');
      console.log('👥 Usuários:', usuarios.map((u: any) => ({ nome: u.nome, isAdmin: u.isAdmin })));
      setUsuariosConectados(usuarios);
    });

    socketRef.current.on('connect', () => {
      console.log('🔌 Conectado ao servidor:', socketRef.current?.id);
    });

    // Receber localizações de todos os usuários
    socketRef.current.on('localizacoes', (data: { [key: string]: Localizacao }) => {
      setLocalizacoes(data);
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [user]);

  useEffect(() => {
    if (showModal || !user) return;
    if (navigator.geolocation) {
      // Configurações otimizadas para máxima precisão
      const options = {
        enableHighAccuracy: true,    // Usar GPS quando disponível
        maximumAge: 1000,           // Aceitar posições com até 1 segundo de idade
        timeout: 30000,             // 30 segundos de timeout
      };

      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const novaPosicao: [number, number] = [position.coords.latitude, position.coords.longitude];
          setPosicaoAtual(novaPosicao);
          setAccuracy(position.coords.accuracy);
          
          // Log detalhado da precisão
          console.log('📍 Nova localização:', {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            heading: position.coords.heading,
            speed: position.coords.speed,
            timestamp: position.timestamp
          });

          setRota(prev => {
            // Só adiciona se mudou de posição significativamente (mais de 1 metro)
            if (prev.length === 0 || prev[prev.length - 1][0] !== novaPosicao[0] || prev[prev.length - 1][1] !== novaPosicao[1]) {
              return [...prev, novaPosicao];
            }
            return prev;
          });
          
          // Detectar movimento com precisão melhorada
          if (ultimaPosicao) {
            const dist = calcularDistancia(ultimaPosicao, novaPosicao);
            if (dist > 1) { // Considera movimento se mudou mais de 1 metro
              setUltimoMovimento(Date.now());
            }
          }
          setUltimaPosicao(novaPosicao);
          
          if (socketRef.current) {
            socketRef.current.emit('localizacao', {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              timestamp: Date.now(),
              avatar: avatarUrl,
              nome: user ? user.nome : nome,
              isAdmin: isAdmin,
              accuracy: position.coords.accuracy,
              altitude: position.coords.altitude,
              heading: position.coords.heading,
              speed: position.coords.speed
            });
          }
          
          // Salvar no backend com dados completos
          if (user) {
            authService.saveLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              accuracy: position.coords.accuracy,
              timestamp: Date.now()
            }).catch((err: unknown) => console.error('Erro ao salvar localização:', err));
          }
        },
        (error) => {
          console.error('❌ Erro ao obter localização:', error);
          
          // Tentar obter localização com configurações menos restritivas
          if (error.code === error.TIMEOUT) {
            console.log('⏰ Timeout - Tentando com configurações menos restritivas...');
            navigator.geolocation.getCurrentPosition(
              (position) => {
                console.log('✅ Localização obtida com configurações alternativas');
                setPosicaoAtual([position.coords.latitude, position.coords.longitude]);
                setAccuracy(position.coords.accuracy);
              },
              (fallbackError) => {
                console.error('❌ Falha também com configurações alternativas:', fallbackError);
              },
              { enableHighAccuracy: false, timeout: 10000, maximumAge: 30000 }
            );
          }
        },
        options
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
    // eslint-disable-next-line
  }, [showModal, user, avatarUrl, isAdmin]);

  // Função para criar um ícone personalizado com a imagem do avatar
  function criarIconeAvatar(url: string) {
    return L.icon({
      iconUrl: url,
      iconSize: [40, 40],
      iconAnchor: [20, 40],
      popupAnchor: [0, -40],
      className: 'avatar-marker',
    });
  }

  // Montar lista de usuários para o drawer
  const usuariosDrawer = isAdmin 
    ? usuariosConectados.map(u => ({
        id: u.socketId,
        nome: u.nome,
        avatar: u.avatar,
        timestamp: Date.now(),
        emMovimento: true, // Não temos status real, mas pode ser ajustado se necessário
        tempoParadoSegundos: 0
      }))
    : []; // Usuários normais começam com lista vazia
  
  // Adicionar o próprio usuário na lista
  usuariosDrawer.push({
    id: 'me',
    nome: user?.nome || 'Eu',
    avatar: avatarUrl,
    timestamp: Date.now(),
    emMovimento: Date.now() - ultimoMovimento < 10000,
    tempoParadoSegundos: Math.floor((Date.now() - ultimoMovimento) / 1000),
  });

  function handleRemoverUsuario(userId: string) {
    // Implemente a lógica para remover um usuário do drawer
    console.log(`Removendo usuário: ${userId}`);
  }

  return (
    <div style={{ height: '100vh', width: '100%' }}>
      {/* Botão de logout */}
      <button
        style={{
          position: 'fixed',
          top: 20,
          left: 50,
          zIndex: 1200,
          background: '#dc3545',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          padding: '8px 16px',
          fontSize: '14px',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}
        onClick={logout}
        title="Sair"
      >
        <span>🚪</span>
        Sair
      </button>

      {/* Botão para abrir drawer - TODOS OS USUÁRIOS */}
      <button
        style={{
          position: 'fixed',
          top: 20,
          right: 100,
          zIndex: 1200,
          background: '#007bff',
          color: '#fff',
          border: 'none',
          borderRadius: '50%',
          width: 48,
          height: 48,
          fontSize: 28,
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        }}
        onClick={() => setDrawerAberto(true)}
        title="Usuários online"
      >
        👥
      </button>
      {/* Botão para acessar histórico */}
      <button
        style={{
          position: 'fixed',
          top: 20,
          right: 43, // Volta para posição original
          zIndex: 1200,
          background: '#28a745',
          color: '#fff',
          border: 'none',
          borderRadius: '50%',
          width: 48,
          height: 48,
          fontSize: 28,
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        }}
        onClick={() => navigate('/history')}
        title="Histórico de trajetos"
      >
        📈
      </button>

      {/* Botão para configurações do perfil */}
      <button
        style={{
          position: 'fixed',
          top: 20,
          right: 157,
          zIndex: 1200,
          background: '#667eea',
          color: '#fff',
          border: 'none',
          borderRadius: '50%',
          width: 48,
          height: 48,
          fontSize: 20,
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        }}
        onClick={() => setShowProfileSettings(true)}
        title="Configurações do perfil"
      >
        ⚙️
      </button>

      {/* Drawer de usuários - TODOS OS USUÁRIOS */}
      <DrawerUsuarios
        usuarios={usuariosDrawer}
        aberto={drawerAberto}
        onClose={() => setDrawerAberto(false)}
        isAdmin={isAdmin}
        onRemoverUsuario={handleRemoverUsuario}
        meuId={socketRef.current?.id || ''}
      />

      {/* Modal de configurações do perfil */}
      {showProfileSettings && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '20px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowProfileSettings(false);
            }
          }}
        >
          <ProfileSettings
            onClose={() => setShowProfileSettings(false)}
            className="profile-settings-modal"
          />
        </div>
      )}

      {showModal && <ModalAvatar />}
      <MapContainer center={posicaoAtual} zoom={16} style={{ height: '100%', width: '100%' }}>
        <CentralizarMapa posicao={posicaoAtual} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {/* Linha da rota do usuário */}
        {rota.length > 1 && (
          <Polyline positions={rota} pathOptions={{ color: '#007bff', weight: 4, opacity: 0.7 }} />
        )}
        {/* Marcador do usuário atual */}
        <Marker position={posicaoAtual} icon={criarIconeAvatar(avatarUrl)}>
          <Popup>
            <StatusUsuario
              online={true}
              nome={user ? user.nome : nome}
              timestamp={Date.now()}
              emMovimento={Date.now() - ultimoMovimento < 10000}
              tempoParadoSegundos={Math.floor((Date.now() - ultimoMovimento) / 1000)}
            />
            {accuracy && (
              <div style={{marginTop: 8, fontSize: 13, color: '#555'}}>
                Precisão: ±{Math.round(accuracy)} metros
              </div>
            )}
          </Popup>
        </Marker>
        {/* Círculo de precisão */}
        {accuracy && (
          <Circle
            center={posicaoAtual}
            radius={accuracy}
            pathOptions={{ color: '#007bff', fillColor: '#007bff', fillOpacity: 0.15 }}
          />
        )}
        {/* Marcadores de outros usuários */}
        {Object.entries(localizacoes).map(([userId, localizacao]) => {
          if (userId !== socketRef.current?.id) {
            // Calcular status de movimento para outros usuários
            // (Simples: se atualizou nos últimos 10s, está em movimento)
            const emMovimento = Date.now() - localizacao.timestamp < 10000;
            const tempoParadoSegundos = Math.floor((Date.now() - localizacao.timestamp) / 1000);
            return (
              <Marker
                key={userId}
                position={[localizacao.lat, localizacao.lng]}
                icon={criarIconeAvatar(localizacao.avatar)}
              >
                <Popup>
                  <StatusUsuario
                    online={true}
                    nome={localizacao.nome || `Usuário ${userId.slice(0, 8)}`}
                    timestamp={localizacao.timestamp}
                    emMovimento={emMovimento}
                    tempoParadoSegundos={tempoParadoSegundos}
                  />
                </Popup>
              </Marker>
            );
          }
          return null;
        })}
      </MapContainer>
    </div>
  );
};

export default MapaRastreamento; 