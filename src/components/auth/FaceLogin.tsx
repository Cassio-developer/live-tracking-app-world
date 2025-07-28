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
    console.log('🎥 initializeCamera chamada');
    try {
      setIsLoading(true);
      
      // Primeiro carregar os modelos
      console.log('🔄 Carregando modelos de reconhecimento facial...');
      const modelsLoaded = await loadFaceModels();
      
      if (!modelsLoaded) {
        console.log('❌ Falha ao carregar modelos');
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
          // Aguardar um pouco antes de iniciar detecção
          setTimeout(() => {
            console.log('🔍 Iniciando detecção após delay...');
            startFaceDetection();
          }, 1000);
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
    console.log('🔍 useEffect - Verificando condições para inicializar câmera:', {
      isSupported,
      hasFaceData,
      checkingFaceData,
      streamExists: !!streamRef.current
    });
    
    if (!isSupported || !hasFaceData || checkingFaceData) {
      console.log('❌ Condições não atendidas para inicializar câmera');
      return;
    }

    // Verificar se já foi inicializado
    if (streamRef.current) {
      console.log('✅ Câmera já foi inicializada');
      return;
    }

    console.log('✅ Iniciando processo de inicialização da câmera...');
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
      console.log('🧹 Cleanup do useEffect - parando stream e detecção');
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
    console.log('🔐 handleFaceLogin chamada - loginAttempted:', loginAttempted, 'ref:', loginAttemptedRef.current);
    
    // Verificar se já está tentando login
    if (loginAttemptedRef.current) {
      console.log('🛑 Login já foi tentado, ignorando nova tentativa');
      return;
    }
    
    // Marcar como tentado IMEDIATAMENTE para evitar múltiplas chamadas
    loginAttemptedRef.current = true;
    setLoginAttempted(true);

    try {
      console.log('🔐 Iniciando processo de login facial...');
      setIsDetecting(false);
      setIsLoading(true);
      
      console.log('🔐 Tentando login com reconhecimento facial...');
      
      const response: FaceLoginResponse = await faceAuthService.loginWithFace(descriptor);
      
      if (response.success && response.user) {
        console.log('✅ Login facial realizado com sucesso');
        // Parar completamente a detecção e stream
        setIsDetecting(false);
        setLoginAttempted(true);
        setIsLoading(false); // Resetar loading
        if (streamRef.current) {
          stopVideoStream(streamRef.current);
          streamRef.current = null;
        }
        console.log('🛑 Parando completamente após login bem-sucedido');
        
        // Atualizar o contexto de autenticação diretamente
        console.log('✅ Atualizando contexto de autenticação com usuário:', response.user);
        setUserDirectly(response.user);
        console.log('✅ Contexto de autenticação atualizado com sucesso');
        
        return; // Sair da função imediatamente
      } else {
        console.log('❌ Login facial falhou:', response.message);
        
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
      console.error('❌ Erro no login facial:', error);
      
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
    console.log('🔍 startFaceDetection chamada - isDetecting:', isDetecting, 'loginAttempted:', loginAttempted);
    

    
    if (!videoRef.current || !canvasRef.current) {
      console.log('❌ Elementos de vídeo ou canvas não encontrados');
      return;
    }

    console.log('✅ Iniciando detecção facial...');
    
    // Resetar estado de login
    loginAttemptedRef.current = false;
    setLoginAttempted(false);
    setDetectionCount(0);
    
    // Configurar canvas
    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    console.log('📐 Canvas configurado:', { width: canvas.width, height: canvas.height });

    // Configurar estado de detecção
    setIsDetecting(true);
    
    const detectLoop = async () => {
      console.log('🔄 Loop de detecção iniciado - loginAttempted:', loginAttempted);
      
      // Verificar se os elementos ainda existem
      if (!videoRef.current || !canvasRef.current) {
        console.log('❌ Elementos de vídeo ou canvas não encontrados no loop');
        setIsDetecting(false);
        return;
      }

      // Parar imediatamente se já tentou fazer login
      if (loginAttemptedRef.current) {
        console.log('🛑 Parando detecção - login já tentado');
        setIsDetecting(false);
        return;
      }
      
      // Verificar se o contador já chegou a 3 para evitar continuar desnecessariamente
      if (detectionCount >= 3) {
        console.log('🛑 Parando detecção - contador já chegou a 3');
        setIsDetecting(false);
        return;
      }

      try {
        debugger;
        console.log('🔍 Chamando detectFace...');
        const detection: FaceDetectionResult = await detectFace(videoRef.current);
        console.log('🔍 Resultado da detecção:', detection.success ? 'Sucesso' : 'Falha', detection.error || '');
        console.log('🔍 Detalhes da detecção:', {
          success: detection.success,
          hasLandmarks: !!detection.landmarks,
          hasDescriptor: !!detection.descriptor,
          error: detection.error
        });
        
        if (detection.success && detection.landmarks) {
          setFaceDetected(true);
          setError(null);
          
          // Desenhar landmarks (temporariamente desabilitado)
          // const displaySize = {
          //   width: videoRef.current.videoWidth,
          //   height: videoRef.current.videoHeight
          // };
          // 
          // drawFaceLandmarks(canvasRef.current, detection, displaySize);
          
          // Tentar login após 3 detecções consecutivas
          setDetectionCount(prev => {
            const newCount = prev + 1;
            console.log('🔍 Contador de detecção:', newCount, '/ 3');
            
            if (newCount >= 3 && detection.descriptor && !loginAttemptedRef.current) {
              console.log('🔐 Tentando login após 3 detecções consecutivas');
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
        console.error('❌ Erro na detecção:', error);
        // Parar detecção em caso de erro
        setIsDetecting(false);
        return;
      }

      // Continuar loop apenas se não tentou login
      console.log('🔍 Verificando se deve continuar loop - loginAttempted:', loginAttempted, 'ref:', loginAttemptedRef.current);
      
      // Verificação rigorosa antes de continuar
      if (loginAttemptedRef.current) {
        console.log('🛑 Parando loop - login já tentado');
        setIsDetecting(false);
        return;
      }
      
      console.log('✅ Continuando loop de detecção');
      // Verificar novamente antes de agendar próxima iteração
      if (!loginAttemptedRef.current) {
        setTimeout(detectLoop, 100); // Usar setTimeout em vez de requestAnimationFrame
      } else {
        console.log('🛑 Cancelando próxima iteração - login já tentado');
        setIsDetecting(false);
      }
    };

    console.log('🔄 Configurando estado de detecção...');
    setIsDetecting(true);
    console.log('🚀 Iniciando loop de detecção...');
    // Aguardar um pouco para o estado ser atualizado
    setTimeout(() => {
      detectLoop();
    }, 50);
  }, [loginAttempted, detectionCount]);

  // Parar detecção
  const stopFaceDetection = useCallback(() => {
    console.log('🛑 stopFaceDetection chamada');
    setIsDetecting(false);
    loginAttemptedRef.current = true;
    setLoginAttempted(true);
  }, []);



  // Cleanup quando componente é desmontado
  useEffect(() => {
    return () => {
      console.log('🧹 Cleanup do componente FaceLogin');
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