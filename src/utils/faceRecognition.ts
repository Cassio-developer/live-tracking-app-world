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
  if (!faceapi) {
    console.error('❌ face-api.js não está disponível');
    return false;
  }

  try {

    await Promise.all([
      faceapi.loadTinyFaceDetectorModel('/models'),
      faceapi.loadFaceLandmarkModel('/models'),
      faceapi.loadFaceRecognitionModel('/models')
    ]);


    // Verificar se os modelos foram carregados
    const modelsLoaded = faceapi.nets.tinyFaceDetector.isLoaded &&
      faceapi.nets.faceLandmark68Net.isLoaded &&
      faceapi.nets.faceRecognitionNet.isLoaded;



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
      width: { ideal: 1280, min: 640 },
      height: { ideal: 720, min: 480 },
      facingMode: 'user',
      frameRate: { ideal: 30 }
    }
  }
): Promise<MediaStream | null> => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia(options);
    videoElement.srcObject = stream;

    // Aguardar o vídeo estar pronto
    await new Promise<void>((resolve) => {
      videoElement.onloadedmetadata = () => {

        resolve();
      };
    });

    await videoElement.play();

    // Aguardar um pouco mais para garantir que o vídeo está reproduzindo
    await new Promise(resolve => setTimeout(resolve, 500));

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

  if (!faceapi) {
    return {
      success: false,
      error: 'face-api.js não está disponível'
    };
  }

  if (!videoElement) {
    return {
      success: false,
      error: 'Elemento de vídeo é null'
    };
  }

  try {
    if (!videoElement.videoWidth || !videoElement.videoHeight) {
      return {
        success: false,
        error: 'Vídeo não está pronto'
      };
    }



    // Verificar se o vídeo está realmente reproduzindo
    if (videoElement.paused || videoElement.ended || videoElement.readyState < 2) {
      return {
        success: false,
        error: 'Vídeo não está reproduzindo'
      };
    }

    // Aguardar um pouco para garantir que o vídeo está estável
    await new Promise(resolve => setTimeout(resolve, 100));

    const detection = await faceapi.detectSingleFace(
      videoElement,
      new faceapi.TinyFaceDetectorOptions({
        inputSize: 512, // Aumentado para melhor detecção
        scoreThreshold: 0.01 // Extremamente baixo para detectar qualquer coisa
      })
    ).withFaceLandmarks().withFaceDescriptor();


    if (detection) {
      return {
        success: true,
        descriptor: detection.descriptor,
        landmarks: detection.landmarks
      };
    } else {

      // Tentar com configuração ainda mais sensível
      try {
        const sensitiveDetection = await faceapi.detectSingleFace(
          videoElement,
          new faceapi.TinyFaceDetectorOptions({
            inputSize: 224,
            scoreThreshold: 0.001 // Extremamente baixo
          })
        ).withFaceLandmarks().withFaceDescriptor();

        if (sensitiveDetection) {
          return {
            success: true,
            descriptor: sensitiveDetection.descriptor,
            landmarks: sensitiveDetection.landmarks
          };
        }
      } catch (sensitiveError) {
      }

      return {
        success: false,
        error: 'Nenhuma face detectada'
      };
    }
  } catch (error) {
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
  // Função temporariamente desabilitada para evitar erros
  // TODO: Implementar desenho de landmarks corretamente
  console.log('🎨 drawFaceLandmarks chamada (desabilitada temporariamente)');
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