import React, { useState } from 'react';
import { Eye, EyeOff, User, Lock, Mail, Tag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Estados dos formulários
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nick, setNick] = useState('');
  const [tag, setTag] = useState('');

  // Estados dos "olhinhos"
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const navigate = useNavigate();
  const baseUrl = 'https://valorant-backend-76hl.onrender.com';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validação da Confirmação de Senha no Cadastro
    if (!isLogin && password !== confirmPassword) {
      setError('As senhas não coincidem. Verifique e tente novamente.');
      return;
    }

    setLoading(true);
    const endpoint = isLogin ? '/login' : '/register';
    const payload = isLogin
      ? { email, password }
      : { nick, tag, email, password };

    try {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.msg || 'Erro na requisição');
      }

      if (isLogin) {
        localStorage.setItem('token', data.access_token);
        navigate('/dashboard');
      } else {
        // Se cadastrou com sucesso, limpa os campos e muda para a aba de Login
        alert('Conta criada com sucesso! Faça login para continuar.');
        setIsLogin(true);
        setPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f1923] flex items-center justify-center p-4 font-sans selection:bg-[#ff4655] selection:text-white">
      <div className="bg-[#1f2326] max-w-md w-full rounded-2xl shadow-2xl border border-slate-800 overflow-hidden">

        {/* Cabeçalho */}
        <div className="bg-[#161a1d] p-6 text-center border-b border-slate-800">
          <h1 className="text-3xl font-bold text-white tracking-wide uppercase flex items-center justify-center gap-2">
            Valo<span className="text-[#ff4655]">Stats</span>
          </h1>
          <p className="text-slate-400 mt-2 text-sm">
            {isLogin ? 'Entre para ver suas estatísticas' : 'Crie sua conta para rastrear seu desempenho'}
          </p>
        </div>

        {/* Formulário */}
        <div className="p-8">
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg text-sm mb-6 text-center font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Campos exclusivos do Registo */}
            {!isLogin && (
              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <User className="absolute left-3 top-3 h-5 w-5 text-slate-500" />
                  <input
                    type="text"
                    required
                    placeholder="Nickname (ex: Vivano Steak)"
                    value={nick}
                    onChange={(e) => setNick(e.target.value)}
                    className="w-full bg-[#0f1923] border border-slate-700 text-white rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:border-[#ff4655] transition-colors"
                  />
                </div>
                <div className="w-1/3 relative">
                  <Tag className="absolute left-3 top-3 h-5 w-5 text-slate-500" />
                  <input
                    type="text"
                    required
                    placeholder="Tag"
                    value={tag}
                    onChange={(e) => setTag(e.target.value)}
                    className="w-full bg-[#0f1923] border border-slate-700 text-white rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:border-[#ff4655] transition-colors"
                  />
                </div>
              </div>
            )}

            {/* Campo Email */}
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-5 w-5 text-slate-500" />
              <input
                type="email"
                required
                placeholder="E-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#0f1923] border border-slate-700 text-white rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:border-[#ff4655] transition-colors"
              />
            </div>

            {/* Campo Senha */}
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-500" />
              <input
                type={showPassword ? "text" : "password"}
                required
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#0f1923] border border-slate-700 text-white rounded-lg pl-10 pr-12 py-2.5 focus:outline-none focus:border-[#ff4655] transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-slate-500 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>

            {/* Confirmação de Senha (Só aparece no Registo) */}
            {!isLogin && (
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-500" />
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  placeholder="Confirme a Senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-[#0f1923] border border-slate-700 text-white rounded-lg pl-10 pr-12 py-2.5 focus:outline-none focus:border-[#ff4655] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-3 text-slate-500 hover:text-white transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            )}

            {/* Botão de Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#ff4655] hover:bg-[#e03e4b] text-white font-bold py-3 rounded-lg transition-colors mt-4 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider text-sm"
            >
              {loading ? 'Processando...' : isLogin ? 'Entrar' : 'Criar Conta'}
            </button>
          </form>

          {/* Toggle Login/Registo */}
          <div className="mt-6 text-center text-slate-400 text-sm">
            {isLogin ? "Ainda não tem uma conta? " : "Já possui uma conta? "}
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError(''); // Limpa os erros ao trocar de aba
              }}
              className="text-[#ff4655] font-semibold hover:underline"
            >
              {isLogin ? 'Cadastre-se' : 'Faça Login'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}