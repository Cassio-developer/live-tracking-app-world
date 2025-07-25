import { API_CONFIG } from '../config/api';

export interface FaceRegistrationRequest {
  descriptors: Float32Array[];
}

export interface FaceLoginRequest {
  descriptor: Float32Array;
}

export interface FaceRegistrationResponse {
  success: boolean;
  message: string;
  userId?: string;
}

export interface FaceLoginResponse {
  success: boolean;
  message: string;
  user?: {
    id: string;
    nome: string;
    isAdmin: boolean;
    avatar?: string;
  };
  token?: string;
}

export interface FaceDataResponse {
  success: boolean;
  hasFaceData: boolean;
  message?: string;
}

/**
 * Serviço para autenticação facial
 */
class FaceAuthService {
  private baseURL: string;

  constructor() {
    this.baseURL = API_CONFIG.API_URL;
  }

  /**
   * Registra dados faciais do usuário
   * @param descriptors - Array de descritores faciais
   * @returns Promise<FaceRegistrationResponse>
   */
  async registerFace(descriptors: Float32Array[]): Promise<FaceRegistrationResponse> {
    try {
      const response = await fetch(`${this.baseURL}/api/auth/register-face`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          descriptors: descriptors.map(desc => Array.from(desc))
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Erro ao registrar face');
      }

      return {
        success: true,
        message: data.message,
        userId: data.userId
      };
    } catch (error) {
      console.error('❌ Erro no registro facial:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }

  /**
   * Realiza login com reconhecimento facial
   * @param descriptor - Descritor facial para comparação
   * @returns Promise<FaceLoginResponse>
   */
  async loginWithFace(descriptor: Float32Array): Promise<FaceLoginResponse> {
    try {
      const response = await fetch(`${this.baseURL}/api/auth/face-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          descriptor: Array.from(descriptor)
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Erro no login facial');
      }

      return {
        success: true,
        message: data.message,
        user: data.user,
        token: data.token
      };
    } catch (error) {
      console.error('❌ Erro no login facial:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }

  /**
   * Verifica se o usuário tem dados faciais registrados
   * @returns Promise<FaceDataResponse>
   */
  async checkFaceData(): Promise<FaceDataResponse> {
    try {
      const response = await fetch(`${this.baseURL}/api/auth/face-data`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Erro ao verificar dados faciais');
      }

      return {
        success: true,
        hasFaceData: data.hasFaceData,
        message: data.message
      };
    } catch (error) {
      console.error('❌ Erro ao verificar dados faciais:', error);
      return {
        success: false,
        hasFaceData: false,
        message: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }

  /**
   * Remove dados faciais do usuário
   * @returns Promise<FaceRegistrationResponse>
   */
  async removeFaceData(): Promise<FaceRegistrationResponse> {
    try {
      const response = await fetch(`${this.baseURL}/api/auth/remove-face`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Erro ao remover dados faciais');
      }

      return {
        success: true,
        message: data.message
      };
    } catch (error) {
      console.error('❌ Erro ao remover dados faciais:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }

  /**
   * Atualiza dados faciais do usuário
   * @param descriptors - Novos descritores faciais
   * @returns Promise<FaceRegistrationResponse>
   */
  async updateFaceData(descriptors: Float32Array[]): Promise<FaceRegistrationResponse> {
    try {
      const response = await fetch(`${this.baseURL}/api/auth/update-face`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          descriptors: descriptors.map(desc => Array.from(desc))
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Erro ao atualizar dados faciais');
      }

      return {
        success: true,
        message: data.message
      };
    } catch (error) {
      console.error('❌ Erro ao atualizar dados faciais:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }
}

// Instância singleton do serviço
export const faceAuthService = new FaceAuthService(); 