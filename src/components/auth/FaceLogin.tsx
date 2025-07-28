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
import { useAuth } from '../../contexts/AuthContext';
import './FaceLogin.css';

interface FaceLoginProps {
  onLoginError: (error: string) => void;
  onCancel: () => void;
  className?: string;
}

const FaceLogin: React.FC<FaceLoginProps> = ({
  onLoginError,
  onCancel,
  className = ''
}) => {
  const { setUserDirectly } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isDetecting, setIsDetecting] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [detectionCount, setDetectionCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [hasFaceData, setHasFaceData] = useState(false);
  const [checkingFaceData, setCheckingFaceData] = useState(true);
  const [loginAttempted, setLoginAttempted] = useState(false);
  const loginAttemptedRef = useRef(false);

  // Verificar suporte ao reconhecimento facial
  useEffect(() => {
    const checkSupport = () => {
      const supported = isFaceRecognitionSupported();
      setIsSupported(supported);
      
      if (!supported) {
        setError('Seu dispositivo não suporta reconhecimento facial');
        setIsLoading(false);
        setCheckingFaceData(false);
        return;
      }

      // Não verificamos dados faciais aqui - deixamos o login facial tentar
      // Se não houver dados, o backend retornará erro apropriado
      setHasFaceData(true); // Assumimos que pode ter dados
      setCheckingFaceData(false);
    };

    checkSupport();
  }, []);

  // Função para inicializar câmera
  const initializeCamera = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Primeiro carregar os modelos
      const modelsLoaded = await loadFaceModels();
      
      if (!modelsLoaded) {
        setError('Erro ao carregar modelos de reconhecimento facial');
        setIsLoading(false);
        return;
      }
      
      // Depois inicializar a câmera
      if (videoRef.current) {
        const stream = await startVideoStream(videoRef.current);
        streamRef.current = stream;
        
        if (stream) {
          setIsLoading(false);
          // Aguardar um pouco antes de iniciar detecção
          setTimeout(() => {
            startFaceDetection();
          }, 1000);
        } else {
          setError('Não foi possível acessar a câmera');
          setIsLoading(false);
        }
      } else {
        setError('Elemento de vídeo não encontrado');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Erro ao inicializar câmera:', error);
      setError('Erro ao acessar câmera. Verifique as permissões.');
      setIsLoading(false);
    }
  }, []);

  // Aguardar elemento de vídeo estar disponível
  useEffect(() => {
    if (!isSupported || !hasFaceData || checkingFaceData) {
      return;
    }

    // Verificar se já foi inicializado
    if (streamRef.current) {
      return;
    }

    let attempts = 0;
    const maxAttempts = 50; // 5 segundos máximo

    const waitForVideoElement = () => {
      attempts++;
      
      if (videoRef.current) {
        initializeCamera();
      } else if (attempts < maxAttempts) {
        setTimeout(waitForVideoElement, 100);
      } else {
        setError('Erro ao inicializar câmera. Tente recarregar a página.');
        setIsLoading(false);
      }
    };

    waitForVideoElement();

    // Cleanup
    return () => {
      setIsDetecting(false);
      loginAttemptedRef.current = true;
      setLoginAttempted(true);
      if (streamRef.current) {
        stopVideoStream(streamRef.current);
        streamRef.current = null;
      }
    };
  }, [isSupported, hasFaceData, checkingFaceData, initializeCamera]);

  // Login com face detectada
  const handleFaceLogin = useCallback(async (descriptor: Float32Array) => {
    // Verificar se já está tentando login
    if (loginAttemptedRef.current) {
      return;
    }
    
    // Marcar como tentado IMEDIATAMENTE para evitar múltiplas chamadas
    loginAttemptedRef.current = true;
    setLoginAttempted(true);

    try {
      setIsDetecting(false);
      setIsLoading(true);
      
      const response: FaceLoginResponse = await faceAuthService.loginWithFace(descriptor);
      
      if (response.success && response.user) {
        // Parar completamente a detecção e stream
        setIsDetecting(false);
        setLoginAttempted(true);
        setIsLoading(false); // Resetar loading
        if (streamRef.current) {
          stopVideoStream(streamRef.current);
          streamRef.current = null;
        }
        
        // Atualizar o contexto de autenticação diretamente
        setUserDirectly(response.user);
        
        return; // Sair da função imediatamente
      } else {
        // Verificar se é erro de dados não encontrados
        if (response.message.includes('Nenhum usuário com dados faciais encontrado') || 
            response.message.includes('Face não reconhecida')) {
          setError('Você ainda não configurou o reconhecimento facial. Faça login com senha primeiro e configure nas configurações do perfil.');
        } else {
          setError(response.message);
        }
        
        setIsLoading(false);
        setLoginAttempted(false); // Reset para permitir nova tentativa
        // NÃO retomar detecção automaticamente - deixar o usuário tentar novamente
      }
    } catch (error: any) {
      console.error('Erro no login facial:', error);
      
      // Verificar se é erro de rede ou servidor
      if (error.message && error.message.includes('Token não fornecido')) {
        setError('Você ainda não configurou o reconhecimento facial. Faça login com senha primeiro e configure nas configurações do perfil.');
      } else {
        setError('Erro interno no login facial. Tente novamente.');
      }
      
      setIsLoading(false);
      setLoginAttempted(false); // Reset para permitir nova tentativa
      // NÃO retomar detecção automaticamente - deixar o usuário tentar novamente
    }
  }, [loginAttempted, onLoginError]);

  // Detecção contínua de face
  const startFaceDetection = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) {
      return;
    }

    // Resetar estado de login
    loginAttemptedRef.current = false;
    setLoginAttempted(false);
    setDetectionCount(0);
    
    // Configurar canvas
    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Configurar estado de detecção
    setIsDetecting(true);
    
    const detectLoop = async () => {
      // Verificar se os elementos ainda existem
      if (!videoRef.current || !canvasRef.current) {
        setIsDetecting(false);
        return;
      }

      // Parar imediatamente se já tentou fazer login
      if (loginAttemptedRef.current) {
        setIsDetecting(false);
        return;
      }
      
      // Verificar se o contador já chegou a 3 para evitar continuar desnecessariamente
      if (detectionCount >= 3) {
        setIsDetecting(false);
        return;
      }

      try {
        const detection: FaceDetectionResult = await detectFace(videoRef.current);
        
        if (detection.success && detection.landmarks) {
          setFaceDetected(true);
          setError(null);
          
          // Tentar login após 3 detecções consecutivas
          setDetectionCount(prev => {
            const newCount = prev + 1;
            
            if (newCount >= 3 && detection.descriptor && !loginAttemptedRef.current) {
              // Chamar login imediatamente
              if (detection.descriptor) {
                handleFaceLogin(detection.descriptor);
              }
            }
            return newCount;
          });
        } else {
          setFaceDetected(false);
          setDetectionCount(0);
          
          // Limpar canvas
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          }
        }
      } catch (error) {
        console.error('Erro na detecção:', error);
        // Parar detecção em caso de erro
        setIsDetecting(false);
        return;
      }

      // Continuar loop apenas se não tentou login
      // Verificação rigorosa antes de continuar
      if (loginAttemptedRef.current) {
        setIsDetecting(false);
        return;
      }
      
      // Verificar novamente antes de agendar próxima iteração
      if (!loginAttemptedRef.current) {
        setTimeout(detectLoop, 100); // Usar setTimeout em vez de requestAnimationFrame
      } else {
        setIsDetecting(false);
      }
    };

    setIsDetecting(true);
    // Aguardar um pouco para o estado ser atualizado
    setTimeout(() => {
      detectLoop();
    }, 50);
  }, [loginAttempted, detectionCount]);

  // Parar detecção
  const stopFaceDetection = useCallback(() => {
    setIsDetecting(false);
    loginAttemptedRef.current = true;
    setLoginAttempted(true);
  }, []);



  // Cleanup quando componente é desmontado
  useEffect(() => {
    return () => {
      setIsDetecting(false);
      loginAttemptedRef.current = true;
      setLoginAttempted(true);
      setIsLoading(false);
      if (streamRef.current) {
        stopVideoStream(streamRef.current);
        streamRef.current = null;
      }
    };
  }, []);

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

  if (checkingFaceData) {
    return (
      <div className={`face-login-container ${className}`}>
        <div className="face-login-loading">
          <div className="loading-spinner"></div>
          <h3>Verificando Configuração</h3>
          <p>Verificando se você tem reconhecimento facial configurado...</p>
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
          disabled={isLoading && !loginAttempted}
        >
          Cancelar
        </button>
        
        {error && !isDetecting && (
          <button 
            onClick={() => {
              setError('');
              setLoginAttempted(false);
              setDetectionCount(0);
              startFaceDetection();
            }}
            className="btn-primary"
            disabled={isLoading}
          >
            Tentar Novamente
          </button>
        )}
        
        <button 
          onClick={() => window.location.reload()}
          className="btn-secondary"
          disabled={isLoading && !loginAttempted}
        >
          Recarregar
        </button>
      </div>
    </div>
  );
};

export default FaceLogin; 