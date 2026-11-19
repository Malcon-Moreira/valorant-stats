import React, { useMemo, useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Auth from './pages/Auth';
import {
  Crosshair, Target, Trophy, Swords,
  Calendar, User, Map, Activity, Users, Filter,
  Crown, Skull, ThumbsDown
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
    <HashRouter>
      <Routes>
        <Route path="/" element={<Auth />} />
        <Route path="/dashboard" element={
          <PrivateRoute>
            <ValorantDashboard />
          </PrivateRoute>
        } />
      </Routes>
    </HashRouter>
  );
}

function ValorantDashboard() {
  const [matches, setMatches] = useState([]);
  const [profile, setProfile] = useState(null);
  const [viewingFriend, setViewingFriend] = useState(false);
  const [leaderboard, setLeaderboard] = useState({
    highlights: null,
    best_by_class: {},
    ranking: []
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('personal');
  const [roleFilter, setRoleFilter] = useState('All');

  const baseUrl = 'https://valorant-backend-76hl.onrender.com';

  const loadMyData = () => {
    const token = localStorage.getItem('token');

    if (!token || token === 'undefined' || token === 'null') {
      console.error("O token está vazio ou corrompido. Abortando requisição.");
      setLoading(false);
      return;
    }

    setLoading(true);
    const headers = { 'Authorization': `Bearer ${token}` };

    Promise.all([
      fetch(`${baseUrl}/api/matches`, { headers }),
      fetch(`${baseUrl}/api/leaderboard`, { headers })
    ])
      .then(async ([resMatches, resLeaderboard]) => {
        if (!resMatches.ok) {
          const errorData = await resMatches.json();
          console.error("Erro em /api/matches:", errorData);
          throw new Error("Falha na autorização");
        }
        const dataMatches = await resMatches.json();
        setMatches(dataMatches.matches || []);
        setProfile(dataMatches.profile || null);
        setViewingFriend(false);
        setRoleFilter('All');

        if (resLeaderboard.ok) {
          const dataLeaderboard = await resLeaderboard.json();
          setLeaderboard(dataLeaderboard);
        }
        setLoading(false);
      })
      .catch(error => {
        console.error("Erro no processo:", error);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadMyData();
  }, []);

  const handleViewPlayer = async (idPlayer) => {
    if (!idPlayer) return;
    const token = localStorage.getItem('token');
    setLoading(true);
    try {
      const res = await fetch(`${baseUrl}/api/player/${idPlayer}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile);
        setMatches(data.matches || []);
        setViewingFriend(true);
        setRoleFilter('All');
        setActiveTab('personal');
      }
    } catch (error) {
      console.error("Erro ao carregar perfil do jogador:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredMatches = useMemo(() => {
    if (roleFilter === 'All') return matches;
    return matches.filter(m => m.class === roleFilter);
  }, [matches, roleFilter]);

  const stats = useMemo(() => {
    if (!filteredMatches.length) return { kd: 0, hs: 0, score: 0 };

    let totalKills = 0, totalDeaths = 0, totalScore = 0, totalHs = 0;

    filteredMatches.forEach(m => {
      totalKills += m.kills;
      totalDeaths += m.deaths;
      totalScore += m.score;
      totalHs += m.headshot_percent;
    });

    return {
      kd: totalDeaths === 0 ? totalKills : (totalKills / totalDeaths).toFixed(2),
      hs: (totalHs / filteredMatches.length).toFixed(1),
      score: Math.round(totalScore / filteredMatches.length)
    };
  }, [filteredMatches]);

  const extraStats = useMemo(() => {
    if (!filteredMatches.length) return { winRate: 0, favoriteMap: 'N/A' };

    const vitorias = filteredMatches.filter(p => p.result === 'Vitória').length;
    const empates = filteredMatches.filter(p => p.result === 'Empate').length;
    const totalPartidasValidas = filteredMatches.length - empates;

    const winRate = totalPartidasValidas > 0
      ? ((vitorias / totalPartidasValidas) * 100).toFixed(1)
      : 0;

    const mapas = filteredMatches.filter(p => p.map).map(p => p.map);
    const mapaFavorito = mapas.length > 0
      ? mapas.sort((a, b) => mapas.filter(v => v === a).length - mapas.filter(v => v === b).length).pop()
      : 'N/A';

    return { winRate, favoriteMap: mapaFavorito };
  }, [filteredMatches]);

  const eloProjection = useMemo(() => {
    if (!profile || !filteredMatches.length) return null;
    const wr = parseFloat(extraStats.winRate) / 100;
    const kd = parseFloat(stats.kd);
    const rr = profile.rr || 0;

    // Estima ganho/perda média de RR ponderada pelo K/D
    const avgWinRR = Math.min(30, Math.max(14, 20 + (kd - 1) * 5));
    const avgLossRR = Math.min(26, Math.max(12, 18 - (kd - 1) * 4));
    const expectedRRPerMatch = (wr * avgWinRR) - ((1 - wr) * avgLossRR);

    if (expectedRRPerMatch > 0.5) {
      const matchesToRankUp = Math.ceil((100 - rr) / expectedRRPerMatch);
      return {
        status: 'up',
        text: `~${matchesToRankUp} partidas para subir de elo`,
        detail: `Média estimada de +${expectedRRPerMatch.toFixed(1)} RR por partida`
      };
    }
    return {
      status: 'down',
      text: 'Tendência de estagnação / queda',
      detail: `Média estimada de ${expectedRRPerMatch.toFixed(1)} RR por partida`
    };
  }, [profile, extraStats.winRate, stats.kd, filteredMatches.length]);

  const chartData = useMemo(() => {
    return [...filteredMatches].reverse().map((match, index) => ({
      name: `P${index + 1} (${match.agent})`,
      Kills: match.kills,
      Deaths: match.deaths,
    }));
  }, [filteredMatches]);

  const getClassColor = (agentClass) => {
    switch (agentClass) {
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

            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  if (viewingFriend) {
                    loadMyData();
                  }
                  setActiveTab('personal');
                }}
                className={`px-4 py-2 rounded-md font-semibold transition-colors ${
                  activeTab === 'personal' ? 'bg-[#ff4655] text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Meu Perfil
              </button>
              <button
                onClick={() => setActiveTab('global')}
                className={`px-4 py-2 rounded-md font-semibold transition-colors ${
                  activeTab === 'global' ? 'bg-[#ff4655] text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Leaderboard
              </button>
              <button
                onClick={() => {
                  localStorage.removeItem('token');
                  window.location.href = '/';
                }}
                className="text-slate-400 hover:text-white transition-colors ml-2"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* ABA 1: PERFIL DO JOGADOR */}
        {activeTab === 'personal' && (
          <>
            {viewingFriend && (
              <button
                onClick={loadMyData}
                className="text-sm text-[#ff4655] hover:underline font-semibold"
              >
                ← Voltar para o meu perfil
              </button>
            )}

            {/* Banner do Jogador (Card + Nick + Elo + Projeção) */}
            {profile && (
              <div className="bg-[#1f2326] rounded-xl border border-slate-800 overflow-hidden shadow-lg flex flex-col md:flex-row items-center justify-between p-6 gap-6">
                <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
                  {profile.card_url && (
                    <img
                      src={profile.card_url}
                      alt="Player Card"
                      className="h-20 w-44 object-cover rounded-lg border border-slate-700"
                    />
                  )}
                  <div>
                    <h2 className="text-2xl font-bold text-white">
                      {profile.nick}
                      <span className="text-slate-500 text-lg font-normal">#{profile.tag}</span>
                    </h2>
                    <p className="text-slate-400 text-sm mt-1">
                      Elo atual: <span className="text-white font-semibold">{profile.elo}</span> •{' '}
                      <span className="text-[#ff4655] font-bold">{profile.rr} RR</span>
                    </p>
                  </div>
                </div>

                {eloProjection && (
                  <div className={`px-4 py-3 rounded-lg border text-center md:text-right ${
                    eloProjection.status === 'up'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-red-500/10 border-red-500/30 text-red-400'
                  }`}>
                    <p className="text-xs uppercase font-bold tracking-wider">Projeção de Elo</p>
                    <p className="text-base font-bold text-white mt-0.5">{eloProjection.text}</p>
                    <p className="text-xs opacity-80">{eloProjection.detail}</p>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
              <div>
                <h1 className="text-3xl font-bold text-white tracking-wide uppercase">
                  {viewingFriend ? `Desempenho de ${profile?.nick}` : 'Seu Desempenho'}
                </h1>
                <p className="text-slate-400 mt-1">Análise das estatísticas recentes.</p>
              </div>

              <div className="flex items-center gap-2 bg-[#1f2326] p-1.5 rounded-lg border border-slate-800 w-fit">
                <Filter className="w-4 h-4 text-slate-400 ml-2" />
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="bg-[#1f2326] text-sm font-semibold text-slate-300 outline-none p-1 cursor-pointer"
                >
                  <option value="All">Todas as Classes</option>
                  <option value="Duelist">Duelistas</option>
                  <option value="Initiator">Iniciadores</option>
                  <option value="Controller">Controladores</option>
                  <option value="Sentinel">Sentinelas</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
              <div className="bg-[#1f2326] border-t-4 border-t-[#ff4655] rounded-b-xl shadow-lg p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-slate-400 text-sm font-medium uppercase tracking-wider">K/D Médio</p>
                    <h3 className="text-4xl font-bold text-white mt-2">{stats.kd}</h3>
                  </div>
                  <Crosshair className="w-6 h-6 text-[#ff4655]" />
                </div>
              </div>

              <div className="bg-[#1f2326] border-t-4 border-t-[#ff4655] rounded-b-xl shadow-lg p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-slate-400 text-sm font-medium uppercase tracking-wider">Headshot</p>
                    <h3 className="text-4xl font-bold text-white mt-2">{stats.hs}%</h3>
                  </div>
                  <Target className="w-6 h-6 text-[#ff4655]" />
                </div>
              </div>

              <div className="bg-[#1f2326] border-t-4 border-t-[#ff4655] rounded-b-xl shadow-lg p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-slate-400 text-sm font-medium uppercase tracking-wider">Score</p>
                    <h3 className="text-4xl font-bold text-white mt-2">{stats.score}</h3>
                  </div>
                  <Trophy className="w-6 h-6 text-[#ff4655]" />
                </div>
              </div>

              <div className="bg-[#1f2326] border-t-4 border-t-[#ff4655] rounded-b-xl shadow-lg p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-slate-400 text-sm font-medium uppercase tracking-wider">Win Rate</p>
                    <h3 className="text-4xl font-bold text-white mt-2">{extraStats.winRate}%</h3>
                  </div>
                  <Activity className="w-6 h-6 text-[#ff4655]" />
                </div>
              </div>

              <div className="bg-[#1f2326] border-t-4 border-t-[#ff4655] rounded-b-xl shadow-lg p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-slate-400 text-sm font-medium uppercase tracking-wider">Melhor Mapa</p>
                    <h3 className="text-xl font-bold text-white mt-2 truncate max-w-[120px]" title={extraStats.favoriteMap}>
                      {extraStats.favoriteMap}
                    </h3>
                  </div>
                </div>
              </div>
            </div>

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
                      <th className="p-4 font-medium">Mapa</th>
                      <th className="p-4 font-medium">Agente</th>
                      <th className="p-4 font-medium text-center">Resultado</th>
                      <th className="p-4 font-medium text-center">K/D</th>
                      <th className="p-4 font-medium text-center">K/D Ratio</th>
                      <th className="p-4 font-medium text-center">Headshot %</th>
                      <th className="p-4 font-medium text-right">Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50 text-sm">
                    {filteredMatches.map((match) => {
                      const kdRatio = match.deaths === 0 ? match.kills.toFixed(2) : (match.kills / match.deaths).toFixed(2);
                      const isPositive = match.kills >= match.deaths;

                      return (
                        <tr key={match.match_id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="p-4 whitespace-nowrap">
                            <span className="text-slate-300 block">{match.date.split(' ')[0]}</span>
                            <span className="text-slate-500 text-xs">{match.date.split(' ')[1]}</span>
                          </td>
                          <td className="p-4 text-slate-300 font-medium">{match.map || '-'}</td>
                          <td className="p-4">
                            <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${getClassColor(match.class)}`}>
                              {match.agent}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <span className={`font-bold ${
                              match.result === 'Vitória' ? 'text-emerald-400' :
                              match.result === 'Derrota' ? 'text-red-400' : 'text-slate-400'
                            }`}>
                              {match.result || '-'}
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
          </>
        )}

        {/* ABA 2: LEADERBOARD SEMANAL */}
        {activeTab === 'global' && (
          <div className="space-y-8">
            <div>
              <h1 className="text-3xl font-bold text-white tracking-wide uppercase flex items-center gap-3">
                <Users className="text-[#ff4655]" /> Placar de Líderes Semanal
              </h1>
              <p className="text-slate-400 mt-1">Clique em qualquer jogador para ver suas estatísticas detalhadas.</p>
            </div>

            {!leaderboard.highlights ? (
              <div className="bg-[#1f2326] rounded-xl p-8 border border-slate-800 text-center text-slate-400">
                Nenhuma partida registrada nesta semana ainda.
              </div>
            ) : (
              <>
                {/* 6 Destaques da Semana */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="bg-[#1f2326] border-t-4 border-t-yellow-400 rounded-b-xl p-6 shadow-lg">
                    <div className="flex justify-between items-start">
                      <div className="min-w-0">
                        <p className="text-yellow-400 text-xs font-bold uppercase tracking-wider">MVP da Semana</p>
                        <button
                          onClick={() => handleViewPlayer(leaderboard.highlights.mvp.id_player)}
                          className="text-2xl font-bold text-white mt-1 truncate hover:text-[#ff4655] transition-colors text-left block w-full"
                        >
                          {leaderboard.highlights.mvp.nick}
                          <span className="text-slate-500 text-sm font-normal">#{leaderboard.highlights.mvp.player_tag}</span>
                        </button>
                        <p className="text-slate-400 text-sm mt-2">
                          Rating: <span className="text-white font-bold">{leaderboard.highlights.mvp.rating}</span> • K/D: {leaderboard.highlights.mvp.kd}
                        </p>
                      </div>
                      <Crown className="w-7 h-7 text-yellow-400 shrink-0" />
                    </div>
                  </div>

                  <div className="bg-[#1f2326] border-t-4 border-t-red-600 rounded-b-xl p-6 shadow-lg">
                    <div className="flex justify-between items-start">
                      <div className="min-w-0">
                        <p className="text-red-500 text-xs font-bold uppercase tracking-wider">Fracassado da Semana</p>
                        <button
                          onClick={() => handleViewPlayer(leaderboard.highlights.worst.id_player)}
                          className="text-2xl font-bold text-white mt-1 truncate hover:text-[#ff4655] transition-colors text-left block w-full"
                        >
                          {leaderboard.highlights.worst.nick}
                          <span className="text-slate-500 text-sm font-normal">#{leaderboard.highlights.worst.player_tag}</span>
                        </button>
                        <p className="text-slate-400 text-sm mt-2">
                          Rating: <span className="text-white font-bold">{leaderboard.highlights.worst.rating}</span> • K/D: {leaderboard.highlights.worst.kd}
                        </p>
                      </div>
                      <ThumbsDown className="w-7 h-7 text-red-500 shrink-0" />
                    </div>
                  </div>

                  <div className="bg-[#1f2326] border-t-4 border-t-[#ff4655] rounded-b-xl p-6 shadow-lg">
                    <div className="flex justify-between items-start">
                      <div className="min-w-0">
                        <p className="text-[#ff4655] text-xs font-bold uppercase tracking-wider">Maior Média de Kills</p>
                        <button
                          onClick={() => handleViewPlayer(leaderboard.highlights.top_kills.id_player)}
                          className="text-2xl font-bold text-white mt-1 truncate hover:text-[#ff4655] transition-colors text-left block w-full"
                        >
                          {leaderboard.highlights.top_kills.nick}
                          <span className="text-slate-500 text-sm font-normal">#{leaderboard.highlights.top_kills.player_tag}</span>
                        </button>
                        <p className="text-slate-400 text-sm mt-2">
                          <span className="text-white font-bold">{leaderboard.highlights.top_kills.media_kills}</span> kills / partida
                        </p>
                      </div>
                      <Crosshair className="w-7 h-7 text-[#ff4655] shrink-0" />
                    </div>
                  </div>

                  <div className="bg-[#1f2326] border-t-4 border-t-slate-400 rounded-b-xl p-6 shadow-lg">
                    <div className="flex justify-between items-start">
                      <div className="min-w-0">
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Quem Mais Morreu</p>
                        <button
                          onClick={() => handleViewPlayer(leaderboard.highlights.most_deaths.id_player)}
                          className="text-2xl font-bold text-white mt-1 truncate hover:text-[#ff4655] transition-colors text-left block w-full"
                        >
                          {leaderboard.highlights.most_deaths.nick}
                          <span className="text-slate-500 text-sm font-normal">#{leaderboard.highlights.most_deaths.player_tag}</span>
                        </button>
                        <p className="text-slate-400 text-sm mt-2">
                          <span className="text-white font-bold">{leaderboard.highlights.most_deaths.total_deaths}</span> mortes no total
                        </p>
                      </div>
                      <Skull className="w-7 h-7 text-slate-400 shrink-0" />
                    </div>
                  </div>

                  <div className="bg-[#1f2326] border-t-4 border-t-purple-400 rounded-b-xl p-6 shadow-lg">
                    <div className="flex justify-between items-start">
                      <div className="min-w-0">
                        <p className="text-purple-400 text-xs font-bold uppercase tracking-wider">Quem gosta de uma cabeçaS</p>
                        <button
                          onClick={() => handleViewPlayer(leaderboard.highlights.top_hs.id_player)}
                          className="text-2xl font-bold text-white mt-1 truncate hover:text-[#ff4655] transition-colors text-left block w-full"
                        >
                          {leaderboard.highlights.top_hs.nick}
                          <span className="text-slate-500 text-sm font-normal">#{leaderboard.highlights.top_hs.player_tag}</span>
                        </button>
                        <p className="text-slate-400 text-sm mt-2">
                          <span className="text-white font-bold">{leaderboard.highlights.top_hs.hs_medio}%</span> de headshots
                        </p>
                      </div>
                      <Target className="w-7 h-7 text-purple-400 shrink-0" />
                    </div>
                  </div>

                  <div className="bg-[#1f2326] border-t-4 border-t-emerald-400 rounded-b-xl p-6 shadow-lg">
                    <div className="flex justify-between items-start">
                      <div className="min-w-0">
                        <p className="text-emerald-400 text-xs font-bold uppercase tracking-wider">Quem Mais Venceu</p>
                        <button
                          onClick={() => handleViewPlayer(leaderboard.highlights.most_wins.id_player)}
                          className="text-2xl font-bold text-white mt-1 truncate hover:text-[#ff4655] transition-colors text-left block w-full"
                        >
                          {leaderboard.highlights.most_wins.nick}
                          <span className="text-slate-500 text-sm font-normal">#{leaderboard.highlights.most_wins.player_tag}</span>
                        </button>
                        <p className="text-slate-400 text-sm mt-2">
                          <span className="text-white font-bold">{leaderboard.highlights.most_wins.vitorias}</span> vitórias ({leaderboard.highlights.most_wins.win_rate}%)
                        </p>
                      </div>
                      <Trophy className="w-7 h-7 text-emerald-400 shrink-0" />
                    </div>
                  </div>
                </div>

                {/* Melhores por Classe de Agente */}
                {leaderboard.best_by_class && Object.keys(leaderboard.best_by_class).length > 0 && (
                  <div>
                    <h2 className="text-xl font-bold text-white uppercase tracking-wide mb-4">
                      Melhores por Classe
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {['Duelist', 'Initiator', 'Controller', 'Sentinel'].map((role) => {
                        const p = leaderboard.best_by_class[role];
                        if (!p) return null;
                        return (
                          <div key={role} className="bg-[#1f2326] rounded-xl p-5 border border-slate-800 shadow-lg">
                            <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${getClassColor(role)}`}>
                              {role}
                            </span>
                            <button
                              onClick={() => handleViewPlayer(p.id_player)}
                              className="block text-xl font-bold text-white mt-3 hover:text-[#ff4655] transition-colors truncate w-full text-left"
                            >
                              {p.nick}
                              <span className="text-slate-500 text-xs font-normal">#{p.player_tag}</span>
                            </button>
                            <p className="text-slate-400 text-xs mt-1">
                              Rating: <span className="text-white font-bold">{p.rating}</span> • K/D: {p.kd} ({p.partidas} jogos)
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Tabela Geral Ordenada por Rating */}
                <div className="bg-[#1f2326] rounded-xl shadow-lg border border-slate-800 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#161a1d] text-slate-400 text-sm uppercase tracking-wider">
                          <th className="p-4 font-medium w-16 text-center">Rank</th>
                          <th className="p-4 font-medium">Jogador</th>
                          <th className="p-4 font-medium text-center">Partidas</th>
                          <th className="p-4 font-medium text-center">Vitórias</th>
                          <th className="p-4 font-medium text-center">K/D</th>
                          <th className="p-4 font-medium text-center">HS%</th>
                          <th className="p-4 font-medium text-right">Rating</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        {leaderboard.ranking.map((player, index) => (
                          <tr key={player.id_player || index} className="hover:bg-slate-800/30 transition-colors">
                            <td className="p-4 text-center">
                              <span className={`text-lg font-bold ${index === 0 ? 'text-yellow-400' : index === 1 ? 'text-slate-300' : index === 2 ? 'text-amber-600' : 'text-slate-500'}`}>
                                #{index + 1}
                              </span>
                            </td>
                            <td className="p-4 font-bold text-white">
                              <button
                                onClick={() => handleViewPlayer(player.id_player)}
                                className="hover:text-[#ff4655] transition-colors text-left"
                              >
                                {player.nick}
                                <span className="text-slate-500 text-sm font-normal">#{player.player_tag}</span>
                              </button>
                            </td>
                            <td className="p-4 text-center text-slate-300">{player.partidas}</td>
                            <td className="p-4 text-center text-emerald-400 font-semibold">{player.vitorias}</td>
                            <td className="p-4 text-center text-white font-semibold">{player.kd}</td>
                            <td className="p-4 text-center text-slate-300">{player.hs_medio}%</td>
                            <td className="p-4 text-right font-bold text-[#ff4655] text-lg">{player.rating}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}