import React, { useState } from 'react';
import { z } from 'zod';
import { useAuth } from '../../contexts/AuthContext';
import './AuthForms.css';

const registerSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(50, 'Nome muito longo'),
  senha: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  confirmarSenha: z.string(),
}).refine((data) => data.senha === data.confirmarSenha, {
  message: "Senhas não coincidem",
  path: ["confirmarSenha"],
});

const RegisterForm: React.FC = () => {
  const [formData, setFormData] = useState({ 
    nome: '', 
    senha: '', 
    confirmarSenha: '' 
  });
  const [errors, setErrors] = useState<{ 
    nome?: string; 
    senha?: string; 
    confirmarSenha?: string;
    geral?: string;
  }>({});
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsLoading(true);

    try {
      const validatedData = registerSchema.parse(formData);
      await register({
        nome: validatedData.nome,
        senha: validatedData.senha,
      });
      
      // Cadastro bem-sucedido - mostrar mensagem
      setErrors({ geral: 'Cadastro realizado com sucesso! Faça login para continuar.' });
      
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        const fieldErrors = error.flatten().fieldErrors;
        setErrors({
          nome: fieldErrors.nome?.[0],
          senha: fieldErrors.senha?.[0],
          confirmarSenha: fieldErrors.confirmarSenha?.[0],
        });
      } else {
        setErrors({ geral: error.message });
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
    <div className="auth-form-content">
      {errors.geral && (
        <div className={`message ${errors.geral.includes('sucesso') ? 'success' : 'error'}`}>
          {errors.geral}
        </div>
      )}
      
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

        <div className="form-group">
          <input
            type="password"
            name="confirmarSenha"
            placeholder="Confirmar senha"
            value={formData.confirmarSenha}
            onChange={handleChange}
            className={errors.confirmarSenha ? 'error' : ''}
          />
          {errors.confirmarSenha && <span className="error-message">{errors.confirmarSenha}</span>}
        </div>

        <button type="submit" disabled={isLoading} className="auth-button">
          {isLoading ? 'Cadastrando...' : 'Cadastrar'}
        </button>
      </form>
    </div>
  );
};

export default RegisterForm; 