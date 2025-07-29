import axios from 'axios';
import { config } from '../config/api';
import { FaceLoginResponse } from '../types/auth';

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

// export interface FaceLoginResponse {
//   success: boolean;
//   message: string;
//   user?: {
//     id: string;
//     nome: string;
//     isAdmin: boolean;
//     avatar?: string;
//   };
//   token?: string;
// }

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
    this.baseURL = config.API_URL;
  }

  /**
   * Registra dados faciais do usuário
   * @param descriptors - Array de descritores faciais
   * @returns Promise<FaceRegistrationResponse>
   */
  async registerFace(descriptors: Float32Array[]): Promise<FaceRegistrationResponse> {
    try {
      const response = await axios.post(`${this.baseURL}/api/auth/register-face`, {
        descriptors: descriptors.map(desc => Array.from(desc))
      });

      return {
        success: true,
        message: response.data.message,
        userId: response.data.userId
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
      const response = await axios.post(`${this.baseURL}/api/auth/face-login`, {
        descriptor: Array.from(descriptor)
      });

      return {
        success: true,
        message: response.data.message,
        user: response.data.user,
        token: response.data.token
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
      const response = await axios.get(`${this.baseURL}/api/auth/face-data`);

      return {
        success: true,
        hasFaceData: response.data.hasFaceData,
        message: response.data.message
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
      const response = await axios.delete(`${this.baseURL}/api/auth/remove-face`);

      return {
        success: true,
        message: response.data.message
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
      const response = await axios.put(`${this.baseURL}/api/auth/update-face`, {
        descriptors: descriptors.map(desc => Array.from(desc))
      });

      return {
        success: true,
        message: response.data.message
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