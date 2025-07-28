export interface User {
  id: string;
  nome: string;
  isAdmin: boolean;
  avatar?: string;
}

export interface LoginData {
  nome: string;
  senha: string;
}

export interface RegisterData {
  nome: string;
  senha: string;
  avatar?: string;
}

export interface AuthResponse {
  message: string;
  user: User;
}

export interface RegisterResponse {
  message: string;
}

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: LoginData) => Promise<AuthResponse>;
  register: (data: RegisterData) => Promise<RegisterResponse>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  setUserDirectly: (user: User) => void;
} 