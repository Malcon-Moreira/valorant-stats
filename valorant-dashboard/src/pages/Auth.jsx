import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ nick: '', tag: '', email: '', password: '' });
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const endpoint = isLogin ? 'https://valorant-backend-76hl.onrender.com/login' : 'https://valorant-backend-76hl.onrender.com/register';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    const data = await response.json();

    if (response.ok) {
      if (isLogin) {
        localStorage.setItem('token', data.access_token);
        navigate('/dashboard');
      } else {
        alert("Cadastro realizado! Faça login.");
        setIsLogin(true);
      }
    } else {
      alert(data.msg);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f1923] flex items-center justify-center p-4">
      <div className="bg-[#1f2326] p-8 rounded-xl w-full max-w-md border-t-4 border-t-[#ff4655] shadow-xl">
        <h2 className="text-2xl font-bold text-white mb-6 text-center uppercase tracking-wide">
          {isLogin ? 'Entrar no ValoStats' : 'Criar Conta'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="flex gap-2">
              <input
                type="text" placeholder="Nick (ex: TenZ)" required
                className="w-2/3 p-3 bg-[#0f1923] text-white rounded border border-slate-700"
                onChange={e => setFormData({...formData, nick: e.target.value})}
              />
              <input
                type="text" placeholder="Tag (ex: 000)" required
                className="w-1/3 p-3 bg-[#0f1923] text-white rounded border border-slate-700"
                onChange={e => setFormData({...formData, tag: e.target.value})}
              />
            </div>
          )}
          <input
            type="email" placeholder="E-mail" required
            className="w-full p-3 bg-[#0f1923] text-white rounded border border-slate-700"
            onChange={e => setFormData({...formData, email: e.target.value})}
          />
          <input
            type="password" placeholder="Senha" required
            className="w-full p-3 bg-[#0f1923] text-white rounded border border-slate-700"
            onChange={e => setFormData({...formData, password: e.target.value})}
          />
          <button type="submit" className="w-full bg-[#ff4655] text-white font-bold py-3 rounded hover:bg-[#e03e4d] transition-colors">
            {isLogin ? 'Entrar' : 'Cadastrar'}
          </button>
        </form>

        <p className="text-slate-400 text-center mt-4 cursor-pointer hover:text-white" onClick={() => setIsLogin(!isLogin)}>
          {isLogin ? "Não tem conta? Cadastre-se" : "Já tem conta? Faça login"}
        </p>
      </div>
    </div>
  );
}