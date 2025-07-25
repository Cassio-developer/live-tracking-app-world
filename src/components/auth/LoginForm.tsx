import React, { useState, useEffect } from 'react';
import { z } from 'zod';
import { useAuth } from '../../contexts/AuthContext';
import { faceAuthService } from '../../services/faceAuthService';
import { isFaceRecognitionSupported } from '../../utils/faceRecognition';
import FaceLogin from './FaceLogin';
import './AuthForms.css';

const loginSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  senha: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
});

const LoginForm: React.FC = () => {
  const [formData, setFormData] = useState({ nome: '', senha: '' });
  const [errors, setErrors] = useState<{ nome?: string; senha?: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showFaceLogin, setShowFaceLogin] = useState(false);
  const [hasFaceData, setHasFaceData] = useState(false);
  const [isFaceSupported, setIsFaceSupported] = useState(false);
  const { login } = useAuth();

  // Verificar suporte e dados faciais
  useEffect(() => {
    const checkFaceSupport = async () => {
      const supported = isFaceRecognitionSupported();
      setIsFaceSupported(supported);
      
      if (supported) {
        try {
          const response = await faceAuthService.checkFaceData();
          setHasFaceData(response.success && response.hasFaceData);
        } catch (error) {
          console.warn('Erro ao verificar dados faciais:', error);
        }
      }
    };

    checkFaceSupport();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsLoading(true);

    try {
      const validatedData = loginSchema.parse(formData);
      await login(validatedData);
      // Login bem-sucedido - o contexto já atualiza o estado
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        const fieldErrors = error.flatten().fieldErrors;
        setErrors({
          nome: fieldErrors.nome?.[0],
          senha: fieldErrors.senha?.[0],
        });
      } else {
        setErrors({ nome: error.message });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Limpar erro do campo quando usuário começa a digitar
    if (errors[name as keyof typeof errors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const handleFaceLoginSuccess = (user: any) => {
    // O contexto de autenticação será atualizado automaticamente
    console.log('✅ Login facial realizado com sucesso');
  };

  const handleFaceLoginError = (error: string) => {
    setErrors({ nome: `Login facial falhou: ${error}` });
    setShowFaceLogin(false);
  };

  const handleFaceLoginCancel = () => {
    setShowFaceLogin(false);
  };

  // Se mostrar login facial, renderizar componente FaceLogin
  if (showFaceLogin) {
    return (
      <FaceLogin
        onLoginSuccess={handleFaceLoginSuccess}
        onLoginError={handleFaceLoginError}
        onCancel={handleFaceLoginCancel}
        className="auth-form-content"
      />
    );
  }

  return (
    <div className="auth-form-content">
      {/* Opção de login facial */}
      {isFaceSupported && hasFaceData && (
        <div className="face-login-option">
          <button
            type="button"
            onClick={() => setShowFaceLogin(true)}
            className="face-login-button"
          >
            <span className="face-icon">👤</span>
            <span>Entrar com Reconhecimento Facial</span>
          </button>
          
          <div className="divider">
            <span>ou</span>
          </div>
        </div>
      )}

      {/* Formulário de login tradicional */}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <input
            type="text"
            name="nome"
            placeholder="Nome de usuário"
            value={formData.nome}
            onChange={handleChange}
            className={errors.nome ? 'error' : ''}
          />
          {errors.nome && <span className="error-message">{errors.nome}</span>}
        </div>

        <div className="form-group">
          <input
            type="password"
            name="senha"
            placeholder="Senha"
            value={formData.senha}
            onChange={handleChange}
            className={errors.senha ? 'error' : ''}
          />
          {errors.senha && <span className="error-message">{errors.senha}</span>}
        </div>

        <button type="submit" disabled={isLoading} className="auth-button">
          {isLoading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>

      {/* Informações sobre reconhecimento facial */}
      {isFaceSupported && !hasFaceData && (
        <div className="face-info">
          <p className="face-info-text">
            💡 <strong>Dica:</strong> Configure o reconhecimento facial no seu perfil 
            para um login mais rápido e seguro!
          </p>
        </div>
      )}

      {!isFaceSupported && (
        <div className="face-info">
          <p className="face-info-text">
            ℹ️ Seu dispositivo não suporta reconhecimento facial
          </p>
        </div>
      )}
    </div>
  );
};

export default LoginForm; 