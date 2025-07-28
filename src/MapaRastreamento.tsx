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
import { useIsMobile, useOrientation } from './hooks';

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

  // Função para calcular distância entre dois pontos
  function calcularDistancia([lat1, lng1]: [number, number], [lat2, lng2]: [number, number]) {
    const toRad = (v: number) => (v * Math.PI) / 180;
    const R = 6371000; // Raio da Terra em metros
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // Função para suavizar posição usando média móvel
  function smoothPosition(newPosition: [number, number], accuracy: number): [number, number] {
    const now = Date.now();
    const maxAge = 10000; // 10 segundos
    
    // Adicionar nova posição ao buffer
    setPositionBuffer(prev => {
      const filtered = prev.filter(p => now - p.timestamp < maxAge);
      const updated = [...filtered, { position: newPosition, accuracy, timestamp: now }];
      
      // Calcular posição suavizada
      if (updated.length >= 3) {
        const weights = updated.map(p => 1 / p.accuracy); // Peso inverso à precisão
        const totalWeight = weights.reduce((sum, w) => sum + w, 0);
        
        const smoothedLat = updated.reduce((sum, p, i) => sum + p.position[0] * weights[i], 0) / totalWeight;
        const smoothedLng = updated.reduce((sum, p, i) => sum + p.position[1] * weights[i], 0) / totalWeight;
        
        return updated;
      }
      
      return updated;
    });
    
    // Retornar posição suavizada se tiver dados suficientes
    const currentBuffer = positionBuffer.filter(p => now - p.timestamp < maxAge);
    if (currentBuffer.length >= 3) {
      const weights = currentBuffer.map(p => 1 / p.accuracy);
      const totalWeight = weights.reduce((sum, w) => sum + w, 0);
      
      const smoothedLat = currentBuffer.reduce((sum, p, i) => sum + p.position[0] * weights[i], 0) / totalWeight;
      const smoothedLng = currentBuffer.reduce((sum, p, i) => sum + p.position[1] * weights[i], 0) / totalWeight;
      
      return [smoothedLat, smoothedLng];
    }
    
    return newPosition;
  }

  // Função para calibrar GPS
  function startCalibration() {
    setCalibrationData(prev => ({ ...prev, isCalibrating: true, samples: [] }));
    
    let samples: [number, number][] = [];
    let sampleCount = 0;
    const maxSamples = 10;
    
    const calibrationInterval = setInterval(() => {
      if (posicaoAtual && accuracy && accuracy < 50) { // Apenas amostras com precisão aceitável
        samples.push(posicaoAtual);
        sampleCount++;
        
        if (sampleCount >= maxSamples) {
          clearInterval(calibrationInterval);
          
          // Calcular posição média
          const avgLat = samples.reduce((sum, pos) => sum + pos[0], 0) / samples.length;
          const avgLng = samples.reduce((sum, pos) => sum + pos[1], 0) / samples.length;
          
          setPosicaoAtual([avgLat, avgLng]);
          setCalibrationData(prev => ({ 
            ...prev, 
            isCalibrating: false, 
            calibrated: true,
            samples: samples 
          }));
          
          console.log('✅ Calibração GPS concluída');
        }
      }
    }, 1000);
    
    // Timeout de segurança
    setTimeout(() => {
      clearInterval(calibrationInterval);
      setCalibrationData(prev => ({ ...prev, isCalibrating: false }));
    }, 30000);
  }

  const loginSchema = z.object({
    nome: z.string().min(1, 'Digite seu nome ou apelido'),

  });
  
  const [erros, setErros] = useState<{ nome?: string; senhaAdmin?: string }>({});
  
  const [posicaoAtual, setPosicaoAtual] = useState<[number, number] | null>(null);
  const [localizacoes, setLocalizacoes] = useState<{ [key: string]: Localizacao }>({});
  const socketRef = useRef<Socket | null>(null);
  const [usuariosConectados, setUsuariosConectados] = useState<any[]>([]);

  // Estados para seleção de avatar no modal
  const [tipoAvatarSelecionado, setTipoAvatarSelecionado] = useState<string>(tiposAvatar[0].seedPrefix);
  const [avatarSeedSelecionado, setAvatarSeedSelecionado] = useState<string>(Math.random().toString(36).substring(2, 15));
  
  // O avatarUrl agora é derivado do user ou da seleção no modal
  const avatarUrl = user?.avatar || gerarAvatarUrl(avatarSeedSelecionado, tipoAvatarSelecionado);

  // Hook para detectar dispositivo móvel
  const { isMobile, isTablet, screenWidth, screenHeight } = useIsMobile();
  const orientation = useOrientation();

  // Estados do componente
  const [showModal, setShowModal] = useState<boolean>(false);
  const [nome, setNome] = useState<string>('');
  const [ultimaPosicao, setUltimaPosicao] = useState<[number, number] | null>(null);
  const [ultimoMovimento, setUltimoMovimento] = useState<number>(Date.now());
  const [drawerAberto, setDrawerAberto] = useState(false);
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [rota, setRota] = useState<[number, number][]>([]);

  // Sistema de calibração para melhorar precisão
  const [calibrationData, setCalibrationData] = useState<{
    samples: [number, number][];
    isCalibrating: boolean;
    calibrated: boolean;
  }>({
    samples: [],
    isCalibrating: false,
    calibrated: false
  });

  // Sistema de suavização para reduzir ruído
  const [positionBuffer, setPositionBuffer] = useState<Array<{
    position: [number, number];
    accuracy: number;
    timestamp: number;
  }>>([]);

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
      socketRef.current.emit('identificacao', {
        nome: user.nome,
        avatar: user.avatar,
        isAdmin: user.isAdmin
      });
    }

    // Recebe lista de conectados (apenas admin)
    socketRef.current.on('usuariosConectados', (usuarios) => {
      setUsuariosConectados(usuarios);
    });

    socketRef.current.on('connect', () => {
      // Conectado ao servidor
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
      // Configurações ultra-otimizadas para máxima precisão
      const options = {
        enableHighAccuracy: true,    // Usar GPS quando disponível
        maximumAge: 500,             // Aceitar posições com até 500ms de idade
        timeout: 60000,              // 60 segundos de timeout para melhor precisão
      };

      // Sistema de filtragem para melhorar precisão
      let lastValidPosition: GeolocationPosition | null = null;
      let accuracyThreshold = 100; // Aceitar posições com precisão melhor que 100 metros

      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          // Verificar se a precisão é aceitável
          if (position.coords.accuracy > accuracyThreshold) {
            console.log(`⚠️ Posição rejeitada - Precisão muito baixa: ${position.coords.accuracy}m (threshold: ${accuracyThreshold}m)`);
            console.log(`📊 Dados da posição:`, {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              altitude: position.coords.altitude,
              heading: position.coords.heading,
              speed: position.coords.speed
            });
            
            // Se a precisão for extremamente baixa (> 1000m), tentar configurações alternativas
            if (position.coords.accuracy > 1000) {
              console.log('🔄 Tentando obter posição com configurações alternativas...');
              navigator.geolocation.getCurrentPosition(
                (fallbackPosition) => {
                  console.log(`✅ Posição alternativa obtida - Precisão: ${fallbackPosition.coords.accuracy}m`);
                  const fallbackPos: [number, number] = [fallbackPosition.coords.latitude, fallbackPosition.coords.longitude];
                  setPosicaoAtual(fallbackPos);
                  setAccuracy(fallbackPosition.coords.accuracy);
                },
                (fallbackError) => {
                  console.error('❌ Falha também com configurações alternativas:', fallbackError);
                },
                { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
              );
            }
            return;
          }

          // Filtro de velocidade para detectar posições anômalas
          if (lastValidPosition) {
            const timeDiff = position.timestamp - lastValidPosition.timestamp;
            const distance = calcularDistancia(
              [lastValidPosition.coords.latitude, lastValidPosition.coords.longitude],
              [position.coords.latitude, position.coords.longitude]
            );
            
            // Calcular velocidade (m/s)
            const speed = distance / (timeDiff / 1000);
            
            // Rejeitar se velocidade for impossível (> 50 m/s = 180 km/h)
            if (speed > 50) {
              console.log(`⚠️ Posição rejeitada - Velocidade impossível: ${speed.toFixed(1)} m/s`);
              return;
            }
          }

          const novaPosicao: [number, number] = [position.coords.latitude, position.coords.longitude];
          
          // Aplicar suavização se calibrado
          const smoothedPosition = calibrationData.calibrated ? 
            smoothPosition(novaPosicao, position.coords.accuracy) : 
            novaPosicao;
          
          setPosicaoAtual(smoothedPosition);
          setAccuracy(position.coords.accuracy);
          
          // Log detalhado da precisão
          console.log(`📍 Nova localização - Precisão: ${position.coords.accuracy}m, Velocidade: ${position.coords.speed || 'N/A'} m/s`);

          // Adicionar à rota apenas se mudou significativamente (mais de 2 metros)
          setRota(prev => {
            if (prev.length === 0) {
              return [novaPosicao];
            }
            
            const lastPos = prev[prev.length - 1];
            const distance = calcularDistancia(lastPos, novaPosicao);
            
            if (distance > 2) { // Aumentado para 2 metros para melhor precisão
              return [...prev, novaPosicao];
            }
            return prev;
          });
          
          // Detectar movimento com precisão melhorada
          if (ultimaPosicao) {
            const dist = calcularDistancia(ultimaPosicao, novaPosicao);
            if (dist > 2) { // Aumentado para 2 metros
              setUltimoMovimento(Date.now());
            }
          }
          
          setUltimaPosicao(novaPosicao);
          lastValidPosition = position;
          
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
            console.log('⏰ Timeout - Tentando com configurações alternativas...');
            navigator.geolocation.getCurrentPosition(
              (position) => {
                console.log('✅ Localização obtida com configurações alternativas');
                setPosicaoAtual([position.coords.latitude, position.coords.longitude]);
                setAccuracy(position.coords.accuracy);
              },
              (fallbackError) => {
                console.error('Falha também com configurações alternativas:', fallbackError);
              },
              { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
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
  }

  return (
    <div style={{ height: '100vh', width: '100%' }}>
      {/* Botão de logout */}
      <button
        style={{
          position: 'fixed',
          top: 20,
          left: 50,
          zIndex: 1000,
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
          zIndex: 1000,
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
          zIndex: 1000,
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
          zIndex: 1000,
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

      {/* Botão para calibrar GPS */}
      <button
        style={{
          position: 'fixed',
          top: 80,
          right: 157,
          zIndex: 1000,
          background: calibrationData.isCalibrating ? '#ffc107' : '#28a745',
          color: '#fff',
          border: 'none',
          borderRadius: '50%',
          width: 48,
          height: 48,
          fontSize: 20,
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        }}
        onClick={startCalibration}
        disabled={calibrationData.isCalibrating}
        title={calibrationData.isCalibrating ? "Calibrando GPS..." : "Calibrar GPS"}
      >
        {calibrationData.isCalibrating ? '⏳' : '��'}
      </button>

      {/* Indicador de qualidade da localização */}
      {accuracy && (
        <div
          style={{
            position: 'fixed',
            top: isMobile ? 89 : 20,
            left: isMobile ? 50 : 200,
            zIndex: 1000,
            background: accuracy < 10 ? '#28a745' : accuracy < 50 ? '#ffc107' : accuracy < 200 ? '#fd7e14' : '#dc3545',
            color: '#fff',
            border: 'none',
            borderRadius: isMobile ? '4px' : '8px',
            padding: isMobile ? '4px 8px' : '8px 16px',
            fontSize: isMobile ? '12px' : '14px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? '4px' : '8px'
          }}
        >
          <span>📍</span>
          <span>
            {accuracy < 10 ? 'Excelente' : accuracy < 50 ? 'Boa' : accuracy < 200 ? 'Aceitável' : 'Baixa'} 
            ({accuracy.toFixed(1)}m)
          </span>
          {calibrationData.calibrated && <span>✅</span>}
        </div>
      )}

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
            zIndex: 1500,
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
      <MapContainer center={posicaoAtual || POSICAO_INICIAL} zoom={16} style={{ height: '100%', width: '100%' }}>
        <CentralizarMapa posicao={posicaoAtual || POSICAO_INICIAL} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {/* Linha da rota do usuário */}
        {rota.length > 1 && (
          <Polyline positions={rota} pathOptions={{ color: '#007bff', weight: 4, opacity: 0.7 }} />
        )}
        {/* Marcador do usuário atual */}
        {posicaoAtual && (
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
        )}
        {/* Círculo de precisão */}
        {accuracy && (
          <Circle
            center={posicaoAtual || POSICAO_INICIAL}
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