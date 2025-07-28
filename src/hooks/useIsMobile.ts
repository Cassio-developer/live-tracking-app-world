import { useState, useEffect } from 'react';

interface UseIsMobileOptions {
  breakpoint?: number; // Breakpoint em pixels (padrão: 768px)
  includeTablet?: boolean; // Incluir tablets como mobile (padrão: true)
}

interface UseIsMobileReturn {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  screenWidth: number;
  screenHeight: number;
  orientation: 'portrait' | 'landscape';
}

/**
 * Hook para detectar dispositivos móveis
 * @param options - Opções de configuração
 * @returns Objeto com informações sobre o dispositivo
 */
export const useIsMobile = (options: UseIsMobileOptions = {}): UseIsMobileReturn => {
  const {
    breakpoint = 768,
    includeTablet = true
  } = options;

  const [deviceInfo, setDeviceInfo] = useState<UseIsMobileReturn>({
    isMobile: false,
    isTablet: false,
    isDesktop: false,
    screenWidth: 0,
    screenHeight: 0,
    orientation: 'portrait'
  });

  useEffect(() => {
    // Função para detectar o tipo de dispositivo
    const detectDevice = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      // Detectar orientação
      const orientation = width > height ? 'landscape' : 'portrait';
      
      // Detectar se é mobile baseado no breakpoint
      const isMobileByWidth = width <= breakpoint;
      
      // Detectar se é mobile por user agent
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobileByUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
      
      // Detectar se é tablet
      const isTabletByUA = /ipad|android(?=.*\bMobile\b)(?=.*\bSafari\b)/i.test(userAgent);
      
      // Determinar se é mobile (incluindo tablet se includeTablet for true)
      const isMobile = isMobileByWidth || (includeTablet ? (isMobileByUA || isTabletByUA) : isMobileByUA);
      
      // Determinar se é tablet especificamente
      const isTablet = isTabletByUA || (width > 768 && width <= 1024);
      
      // Determinar se é desktop
      const isDesktop = !isMobile && !isTablet;

      setDeviceInfo({
        isMobile,
        isTablet,
        isDesktop,
        screenWidth: width,
        screenHeight: height,
        orientation
      });
    };

    // Detectar dispositivo inicialmente
    detectDevice();

    // Adicionar listener para mudanças de tamanho
    window.addEventListener('resize', detectDevice);
    window.addEventListener('orientationchange', detectDevice);

    // Cleanup
    return () => {
      window.removeEventListener('resize', detectDevice);
      window.removeEventListener('orientationchange', detectDevice);
    };
  }, [breakpoint, includeTablet]);

  return deviceInfo;
};

/**
 * Hook simplificado que retorna apenas boolean
 */
export const useIsMobileSimple = (breakpoint: number = 768): boolean => {
  const { isMobile } = useIsMobile({ breakpoint });
  return isMobile;
};

/**
 * Hook para detectar orientação do dispositivo
 */
export const useOrientation = (): 'portrait' | 'landscape' => {
  const { orientation } = useIsMobile();
  return orientation;
};

/**
 * Hook para detectar tamanho da tela
 */
export const useScreenSize = (): { width: number; height: number } => {
  const { screenWidth, screenHeight } = useIsMobile();
  return { width: screenWidth, height: screenHeight };
}; 