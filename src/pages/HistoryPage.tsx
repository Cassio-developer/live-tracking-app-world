import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet';
import { authService } from '../services/authService';
import { formatDate, formatDateTime } from '../utils/dateUtils';
import './HistoryPage.css';
import { useNavigate } from 'react-router-dom';

interface LocationPoint {
  lat: number;
  lng: number;
  accuracy?: number;
  timestamp: string;
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
      setHistory(data);
    } catch (err: any) {
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
      {history.length === 0 && !loading && <p>Nenhum trajeto encontrado para o período.</p>}
      {history.length > 0 && (
        <div className="history-map-box">
          <MapContainer
            center={[history[0].lat, history[0].lng]}
            zoom={16}
            style={{ height: 400, width: '100%', marginBottom: 0 }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Polyline positions={history.map(p => [p.lat, p.lng])} pathOptions={{ color: '#28a745', weight: 4, opacity: 0.7 }} />
            {/* Marcador de início */}
            <Marker position={[history[0].lat, history[0].lng]}>
              <Popup>Início<br />{formatDateTime(history[0].timestamp)}</Popup>
            </Marker>
            {/* Marcador de fim */}
            <Marker position={[history[history.length - 1].lat, history[history.length - 1].lng]}>
              <Popup>Fim<br />{formatDateTime(history[history.length - 1].timestamp)}</Popup>
            </Marker>
          </MapContainer>
        </div>
      )}
      {history.length > 0 && (
        <div className="history-details-box">
          <h4>Detalhes do Trajeto</h4>
          <ul>
            {history.map((p, i) => (
              <li key={i}>
                {formatDateTime(p.timestamp)} - ({p.lat.toFixed(5)}, {p.lng.toFixed(5)})
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