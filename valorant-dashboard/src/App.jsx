import React, { useMemo, useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Auth from './pages/Auth';
import {
  Crosshair, Target, Trophy, Swords,
  Calendar, User, Map, Activity, Users, Filter,
  Crown, Skull, ThumbsDown, History
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/" />;
};

// Formata "2026-11-23" para "23/11 a 29/11" (Segunda a Domingo)
const formatWeekRange = (weekStartStr) => {
  if (!weekStartStr) return '';
  const start = new Date(`${weekStartStr}T12:00:00`);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const fmt = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  return `${fmt(start)} a ${fmt(end)}`;
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

  // Controle de semanas do Perfil
  const [personalSubTab, setPersonalSubTab] = useState('current');
  const [personalCurrentWeek, setPersonalCurrentWeek] = useState('');
  const [personalPastWeeks, setPersonalPastWeeks] = useState([]);
  const [selectedPersonalWeek, setSelectedPersonalWeek] = useState('');

  // Controle de semanas do Leaderboard
  const [leaderboard, setLeaderboard] = useState({
    week_start: '',
    current_week: '',
    available_weeks: [],
    highlights: null,
    best_by_class: {},
    ranking: []
  });
  const [globalSubTab, setGlobalSubTab] = useState('current');
  const [selectedGlobalWeek, setSelectedGlobalWeek] = useState('');

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('personal');
  const [roleFilter, setRoleFilter] = useState('All');

  const baseUrl = 'https://valorant-backend-76hl.onrender.com';

  const getHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  });

  const loadMyData = () => {
    const token = localStorage.getItem('token');
    if (!token || token === 'undefined' || token === 'null') {
      setLoading(false);
      return;
    }

    setLoading(true);
    Promise.all([
      fetch(`${baseUrl}/api/matches`, { headers: getHeaders() }),
      fetch(`${baseUrl}/api/leaderboard`, { headers: getHeaders() })
    ])
      .then(async ([resMatches, resLeaderboard]) => {
        if (!resMatches.ok) throw new Error("Falha na autorização");
        const dataMatches = await resMatches.json();

        setMatches(dataMatches.matches || []);
        setProfile(dataMatches.profile || null);
        setPersonalCurrentWeek(dataMatches.current_week || '');
        const pastPersonal = (dataMatches.available_weeks || []).filter(w => w !== dataMatches.current_week);
        setPersonalPastWeeks(pastPersonal);
        setPersonalSubTab('current');
        setSelectedPersonalWeek(pastPersonal[0] || '');
        setViewingFriend(false);
        setRoleFilter('All');

        if (resLeaderboard.ok) {
          const dataLeaderboard = await resLeaderboard.json();
          setLeaderboard(dataLeaderboard);
          const pastGlobal = (dataLeaderboard.available_weeks || []).filter(w => w !== dataLeaderboard.current_week);
          setSelectedGlobalWeek(pastGlobal[0] || '');
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

  // Busca partidas do perfil (próprio ou amigo) para uma semana específica
  const fetchPersonalWeek = async (weekStr, friendId = null) => {
    setLoading(true);
    try {
      const endpoint = friendId
        ? `${baseUrl}/api/player/${friendId}${weekStr ? `?week=${weekStr}` : ''}`
        : `${baseUrl}/api/matches${weekStr ? `?week=${weekStr}` : ''}`;

      const res = await fetch(endpoint, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setMatches(data.matches || []);
        setProfile(data.profile || null);
        setPersonalCurrentWeek(data.current_week || '');
        const past = (data.available_weeks || []).filter(w => w !== data.current_week);
        setPersonalPastWeeks(past);
        setRoleFilter('All');
      }
    } catch (error) {
      console.error("Erro ao carregar semana do perfil:", error);
    } finally {
      setLoading(false);
    }
  };

  // Busca leaderboard de uma semana específica
  const fetchGlobalWeek = async (weekStr) => {
    setLoading(true);
    try {
      const url = `${baseUrl}/api/leaderboard${weekStr ? `?week=${weekStr}` : ''}`;
      const res = await fetch(url, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data);
      }
    } catch (error) {
      console.error("Erro ao carregar semana do leaderboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePersonalSubTabChange = (tab) => {
    setPersonalSubTab(tab);
    const friendId = viewingFriend ? profile?.id_player : null;
    if (tab === 'current') {
      fetchPersonalWeek(null, friendId);
    } else if (personalPastWeeks.length > 0) {
      const targetWeek = selectedPersonalWeek && personalPastWeeks.includes(selectedPersonalWeek)
        ? selectedPersonalWeek
        : personalPastWeeks[0];
      setSelectedPersonalWeek(targetWeek);
      fetchPersonalWeek(targetWeek, friendId);
    } else {
      setMatches([]);
    }
  };

  const handleGlobalSubTabChange = (tab) => {
    setGlobalSubTab(tab);
    const pastGlobal = (leaderboard.available_weeks || []).filter(w => w !== leaderboard.current_week);
    if (tab === 'current') {
      fetchGlobalWeek(null);
    } else if (pastGlobal.length > 0) {
      const targetWeek = selectedGlobalWeek && pastGlobal.includes(selectedGlobalWeek)
        ? selectedGlobalWeek
        : pastGlobal[0];
      setSelectedGlobalWeek(targetWeek);
      fetchGlobalWeek(targetWeek);
    }
  };

  const handleViewPlayer = async (idPlayer) => {
    if (!idPlayer) return;
    setViewingFriend(true);
    setPersonalSubTab('current');
    setActiveTab('personal');
    await fetchPersonalWeek(null, idPlayer);
  };

  const globalPastWeeks = useMemo(() => {
    return (leaderboard.available_weeks || []).filter(w => w !== leaderboard.current_week);
  }, [leaderboard.available_weeks, leaderboard.current_week]);

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
                  if (viewingFriend) loadMyData();
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

            {/* Banner do Jogador */}
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

                {eloProjection && personalSubTab === 'current' && (
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

            {/* Sub-abas: Semana Atual vs Semanas Anteriores */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePersonalSubTabChange('current')}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${
                    personalSubTab === 'current'
                      ? 'bg-[#ff4655] text-white'
                      : 'bg-[#1f2326] text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  Semana Atual ({formatWeekRange(personalCurrentWeek)})
                </button>
                <button
                  onClick={() => handlePersonalSubTabChange('past')}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${
                    personalSubTab === 'past'
                      ? 'bg-[#ff4655] text-white'
                      : 'bg-[#1f2326] text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  <History className="w-4 h-4" />
                  Semanas Anteriores
                </button>
              </div>

              {personalSubTab === 'past' && personalPastWeeks.length > 0 && (
                <select
                  value={selectedPersonalWeek}
                  onChange={(e) => {
                    setSelectedPersonalWeek(e.target.value);
                    fetchPersonalWeek(e.target.value, viewingFriend ? profile?.id_player : null);
                  }}
                  className="bg-[#1f2326] border border-slate-700 rounded-lg px-3 py-2 text-sm font-semibold text-white outline-none cursor-pointer"
                >
                  {personalPastWeeks.map((w, idx) => (
                    <option key={w} value={w}>
                      {idx === 0 ? `Última Semana (${formatWeekRange(w)})` : `Semana de ${formatWeekRange(w)}`}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {personalSubTab === 'past' && personalPastWeeks.length === 0 ? (
              <div className="bg-[#1f2326] rounded-xl p-8 border border-slate-800 text-center text-slate-400">
                Nenhuma semana anterior registrada ainda.
              </div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
                  <div>
                    <h1 className="text-3xl font-bold text-white tracking-wide uppercase">
                      {viewingFriend ? `Desempenho de ${profile?.nick}` : 'Seu Desempenho'}
                    </h1>
                    <p className="text-slate-400 mt-1">
                      Período: {formatWeekRange(personalSubTab === 'current' ? personalCurrentWeek : selectedPersonalWeek)} (Seg 00:00 – Dom 23:59)
                    </p>
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

                {filteredMatches.length === 0 ? (
                  <div className="bg-[#1f2326] rounded-xl p-8 border border-slate-800 text-center text-slate-400">
                    Nenhuma partida registrada nesta semana.
                  </div>
                ) : (
                  <>
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
                        Kills vs Mortes
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
              </>
            )}
          </>
        )}

        {/* ABA 2: LEADERBOARD SEMANAL */}
        {activeTab === 'global' && (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-white tracking-wide uppercase flex items-center gap-3">
                  <Users className="text-[#ff4655]" /> Placar de Líderes Semanal
                </h1>
                <p className="text-slate-400 mt-1">
                  Período: {formatWeekRange(leaderboard.week_start)} (Seg 00:00 – Dom 23:59) • Clique em um jogador para ver seu perfil.
                </p>
              </div>
            </div>

            {/* Sub-abas do Leaderboard: Semana Atual vs Semanas Anteriores */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleGlobalSubTabChange('current')}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${
                    globalSubTab === 'current'
                      ? 'bg-[#ff4655] text-white'
                      : 'bg-[#1f2326] text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  Semana Atual ({formatWeekRange(leaderboard.current_week)})
                </button>
                <button
                  onClick={() => handleGlobalSubTabChange('past')}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${
                    globalSubTab === 'past'
                      ? 'bg-[#ff4655] text-white'
                      : 'bg-[#1f2326] text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  <History className="w-4 h-4" />
                  Semanas Anteriores
                </button>
              </div>

              {globalSubTab === 'past' && globalPastWeeks.length > 0 && (
                <select
                  value={selectedGlobalWeek}
                  onChange={(e) => {
                    setSelectedGlobalWeek(e.target.value);
                    fetchGlobalWeek(e.target.value);
                  }}
                  className="bg-[#1f2326] border border-slate-700 rounded-lg px-3 py-2 text-sm font-semibold text-white outline-none cursor-pointer"
                >
                  {globalPastWeeks.map((w, idx) => (
                    <option key={w} value={w}>
                      {idx === 0 ? `Semana Recém-Encerrada (${formatWeekRange(w)})` : `Semana de ${formatWeekRange(w)}`}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {globalSubTab === 'past' && globalPastWeeks.length === 0 ? (
              <div className="bg-[#1f2326] rounded-xl p-8 border border-slate-800 text-center text-slate-400">
                Nenhuma semana anterior registrada ainda.
              </div>
            ) : !leaderboard.highlights ? (
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
                        <p className="text-purple-400 text-xs font-bold uppercase tracking-wider">Quem gosta de uma cabeça</p>
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