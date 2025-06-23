import React, { useState } from 'react';
import { z } from 'zod';
import { useAuth } from '../../contexts/AuthContext';
import './AuthForms.css';

const loginSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  senha: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
});

const LoginForm: React.FC = () => {
  const [formData, setFormData] = useState({ nome: '', senha: '' });
  const [errors, setErrors] = useState<{ nome?: string; senha?: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

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

  return (
    <form onSubmit={handleSubmit} className="auth-form-content">
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
  );
};

export default LoginForm; 