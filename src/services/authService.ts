import axios from 'axios';
import { LoginData, RegisterData, User, AuthResponse, RegisterResponse } from '../types/auth';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';
console.log('API_URL',API_URL)
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // Importante para cookies HttpOnly
});

export const authService = {
  login: async (data: LoginData): Promise<AuthResponse> => {
    const response = await api.post('/api/auth/login', data);
    return response.data;
  },
  register: async (data: RegisterData): Promise<RegisterResponse> => {
    const response = await api.post('/api/auth/register', data);
    return response.data;
  },
  logout: async (): Promise<void> => {
    await api.post('/api/auth/logout');
  },
  me: async (): Promise<{ user: User }> => {
    const response = await api.get('/api/auth/me');
    return response.data;
  },
  checkAuth: async (): Promise<{ user: User }> => {
    const response = await api.get('/api/auth/me');
    return response.data;
  },
  testGetUsers: async (): Promise<{ users: User[] }> => {
    const response = await api.get('/api/auth/users');
    return response.data;
  },
  saveLocation: async (data: { lat: number; lng: number; accuracy?: number; timestamp: number }) => {
    await api.post('/api/locations', data);
  },
  getLocationHistory: async (from?: string, to?: string) => {
    const params: any = {};
    if (from) params.from = from;
    if (to) params.to = to;
    const response = await api.get('/api/locations', { params });
    return response.data.locations;
  },
  updateAvatar: async (avatar: string) => {
    console.log('Tentando atualizar avatar:', avatar);
    console.log('API URL:', process.env.REACT_APP_API_URL || 'http://localhost:4000');
    try {
      const response = await api.patch('/api/users/me/avatar', { avatar });
      console.log('Avatar atualizado com sucesso:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('Erro ao atualizar avatar:', error);
      console.error('Status:', error.response?.status);
      console.error('Data:', error.response?.data);
      throw error;
    }
  },
}; 