// Verificar se face-api.js está disponível
declare global {
  interface Window {
    faceapi: any;
  }
}

// Importação condicional
let faceapi: any;
try {
  faceapi = require('face-api.js');
} catch (error) {
  console.warn('face-api.js não está disponível');
}

export interface FaceDetectionResult {
  success: boolean;
  descriptor?: Float32Array;
  landmarks?: any;
  error?: string;
}

export interface FaceComparisonResult {
  isMatch: boolean;
  confidence: number;
  distance: number;
}

export interface FaceSetupResult {
  success: boolean;
  descriptors: Float32Array[];
  error?: string;
}

/**
 * Carrega os modelos necessários para reconhecimento facial
 * @returns Promise<boolean> - true se carregado com sucesso
 */
export const loadFaceModels = async (): Promise<boolean> => {
  console.log('🔄 loadFaceModels chamada, faceapi disponível:', !!faceapi);
  
  if (!faceapi) {
    console.error('❌ face-api.js não está disponível');
    return false;
  }

  try {
    console.log('🔄 Carregando modelos de reconhecimento facial...');
    
    await Promise.all([
      faceapi.loadTinyFaceDetectorModel('/models'),
      faceapi.loadFaceLandmarkModel('/models'),
      faceapi.loadFaceRecognitionModel('/models')
    ]);
    
    console.log('✅ Modelos carregados com sucesso');
    
    // Verificar se os modelos foram carregados
    const modelsLoaded = faceapi.nets.tinyFaceDetector.isLoaded && 
                        faceapi.nets.faceLandmark68Net.isLoaded && 
                        faceapi.nets.faceRecognitionNet.isLoaded;
    
    console.log('📊 Status dos modelos:', {
      tinyFaceDetector: faceapi.nets.tinyFaceDetector.isLoaded,
      faceLandmark68: faceapi.nets.faceLandmark68Net.isLoaded,
      faceRecognition: faceapi.nets.faceRecognitionNet.isLoaded
    });
    
    return modelsLoaded;
  } catch (error) {
    console.error('❌ Erro ao carregar modelos:', error);
    return false;
  }
};

/**
 * Inicia o stream de vídeo da câmera
 * @param videoElement - Elemento de vídeo HTML
 * @param options - Opções de configuração da câmera
 * @returns Promise<MediaStream | null>
 */
export const startVideoStream = async (
  videoElement: HTMLVideoElement,
  options: MediaStreamConstraints = {
    video: {
      width: { ideal: 640 },
      height: { ideal: 480 },
      facingMode: 'user'
    }
  }
): Promise<MediaStream | null> => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia(options);
    videoElement.srcObject = stream;
    await videoElement.play();
    
    console.log('✅ Stream de vídeo iniciado');
    return stream;
  } catch (error) {
    console.error('❌ Erro ao iniciar stream de vídeo:', error);
    return null;
  }
};

/**
 * Detecta face em um elemento de vídeo
 * @param videoElement - Elemento de vídeo HTML
 * @returns Promise<FaceDetectionResult>
 */
export const detectFace = async (videoElement: HTMLVideoElement): Promise<FaceDetectionResult> => {
  console.log('🔍 detectFace chamada, faceapi disponível:', !!faceapi);
  
  if (!faceapi) {
    console.log('❌ face-api.js não está disponível');
    return {
      success: false,
      error: 'face-api.js não está disponível'
    };
  }

  try {
    if (!videoElement.videoWidth || !videoElement.videoHeight) {
      console.log('❌ Vídeo não está pronto:', { width: videoElement.videoWidth, height: videoElement.videoHeight });
      return {
        success: false,
        error: 'Vídeo não está pronto'
      };
    }

    console.log('🔍 Tentando detectar face...', { width: videoElement.videoWidth, height: videoElement.videoHeight });

    const detection = await faceapi.detectSingleFace(
      videoElement,
      new faceapi.TinyFaceDetectorOptions({
        inputSize: 224,
        scoreThreshold: 0.3 // Reduzido para ser mais sensível
      })
    ).withFaceLandmarks().withFaceDescriptor();

    if (detection) {
      console.log('✅ Face detectada com sucesso!');
      return {
        success: true,
        descriptor: detection.descriptor,
        landmarks: detection.landmarks
      };
    } else {
      console.log('❌ Nenhuma face detectada');
      return {
        success: false,
        error: 'Nenhuma face detectada'
      };
    }
  } catch (error) {
    console.error('❌ Erro na detecção facial:', error);
    return {
      success: false,
      error: 'Erro na detecção facial'
    };
  }
};

/**
 * Compara dois descritores faciais
 * @param descriptor1 - Primeiro descritor facial
 * @param descriptor2 - Segundo descritor facial
 * @param threshold - Limiar de similaridade (padrão: 0.6)
 * @returns FaceComparisonResult
 */
export const compareFaces = (
  descriptor1: Float32Array,
  descriptor2: Float32Array,
  threshold: number = 0.6
): FaceComparisonResult => {
  if (!faceapi) {
    return {
      isMatch: false,
      confidence: 0,
      distance: Infinity
    };
  }

  try {
    const distance = faceapi.euclideanDistance(descriptor1, descriptor2);
    const isMatch = distance < threshold;
    const confidence = Math.max(0, 1 - distance);

    return {
      isMatch,
      confidence,
      distance
    };
  } catch (error) {
    console.error('❌ Erro na comparação facial:', error);
    return {
      isMatch: false,
      confidence: 0,
      distance: Infinity
    };
  }
};

/**
 * Captura múltiplas amostras faciais para registro
 * @param videoElement - Elemento de vídeo HTML
 * @param sampleCount - Número de amostras (padrão: 5)
 * @param intervalMs - Intervalo entre capturas (padrão: 1000ms)
 * @returns Promise<FaceSetupResult>
 */
export const captureFaceSamples = async (
  videoElement: HTMLVideoElement,
  sampleCount: number = 5,
  intervalMs: number = 1000
): Promise<FaceSetupResult> => {
  try {
    const descriptors: Float32Array[] = [];
    
    console.log(`🔄 Capturando ${sampleCount} amostras faciais...`);
    
    for (let i = 0; i < sampleCount; i++) {
      const detection = await detectFace(videoElement);
      
      if (detection.success && detection.descriptor) {
        descriptors.push(detection.descriptor);
        console.log(`✅ Amostra ${i + 1}/${sampleCount} capturada`);
        
        if (i < sampleCount - 1) {
          await new Promise(resolve => setTimeout(resolve, intervalMs));
        }
      } else {
        console.warn(`⚠️ Falha na captura da amostra ${i + 1}`);
      }
    }
    
    if (descriptors.length >= Math.ceil(sampleCount * 0.8)) {
      return {
        success: true,
        descriptors
      };
    } else {
      return {
        success: false,
        descriptors: [],
        error: 'Poucas amostras válidas capturadas'
      };
    }
  } catch (error) {
    console.error('❌ Erro na captura de amostras:', error);
    return {
      success: false,
      descriptors: [],
      error: 'Erro na captura de amostras'
    };
  }
};

/**
 * Desenha landmarks faciais em um canvas
 * @param canvas - Elemento canvas HTML
 * @param detection - Resultado da detecção facial
 * @param displaySize - Tamanho de exibição
 */
export const drawFaceLandmarks = (
  canvas: HTMLCanvasElement,
  detection: FaceDetectionResult,
  displaySize: { width: number; height: number }
): void => {
  if (!faceapi || !detection.landmarks) return;

  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Limpar canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Redimensionar detecção para o tamanho de exibição
    const resizedDetection = faceapi.resizeResults(
      { landmarks: detection.landmarks },
      displaySize
    );
    
    // Desenhar landmarks
    faceapi.draw.drawFaceLandmarks(canvas, [resizedDetection]);
  } catch (error) {
    console.error('❌ Erro ao desenhar landmarks:', error);
  }
};

/**
 * Verifica se o dispositivo suporta reconhecimento facial
 * @returns boolean
 */
export const isFaceRecognitionSupported = (): boolean => {
  return !!(
    navigator.mediaDevices &&
    navigator.mediaDevices.getUserMedia
  );
};

/**
 * Para o stream de vídeo
 * @param stream - Stream de mídia
 */
export const stopVideoStream = (stream: MediaStream | null): void => {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    console.log('🛑 Stream de vídeo parado');
  }
}; 