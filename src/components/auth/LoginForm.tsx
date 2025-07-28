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

  // Verificar suporte a reconhecimento facial
  useEffect(() => {
    const checkFaceSupport = () => {
      const supported = isFaceRecognitionSupported();
      console.log('🔍 Suporte a reconhecimento facial:', supported);
      setIsFaceSupported(supported);
      
      // Por enquanto, não verificamos dados faciais na tela de login
      // pois o usuário pode não estar logado ainda
      setHasFaceData(false);
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
    // Atualizar o contexto de autenticação com o usuário logado
    console.log('✅ Login facial realizado com sucesso');
    // O contexto será atualizado automaticamente pelo FaceLogin
    // Não precisamos fazer nada aqui, pois o AuthContext já foi atualizado
  };

  const handleFaceLoginError = (error: string) => {
    setErrors({ nome: `Login facial falhou: ${error}` });
    setShowFaceLogin(false);
  };

  const handleFaceLoginCancel = () => {
    setShowFaceLogin(false);
  };

  // Logs para debug
  console.log('🔍 Estados do login:', {
    isFaceSupported,
    hasFaceData,
    showFaceLogin,
    shouldShowFaceOption: isFaceSupported && hasFaceData
  });

  // Se mostrar login facial, renderizar componente FaceLogin
  if (showFaceLogin) {
    return (
      <FaceLogin
        onLoginError={handleFaceLoginError}
        onCancel={handleFaceLoginCancel}
        className="auth-form-content"
      />
    );
  }

  return (
    <div className="auth-form-content">
      <div className="login-options">
        {/* Opção de login facial */}
        {isFaceSupported && (
          <div className="login-option face-option">
            <button
              type="button"
              onClick={() => setShowFaceLogin(true)}
              className="login-option-button face-login-button"
            >
              <div className="option-icon">👤</div>
              <div className="option-content">
                <h3>Reconhecimento Facial</h3>
                <p>Login rápido e seguro com seu rosto</p>
              </div>
              <div className="option-arrow">→</div>
            </button>
          </div>
        )}

        {/* Opção de login tradicional */}
        <div className="login-option password-option">
          <div className="login-option-button password-login-button">
            <div className="option-icon">🔑</div>
            <div className="option-content">
              <h3>Login com Senha</h3>
              <p>Use seu nome de usuário e senha</p>
            </div>
          </div>
          
          {/* Formulário de login tradicional */}
          <form onSubmit={handleSubmit} className="password-form">
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
              {isLoading ? 'Entrando...' : 'Entrar com Senha'}
            </button>
          </form>
        </div>
      </div>

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