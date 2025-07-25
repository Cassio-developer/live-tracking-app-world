import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  detectFace, 
  startVideoStream, 
  stopVideoStream, 
  drawFaceLandmarks,
  isFaceRecognitionSupported,
  loadFaceModels,
  FaceDetectionResult 
} from '../../utils/faceRecognition';
import { faceAuthService, FaceLoginResponse } from '../../services/faceAuthService';
import './FaceLogin.css';

interface FaceLoginProps {
  onLoginSuccess: (user: any) => void;
  onLoginError: (error: string) => void;
  onCancel: () => void;
  className?: string;
}

const FaceLogin: React.FC<FaceLoginProps> = ({
  onLoginSuccess,
  onLoginError,
  onCancel,
  className = ''
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isDetecting, setIsDetecting] = useState(true);
  const [faceDetected, setFaceDetected] = useState(false);
  const [detectionCount, setDetectionCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  // Verificar suporte ao reconhecimento facial
  useEffect(() => {
    const supported = isFaceRecognitionSupported();
    setIsSupported(supported);
    
    if (!supported) {
      setError('Seu dispositivo não suporta reconhecimento facial');
      setIsLoading(false);
    }
  }, []);

  // Função para inicializar câmera
  const initializeCamera = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Primeiro carregar os modelos
      console.log('🔄 Carregando modelos de reconhecimento facial...');
      const modelsLoaded = await loadFaceModels();
      
      if (!modelsLoaded) {
        setError('Erro ao carregar modelos de reconhecimento facial');
        setIsLoading(false);
        return;
      }
      
      console.log('✅ Modelos carregados, inicializando câmera...');
      
      // Depois inicializar a câmera
      if (videoRef.current) {
        console.log('🎥 Iniciando stream de vídeo...');
        const stream = await startVideoStream(videoRef.current);
        streamRef.current = stream;
        
        if (stream) {
          console.log('✅ Stream iniciado, iniciando detecção facial...');
          setIsLoading(false);
          startFaceDetection();
        } else {
          console.log('❌ Falha ao iniciar stream');
          setError('Não foi possível acessar a câmera');
          setIsLoading(false);
        }
      } else {
        console.log('❌ Elemento de vídeo não encontrado');
        setError('Elemento de vídeo não encontrado');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('❌ Erro ao inicializar câmera:', error);
      setError('Erro ao acessar câmera. Verifique as permissões.');
      setIsLoading(false);
    }
  }, []);

  // Aguardar elemento de vídeo estar disponível
  useEffect(() => {
    if (!isSupported) return;

    let attempts = 0;
    const maxAttempts = 50; // 5 segundos máximo

    const waitForVideoElement = () => {
      attempts++;
      
      if (videoRef.current) {
        console.log('✅ Elemento de vídeo encontrado, inicializando câmera...');
        initializeCamera();
      } else if (attempts < maxAttempts) {
        console.log(`⏳ Aguardando elemento de vídeo... (${attempts}/${maxAttempts})`);
        setTimeout(waitForVideoElement, 100);
      } else {
        console.log('❌ Timeout: Elemento de vídeo não encontrado após 5 segundos');
        setError('Erro ao inicializar câmera. Tente recarregar a página.');
        setIsLoading(false);
      }
    };

    waitForVideoElement();

    // Cleanup
    return () => {
      if (streamRef.current) {
        stopVideoStream(streamRef.current);
      }
    };
  }, [isSupported, initializeCamera]);

  // Detecção contínua de face
  const startFaceDetection = useCallback(() => {
    console.log('🔍 Iniciando detecção facial...');
    if (!videoRef.current || !canvasRef.current) {
      console.log('❌ Elementos de vídeo ou canvas não encontrados');
      return;
    }

    // Configurar canvas
    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    console.log('📐 Canvas configurado:', { width: canvas.width, height: canvas.height });

    const detectLoop = async () => {
      try {
        const detection: FaceDetectionResult = await detectFace(videoRef.current!);
        
        if (detection.success && detection.landmarks) {
          setFaceDetected(true);
          setError(null);
          
          // Desenhar landmarks
          const displaySize = {
            width: videoRef.current!.videoWidth,
            height: videoRef.current!.videoHeight
          };
          
          drawFaceLandmarks(canvasRef.current!, detection, displaySize);
          
          // Tentar login após 3 detecções consecutivas
          setDetectionCount(prev => {
            const newCount = prev + 1;
            if (newCount >= 3 && detection.descriptor) {
              handleFaceLogin(detection.descriptor);
            }
            return newCount;
          });
        } else {
          setFaceDetected(false);
          setDetectionCount(0);
          
          // Limpar canvas
          const ctx = canvasRef.current!.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
          }
        }
      } catch (error) {
        console.error('❌ Erro na detecção:', error);
      }

      // Continuar loop se ainda estiver detectando
      if (isDetecting) {
        requestAnimationFrame(detectLoop);
      }
    };

    setIsDetecting(true);
    detectLoop();
  }, []);

  // Parar detecção
  const stopFaceDetection = useCallback(() => {
    setIsDetecting(false);
  }, []);

  // Login com face detectada
  const handleFaceLogin = async (descriptor: Float32Array) => {
    try {
      stopFaceDetection();
      setIsLoading(true);
      
      console.log('🔐 Tentando login com reconhecimento facial...');
      
      const response: FaceLoginResponse = await faceAuthService.loginWithFace(descriptor);
      
      if (response.success && response.user) {
        console.log('✅ Login facial realizado com sucesso');
        onLoginSuccess(response.user);
      } else {
        console.log('❌ Login facial falhou:', response.message);
        onLoginError(response.message);
        setIsLoading(false);
        startFaceDetection(); // Retomar detecção
      }
    } catch (error) {
      console.error('❌ Erro no login facial:', error);
      onLoginError('Erro interno no login facial');
      setIsLoading(false);
      startFaceDetection(); // Retomar detecção
    }
  };

  // Cancelar login
  const handleCancel = () => {
    stopFaceDetection();
    if (streamRef.current) {
      stopVideoStream(streamRef.current);
    }
    onCancel();
  };

  if (!isSupported) {
    return (
      <div className={`face-login-container ${className}`}>
        <div className="face-login-error">
          <div className="error-icon">⚠️</div>
          <h3>Dispositivo Não Suportado</h3>
          <p>Seu dispositivo não suporta reconhecimento facial.</p>
          <button onClick={handleCancel} className="btn-secondary">
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`face-login-container ${className}`}>
      <div className="face-login-header">
        <h3>👤 Login com Reconhecimento Facial</h3>
        <p>Posicione seu rosto no centro da tela</p>
      </div>

      <div className="camera-container">
        {/* Elementos de vídeo sempre renderizados */}
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="camera-video"
          style={{ display: isLoading ? 'none' : 'block' }}
        />
        
        <canvas
          ref={canvasRef}
          className="face-canvas"
          style={{ display: isLoading ? 'none' : 'block' }}
        />
        
        {/* Overlay de loading */}
        {isLoading && (
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
            <p>Inicializando câmera...</p>
          </div>
        )}
        
        {/* Status da face */}
        {!isLoading && (
          <div className="face-status">
            {faceDetected ? (
              <div className="status-detected">
                <span className="status-icon">✅</span>
                <span>Face detectada</span>
                {detectionCount > 0 && (
                  <span className="detection-count">
                    ({detectionCount}/3)
                  </span>
                )}
              </div>
            ) : (
              <div className="status-not-detected">
                <span className="status-icon">❌</span>
                <span>Nenhuma face detectada</span>
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <div className="face-login-instructions">
        <div className="instruction-item">
          <span className="instruction-icon">💡</span>
          <span>Mantenha uma boa iluminação</span>
        </div>
        <div className="instruction-item">
          <span className="instruction-icon">📱</span>
          <span>Mantenha o dispositivo estável</span>
        </div>
        <div className="instruction-item">
          <span className="instruction-icon">👁️</span>
          <span>Olhe diretamente para a câmera</span>
        </div>
      </div>

      <div className="face-login-actions">
        <button 
          onClick={handleCancel}
          className="btn-secondary"
          disabled={isLoading}
        >
          Cancelar
        </button>
        
        <button 
          onClick={() => window.location.reload()}
          className="btn-secondary"
          disabled={isLoading}
        >
          Tentar Novamente
        </button>
      </div>
    </div>
  );
};

export default FaceLogin; 