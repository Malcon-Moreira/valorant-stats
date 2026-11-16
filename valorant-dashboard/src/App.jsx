import React, { useMemo, useState, useEffect } from 'react';
// 1. Adicionadas as importações do React Router e da tela de Auth
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Auth from './pages/Auth';

import {
  Crosshair, Target, Trophy, Swords,
  Calendar, User, ChevronUp
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/" />;
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Auth />} />
        <Route path="/dashboard" element={
          <PrivateRoute>
            <ValorantDashboard />
          </PrivateRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}

// O export default foi removido daqui, pois o App já é o default
function ValorantDashboard() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');

    // 1. Vai imprimir no console exatamente o que o React está a tentar enviar
    console.log("Token lido do localStorage:", token);

    if (!token || token === 'undefined' || token === 'null') {
        console.error("O token está vazio ou corrompido. Abortando requisição.");
        setLoading(false);
        return;
    }

    fetch('https://valorant-backend-76hl.onrender.com/api/matches', {
      headers: {
        'Authorization': `Bearer ${token}` // Atenção ao espaço depois de Bearer
      }
    })
      .then(async response => {
        if (!response.ok) {
          // 2. Vai capturar o motivo exato pelo qual o Flask recusou (o erro 422)
          const errorData = await response.json();
          console.error("O Flask recusou a requisição. Motivo:", errorData);
          throw new Error("Falha na autorização");
        }
        return response.json();
      })
      .then(data => {
        setMatches(data);
        setLoading(false);
      })
      .catch(error => {
        console.error("Erro no processo:", error);
        setLoading(false);
      });
  }, []);

  const stats = useMemo(() => {
    if (!matches.length) return { kd: 0, hs: 0, score: 0 };

    let totalKills = 0, totalDeaths = 0, totalScore = 0, totalHs = 0;

    matches.forEach(m => {
      totalKills += m.kills;
      totalDeaths += m.deaths;
      totalScore += m.score;
      totalHs += m.headshot_percent;
    });

    return {
      kd: totalDeaths === 0 ? totalKills : (totalKills / totalDeaths).toFixed(2),
      hs: (totalHs / matches.length).toFixed(1),
      score: Math.round(totalScore / matches.length)
    };
  }, [matches]);

  const chartData = useMemo(() => {
    return [...matches].reverse().map((match, index) => ({
      name: `P${index + 1} (${match.agent})`,
      Kills: match.kills,
      Deaths: match.deaths,
    }));
  }, [matches]);

  const getClassColor = (agentClass) => {
    switch(agentClass) {
      case 'Duelist': return 'text-orange-400 bg-orange-400/10 border-orange-400/20';
      case 'Sentinel': return 'text-slate-300 bg-slate-300/10 border-slate-300/20';
      case 'Controller': return 'text-purple-400 bg-purple-400/10 border-purple-400/20';
      case 'Initiator': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
      default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1923] flex items-center justify-center">
        <h1 className="text-white text-2xl animate-pulse">Carregando dados do servidor...</h1>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1923] text-slate-200 font-sans selection:bg-[#ff4655] selection:text-white">
      {/* Navbar Superior */}
      <nav className="bg-[#1f2326] border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="bg-[#ff4655] p-2 rounded-lg">
                <Swords className="w-6 h-6 text-white" />
              </div>
              <span className="font-bold text-xl tracking-wider text-white uppercase">
                Valo<span className="text-[#ff4655]">Stats</span>
              </span>
            </div>
            {/* Botão de Sair adicionado na Navbar */}
            <button
              onClick={() => {
                localStorage.removeItem('token');
                window.location.href = '/';
              }}
              className="text-slate-400 hover:text-white transition-colors"
            >
              Sair
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Cabeçalho */}
        <div>
          <h1 className="text-3xl font-bold text-white tracking-wide uppercase">Seu Desempenho</h1>
          <p className="text-slate-400 mt-1">Análise das suas estatísticas recentes puxadas do Neon.</p>
        </div>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#1f2326] border-t-4 border-t-[#ff4655] rounded-b-xl shadow-lg p-6 group">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-400 text-sm font-medium uppercase tracking-wider">K/D Médio</p>
                <h3 className="text-4xl font-bold text-white mt-2">{stats.kd}</h3>
              </div>
              <Crosshair className="w-6 h-6 text-[#ff4655]" />
            </div>
          </div>
          <div className="bg-[#1f2326] border-t-4 border-t-[#ff4655] rounded-b-xl shadow-lg p-6 group">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-400 text-sm font-medium uppercase tracking-wider">Headshot Médio</p>
                <h3 className="text-4xl font-bold text-white mt-2">{stats.hs}%</h3>
              </div>
              <Target className="w-6 h-6 text-[#ff4655]" />
            </div>
          </div>
          <div className="bg-[#1f2326] border-t-4 border-t-[#ff4655] rounded-b-xl shadow-lg p-6 group">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-400 text-sm font-medium uppercase tracking-wider">Combat Score (Média)</p>
                <h3 className="text-4xl font-bold text-white mt-2">{stats.score}</h3>
              </div>
              <Trophy className="w-6 h-6 text-[#ff4655]" />
            </div>
          </div>
        </div>

        {/* Gráfico */}
        <div className="bg-[#1f2326] rounded-xl shadow-lg p-6 border border-slate-800">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#ff4655]" />
            Kills vs Mortes (Últimas Partidas)
          </h2>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" vertical={false} />
                <XAxis dataKey="name" stroke="#a0aec0" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#a0aec0" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#1a202c', borderColor: '#2d3748', borderRadius: '8px', color: '#fff' }} />
                <Legend />
                <Bar dataKey="Kills" fill="#ff4655" radius={[4, 4, 0, 0]} maxBarSize={50} />
                <Bar dataKey="Deaths" fill="#4a5568" radius={[4, 4, 0, 0]} maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tabela */}
        <div className="bg-[#1f2326] rounded-xl shadow-lg border border-slate-800 overflow-hidden">
          <div className="p-6 border-b border-slate-800">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <User className="w-5 h-5 text-[#ff4655]" />
              Histórico de Partidas
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#161a1d] text-slate-400 text-sm uppercase tracking-wider">
                  <th className="p-4 font-medium">Data</th>
                  <th className="p-4 font-medium">Agente</th>
                  <th className="p-4 font-medium text-center">K/D/A</th>
                  <th className="p-4 font-medium text-center">K/D Ratio</th>
                  <th className="p-4 font-medium text-center">Headshot %</th>
                  <th className="p-4 font-medium text-right">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-sm">
                {matches.map((match) => {
                  const kdRatio = (match.kills / match.deaths).toFixed(2);
                  const isPositive = match.kills >= match.deaths;

                  return (
                    <tr key={match.match_id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-4 whitespace-nowrap">
                        <span className="text-slate-300 block">{match.date.split(' ')[0]}</span>
                        <span className="text-slate-500 text-xs">{match.date.split(' ')[1]}</span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${getClassColor(match.class)}`}>
                          {match.agent}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="font-bold text-white">{match.kills}</span>
                        <span className="text-slate-500 mx-1">/</span>
                        <span className="font-bold text-slate-400">{match.deaths}</span>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`font-bold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                          {kdRatio}
                        </span>
                      </td>
                      <td className="p-4 text-center text-slate-300">{match.headshot_percent}%</td>
                      <td className="p-4 text-right font-bold text-white">{match.score}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}