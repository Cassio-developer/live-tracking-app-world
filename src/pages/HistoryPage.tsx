import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet';
import { authService } from '../services/authService';
import { formatDate, formatDateTime } from '../utils/dateUtils';
import './HistoryPage.css';
import { useNavigate } from 'react-router-dom';

interface LocationPoint {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: string;
  // Campos alternativos que podem vir do backend
  lat?: number;
  lng?: number;
}

const HistoryPage: React.FC = () => {
  const [history, setHistory] = useState<LocationPoint[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchHistory();
    // eslint-disable-next-line
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await authService.getLocationHistory(from, to);
      
      if (data && data.length > 0) {
  
        // Verificar se há campos com nomes diferentes
        const firstItem = data[0];
        if (firstItem.lat !== undefined) {
        }
        if (firstItem.lng !== undefined) {
        }
      }
      
      // Temporariamente sem filtragem para debug
      const normalizedData = (data || []).map((item: any) => ({
        ...item,
        latitude: item.latitude || item.lat,
        longitude: item.longitude || item.lng,
        timestamp: item.timestamp || item.createdAt || new Date().toISOString()
      }));
      
      setHistory(normalizedData);
      
      console.log('📊 Itens definidos no estado:', normalizedData.length);
    } catch (err: any) {
      console.error('❌ Erro ao buscar histórico:', err);
      setError('Erro ao buscar histórico');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchHistory();
  };

  return (
    <div className="history-container">
      <button
        className="history-back-btn"
        onClick={() => navigate('/')}
        title="Voltar para o mapa"
      >
        <span style={{ fontSize: 22, marginRight: 6, verticalAlign: 'middle' }}>←</span>
        <span style={{ fontWeight: 500, color: '#007bff', fontSize: 16, verticalAlign: 'middle' }}>Voltar</span>
      </button>
      <h2>Histórico de Trajetos</h2>
      <form onSubmit={handleSubmit} className="history-filter-form">
        <label>
          De:
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
        </label>
        <label>
          Até:
          <input type="date" value={to} onChange={e => setTo(e.target.value)} />
        </label>
        <button type="submit" disabled={loading}>Buscar</button>
      </form>
      {loading && <p>Carregando...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {history.length === 0 && !loading && (
        <div>
          <p>Nenhum trajeto encontrado para o período.</p>
          <p style={{ fontSize: '12px', color: '#666' }}>
            Debug: Verifique se você tem localizações salvas no banco de dados.
          </p>
        </div>
      )}
      {history.length > 0 && (
        <div className="history-map-box">
          <MapContainer
            center={[history[0]?.latitude || 0, history[0]?.longitude || 0]}
            zoom={16}
            style={{ height: 400, width: '100%', marginBottom: 0 }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Polyline positions={history.map(p => [p.latitude || 0, p.longitude || 0])} pathOptions={{ color: '#28a745', weight: 4, opacity: 0.7 }} />
            {/* Marcador de início */}
            {history[0] && (
              <Marker position={[history[0].latitude || 0, history[0].longitude || 0]}>
                <Popup>Início<br />{formatDateTime(history[0].timestamp)}</Popup>
              </Marker>
            )}
            {/* Marcador de fim */}
            {history[history.length - 1] && (
              <Marker position={[history[history.length - 1].latitude || 0, history[history.length - 1].longitude || 0]}>
                <Popup>Fim<br />{formatDateTime(history[history.length - 1].timestamp)}</Popup>
              </Marker>
            )}
          </MapContainer>
        </div>
      )}
      {history.length > 0 && (
        <div className="history-details-box">
          <h4>Detalhes do Trajeto</h4>
          <ul>
            {history
              .filter(p => p && p.latitude && p.longitude)
              .map((p, i) => (
                <li key={i}>
                  {formatDateTime(p.timestamp)} - ({p.latitude?.toFixed(5) || 'N/A'}, {p.longitude?.toFixed(5) || 'N/A'})
                  {p.accuracy && <span> | Precisão: ±{Math.round(p.accuracy)}m</span>}
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default HistoryPage; 