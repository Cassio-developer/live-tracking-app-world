import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  detectFace, 
  startVideoStream, 
  stopVideoStream, 
  drawFaceLandmarks,
  captureFaceSamples,
  isFaceRecognitionSupported,
  loadFaceModels,
  FaceDetectionResult 
} from '../../utils/faceRecognition';
import { faceAuthService, FaceRegistrationResponse } from '../../services/faceAuthService';
import './FaceRegistration.css';

interface FaceRegistrationProps {
  onRegistrationSuccess: (message: string) => void;
  onRegistrationError: (error: string) => void;
  onCancel: () => void;
  className?: string;
}

const FaceRegistration: React.FC<FaceRegistrationProps> = ({
  onRegistrationSuccess,
  onRegistrationError,
  onCancel,
  className = ''
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [capturedSamples, setCapturedSamples] = useState(0);
  const [totalSamples, setTotalSamples] = useState(5);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [step, setStep] = useState<'setup' | 'capturing' | 'processing'>('setup');

  console.log('isLoading', isLoading)
  console.log('isDetecting', isDetecting)
  console.log('faceDetected', faceDetected)

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

  // Verificar suporte ao reconhecimento facial
  useEffect(() => {
    const supported = isFaceRecognitionSupported();
    setIsSupported(supported);
    if (!supported) {
      setError('Seu dispositivo não suporta reconhecimento facial');
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
      // Verificar se os elementos ainda existem
      if (!videoRef.current || !canvasRef.current) {
        console.log('❌ Elementos de vídeo ou canvas não encontrados no loop');
        setIsDetecting(false);
        return;
      }

      try {
        const detection: FaceDetectionResult = await detectFace(videoRef.current);
        
        if (detection.success && detection.landmarks) {
          console.log('✅ Face detectada!');
          setFaceDetected(true);
          setError(null);
          
          // Desenhar landmarks
          const displaySize = {
            width: videoRef.current.videoWidth,
            height: videoRef.current.videoHeight
          };
          
          drawFaceLandmarks(canvasRef.current, detection, displaySize);
        } else {
          setFaceDetected(false);
          
          // Limpar canvas
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          }
        }
      } catch (error) {
        console.error('❌ Erro na detecção:', error);
        // Parar detecção em caso de erro
        setIsDetecting(false);
        return;
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

  // Iniciar captura de amostras
  const startCapture = async () => {
    if (!videoRef.current || !faceDetected) {
      setError('Posicione seu rosto no centro da tela');
      return;
    }

    try {
      setIsCapturing(true);
      setStep('capturing');
      setError(null);
      
      console.log('🔄 Iniciando captura de amostras faciais...');
      
      const result = await captureFaceSamples(videoRef.current, totalSamples, 1500);
      
      if (result.success) {
        setStep('processing');
        console.log(`✅ ${result.descriptors.length} amostras capturadas com sucesso`);
        
        // Registrar no backend
        const response: FaceRegistrationResponse = await faceAuthService.registerFace(result.descriptors);
        
        if (response.success) {
          console.log('✅ Registro facial realizado com sucesso');
          onRegistrationSuccess(response.message);
        } else {
          console.log('❌ Erro no registro facial:', response.message);
          onRegistrationError(response.message);
        }
      } else {
        console.log('❌ Falha na captura de amostras:', result.error);
        setError(result.error || 'Falha na captura de amostras');
        setStep('setup');
      }
    } catch (error) {
      console.error('❌ Erro na captura:', error);
      setError('Erro interno na captura');
      setStep('setup');
    } finally {
      setIsCapturing(false);
    }
  };

  // Cancelar operação
  const handleCancel = () => {
    stopFaceDetection();
    if (streamRef.current) {
      stopVideoStream(streamRef.current);
    }
    onCancel();
  };

  // Renderizar tela de erro se não suportado
  if (!isSupported) {
    return (
      <div className={`face-registration-container ${className}`}>
        <div className="face-registration-error">
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
    <div className={`face-registration-container ${className}`}>
      <div className="face-registration-header">
        <h3>📸 Configurar Reconhecimento Facial</h3>
        <p>
          {step === 'setup' && 'Posicione seu rosto no centro da tela e clique em "Iniciar Captura"'}
          {step === 'capturing' && 'Mantenha-se imóvel enquanto capturamos suas amostras faciais'}
          {step === 'processing' && 'Processando e salvando seus dados faciais...'}
        </p>
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
              </div>
            ) : (
              <div className="status-not-detected">
                <span className="status-icon">❌</span>
                <span>Nenhuma face detectada</span>
              </div>
            )}
          </div>
        )}

        {/* Progresso da captura */}
        {step === 'capturing' && !isLoading && (
          <div className="capture-progress">
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ width: `${(capturedSamples / totalSamples) * 100}%` }}
              ></div>
            </div>
            <span className="progress-text">
              {capturedSamples}/{totalSamples} amostras
            </span>
          </div>
        )}

        {/* Overlay de processamento */}
        {step === 'processing' && (
          <div className="processing-overlay">
            <div className="loading-spinner"></div>
            <p>Salvando dados faciais...</p>
          </div>
        )}
      </div>

      {error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <div className="face-registration-instructions">
        <div className="instruction-item">
          <span className="instruction-icon">💡</span>
          <span>Mantenha uma boa iluminação</span>
        </div>
        <div className="instruction-item">
          <span className="instruction-icon">📱</span>
          <span>Mantenha o dispositivo estável</span>
        </div>
        <div className="instruction-item">
          <span className="instruction-icon">👤</span>
          <span>Olhe diretamente para a câmera</span>
        </div>
      </div>

      <div className="face-registration-actions">
        {step === 'setup' && (
          <button
            onClick={startCapture}
            disabled={!faceDetected || isCapturing}
            className="btn-primary"
          >
            {isCapturing ? 'Capturando...' : 'Iniciar Captura'}
          </button>
        )}
        
        <button onClick={handleCancel} className="btn-secondary">
          Cancelar
        </button>
      </div>
    </div>
  );
};

export default FaceRegistration; 