import requests
import pandas as pd
import os
import bcrypt
from datetime import datetime, timedelta
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
import urllib.parse

load_dotenv()

api_key = os.getenv('API_KEY')
DATABASE_URL = os.getenv('DATABASE')
engine = create_engine(DATABASE_URL)

AGENT_CLASSES = {
    'Jett': 'Duelist', 'Reyna': 'Duelist', 'Raze': 'Duelist', 'Phoenix': 'Duelist', 'Yoru': 'Duelist',
    'Neon': 'Duelist', 'Iso': 'Duelist',
    'Sova': 'Initiator', 'Breach': 'Initiator', 'Skye': 'Initiator', 'KAY/O': 'Initiator', 'Fade': 'Initiator',
    'Gekko': 'Initiator', 'Tejo': 'Initiator',
    'Omen': 'Controller', 'Brimstone': 'Controller', 'Viper': 'Controller', 'Astra': 'Controller',
    'Harbor': 'Controller', 'Clove': 'Controller',
    'Sage': 'Sentinel', 'Cypher': 'Sentinel', 'Killjoy': 'Sentinel', 'Chamber': 'Sentinel', 'Deadlock': 'Sentinel',
    'Vyse': 'Sentinel'
}


def get_current_week_start():
    """Retorna a data da segunda-feira da semana atual (Horário de Brasília UTC-3) no formato YYYY-MM-DD."""
    agora_br = datetime.utcnow() - timedelta(hours=3)
    segunda = agora_br - timedelta(days=agora_br.weekday())
    return segunda.strftime('%Y-%m-%d')


def get_available_weeks(id_player=None):
    """Retorna todas as segundas-feiras (YYYY-MM-DD) que possuem partidas registradas, da mais recente para a mais antiga."""
    try:
        if id_player:
            query = text("""
                SELECT DISTINCT TO_CHAR(DATE_TRUNC('week', CAST(date AS TIMESTAMP)), 'YYYY-MM-DD') as week_start
                FROM stats
                WHERE id_player = :id
                ORDER BY week_start DESC
            """)
            params = {"id": id_player}
        else:
            query = text("""
                SELECT DISTINCT TO_CHAR(DATE_TRUNC('week', CAST(date AS TIMESTAMP)), 'YYYY-MM-DD') as week_start
                FROM stats
                ORDER BY week_start DESC
            """)
            params = {}

        with engine.connect() as conn:
            rows = conn.execute(query, params).fetchall()
            return [row[0] for row in rows if row[0]]
    except Exception as e:
        print(f"Erro ao buscar semanas disponíveis: {e}")
        return []


def registrar_jogador(nick, tag, email, senha):
    hash_senha = bcrypt.hashpw(senha.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    try:
        with engine.connect() as conn:
            query = text("INSERT INTO player (nick, player_tag, email, password) VALUES (:n, :t, :e, :p)")
            conn.execute(query, {"n": nick, "t": tag, "e": email, "p": hash_senha})
            conn.commit()
        return True
    except Exception as e:
        print(f"Erro ao registrar: {e}")
        return False


def verificar_login(email, senha_tentativa):
    try:
        with engine.connect() as conn:
            query = text("SELECT id_player, nick, player_tag, password FROM player WHERE email = :e")
            result = conn.execute(query, {"e": email}).fetchone()

            if result and bcrypt.checkpw(senha_tentativa.encode('utf-8'), result[3].encode('utf-8')):
                return {"id_player": result[0], "nick": result[1], "tag": result[2]}
    except Exception as e:
        print(f"Erro no login: {e}")
    return None


def get_historico_partidas(id_player, week_start=None):
    """Busca as partidas de um jogador dentro de uma semana fixa (Segunda 00:00 a Domingo 23:59)."""
    ws = week_start or get_current_week_start()
    try:
        query = text("""
            SELECT * FROM stats
            WHERE id_player = :id
              AND CAST(date AS TIMESTAMP) >= CAST(:ws AS TIMESTAMP)
              AND CAST(date AS TIMESTAMP) < CAST(:ws AS TIMESTAMP) + INTERVAL '7 days'
            ORDER BY date DESC
        """)
        df = pd.read_sql(query, engine, params={"id": id_player, "ws": ws})
        if df.empty:
            return []
        df['date'] = df['date'].astype(str)
        return df.to_dict(orient='records')
    except Exception as e:
        print(f"Erro ao ler banco: {e}")
        return []


def fetch_latest_matches(nick, tag):
    nick_seguro = urllib.parse.quote(nick.strip())
    tag_segura = urllib.parse.quote(tag.strip().lstrip('#'))
    url = f"https://api.henrikdev.xyz/valorant/v3/matches/na/{nick_seguro}/{tag_segura}?mode=competitive&size=100"

    headers = {"Authorization": api_key}
    response = requests.get(url, headers=headers)
    if response.status_code == 200:
        return response.json()['data']
    return []


def update_player_profile(id_player, nick, tag, card_url=None):
    """Atualiza card, elo e RR do jogador na tabela player."""
    nick_seguro = urllib.parse.quote(nick.strip())
    tag_segura = urllib.parse.quote(tag.strip().lstrip('#'))
    headers = {"Authorization": api_key}

    elo, rr = None, None
    try:
        mmr_url = f"https://api.henrikdev.xyz/valorant/v1/mmr/na/{nick_seguro}/{tag_segura}"
        res = requests.get(mmr_url, headers=headers)
        if res.status_code == 200:
            data = res.json().get('data', {})
            elo = data.get('currenttierpatched')
            rr = data.get('ranking_in_tier', 0)
    except Exception as e:
        print(f"Erro ao buscar MMR de {nick}#{tag}: {e}")

    try:
        with engine.connect() as conn:
            query = text("""
                UPDATE player
                SET card_url = COALESCE(:card, card_url),
                    elo = COALESCE(:elo, elo),
                    rr = COALESCE(:rr, rr)
                WHERE id_player = :id
            """)
            conn.execute(query, {"card": card_url, "elo": elo, "rr": rr, "id": id_player})
            conn.commit()
    except Exception as e:
        print(f"Erro ao atualizar perfil no banco: {e}")


def get_player_profile(id_player):
    """Retorna nick, tag, card, elo e RR de um jogador."""
    try:
        with engine.connect() as conn:
            query = text("SELECT id_player, nick, player_tag, card_url, elo, rr FROM player WHERE id_player = :id")
            row = conn.execute(query, {"id": id_player}).fetchone()
            if row:
                return {
                    "id_player": row[0],
                    "nick": row[1],
                    "tag": row[2],
                    "card_url": row[3],
                    "elo": row[4] or "Unranked",
                    "rr": row[5] or 0
                }
    except Exception as e:
        print(f"Erro ao buscar perfil: {e}")
    return None


def process_matches(matches_data, nick, tag, id_player):
    my_stats = []

    for match in matches_data:
        if match.get('metadata') is None or match.get('players') is None:
            continue

        # Converte o timestamp da partida para horário de Brasília (UTC-3)
        match_start = datetime.utcfromtimestamp(match['metadata']['game_start']) - timedelta(hours=3)

        my_player = next((p for p in match['players']['all_players'] if
                          p['name'].lower().strip() == nick.lower().strip() and p[
                              'tag'].lower().strip() == tag.lower().strip()), None)

        if my_player:
            agent = my_player['character']
            headshots = my_player['stats']['headshots']
            bodyshots = my_player['stats']['bodyshots']
            legshots = my_player['stats']['legshots']
            total_shots = headshots + bodyshots + legshots

            equipa = my_player['team'].lower()
            venceu = match['teams'][equipa]['has_won']
            rondas_red = match['teams']['red']['rounds_won']
            rondas_blue = match['teams']['blue']['rounds_won']

            if venceu:
                resultado = 'Vitória'
            elif rondas_red == rondas_blue:
                resultado = 'Empate'
            else:
                resultado = 'Derrota'

            mapa = match['metadata']['map']

            stats = {
                'id_player': id_player,
                'match_id': match['metadata']['matchid'],
                'date': match_start.strftime('%Y-%m-%d %H:%M:%S'),
                'week': match_start.isocalendar()[1],
                'agent': agent,
                'class': AGENT_CLASSES.get(agent, 'Unknown'),
                'kills': my_player['stats']['kills'],
                'deaths': my_player['stats']['deaths'],
                'score': my_player['stats']['score'],
                'headshot_percent': (headshots / total_shots * 100) if total_shots > 0 else 0,
                'result': resultado,
                'map': mapa
            }
            my_stats.append(stats)

    card_url = None
    for match in matches_data:
        if match.get('players'):
            p = next((x for x in match['players']['all_players']
                      if x['name'].lower().strip() == nick.lower().strip()
                      and x['tag'].lower().strip() == tag.lower().strip()), None)
            if p and p.get('assets', {}).get('card', {}).get('wide'):
                card_url = p['assets']['card']['wide']
                break

    update_player_profile(id_player, nick, tag, card_url)

    return pd.DataFrame(my_stats)


def get_all_players():
    try:
        with engine.connect() as conn:
            query = text("SELECT id_player, nick, player_tag FROM player")
            result = conn.execute(query).fetchall()
            return [{"id_player": row[0], "nick": row[1], "tag": row[2]} for row in result]
    except Exception as e:
        print(f"Erro ao buscar jogadores para o Cron: {e}")
        return []


def update_database(new_df):
    if new_df.empty:
        return
    new_df['headshot_percent'] = new_df['headshot_percent'].round(2)
    id_player = int(new_df['id_player'].iloc[0])

    try:
        query = f"SELECT match_id FROM stats WHERE id_player = {id_player}"
        ids_existentes = pd.read_sql(query, engine)['match_id'].tolist()
        df_para_salvar = new_df[~new_df['match_id'].isin(ids_existentes)]
    except Exception:
        df_para_salvar = new_df

    if df_para_salvar.empty:
        return

    colunas_db = ['id_player', 'date', 'week', 'agent', 'kills', 'deaths', 'score', 'headshot_percent', 'class', 'match_id', 'result', 'map']
    df_final = df_para_salvar[colunas_db].copy()
    try:
        df_final.to_sql('stats', engine, if_exists='append', index=False)
    except Exception as e:
        print(f"Erro ao salvar: {e}")
        raise e


def get_leaderboard(week_start=None):
    ws = week_start or get_current_week_start()
    available_weeks = get_available_weeks()
    current_week = get_current_week_start()

    try:
        query = text("""
            SELECT p.id_player, p.nick, p.player_tag,
                   COUNT(s.match_id) as partidas,
                   SUM(s.kills) as total_kills,
                   AVG(s.kills) as media_kills,
                   SUM(s.deaths) as total_deaths,
                   AVG(s.score) as score_medio,
                   AVG(s.headshot_percent) as hs_medio,
                   SUM(CASE WHEN s.result = 'Vitória' THEN 1 ELSE 0 END) as vitorias
            FROM player p
            JOIN stats s ON p.id_player = s.id_player
            WHERE CAST(s.date AS TIMESTAMP) >= CAST(:ws AS TIMESTAMP)
              AND CAST(s.date AS TIMESTAMP) < CAST(:ws AS TIMESTAMP) + INTERVAL '7 days'
            GROUP BY p.id_player, p.nick, p.player_tag
        """)
        df = pd.read_sql(query, engine, params={"ws": ws})
        if df.empty:
            return {
                "week_start": ws,
                "current_week": current_week,
                "available_weeks": available_weeks,
                "highlights": None,
                "best_by_class": {},
                "ranking": []
            }

        df['kd'] = df.apply(
            lambda r: round(r['total_kills'] / r['total_deaths'], 2) if r['total_deaths'] > 0 else float(r['total_kills']),
            axis=1
        )
        df['media_kills'] = df['media_kills'].round(1)
        df['score_medio'] = df['score_medio'].round(0).astype(int)
        df['hs_medio'] = df['hs_medio'].round(1)
        df['win_rate'] = ((df['vitorias'] / df['partidas']) * 100).round(1)

        df['rating'] = (
            (df['kd'] * 45) +
            (df['score_medio'] * 0.015) +
            (df['partidas'] * 1.5) +
            (df['hs_medio'] * 0.2) +
            (df['media_kills'] * 0.8)
        ).round(1)

        df = df.sort_values(by='rating', ascending=False)

        highlights = {
            "mvp": df.loc[df['rating'].idxmax()].to_dict(),
            "worst": df.loc[df['rating'].idxmin()].to_dict(),
            "top_kills": df.loc[df['media_kills'].idxmax()].to_dict(),
            "most_deaths": df.loc[df['total_deaths'].idxmax()].to_dict(),
            "top_hs": df.loc[df['hs_medio'].idxmax()].to_dict(),
            "most_wins": df.loc[df['vitorias'].idxmax()].to_dict(),
        }

        class_query = text("""
            SELECT p.id_player, p.nick, p.player_tag, s.class,
                   COUNT(s.match_id) as partidas,
                   SUM(s.kills) as total_kills,
                   AVG(s.kills) as media_kills,
                   SUM(s.deaths) as total_deaths,
                   AVG(s.score) as score_medio,
                   AVG(s.headshot_percent) as hs_medio,
                   SUM(CASE WHEN s.result = 'Vitória' THEN 1 ELSE 0 END) as vitorias
            FROM player p
            JOIN stats s ON p.id_player = s.id_player
            WHERE CAST(s.date AS TIMESTAMP) >= CAST(:ws AS TIMESTAMP)
              AND CAST(s.date AS TIMESTAMP) < CAST(:ws AS TIMESTAMP) + INTERVAL '7 days'
              AND s.class IN ('Duelist', 'Initiator', 'Controller', 'Sentinel')
            GROUP BY p.id_player, p.nick, p.player_tag, s.class
        """)
        df_class = pd.read_sql(class_query, engine, params={"ws": ws})
        best_by_class = {}

        if not df_class.empty:
            df_class['kd'] = df_class.apply(
                lambda r: round(r['total_kills'] / r['total_deaths'], 2) if r['total_deaths'] > 0 else float(r['total_kills']),
                axis=1
            )
            df_class['media_kills'] = df_class['media_kills'].round(1)
            df_class['win_rate'] = ((df_class['vitorias'] / df_class['partidas']) * 100).round(1)

            df_class['rating'] = (
                (df_class['kd'] * 45) +
                (df_class['score_medio'] * 0.015) +
                (df_class['partidas'] * 1.5) +
                (df_class['hs_medio'] * 0.2) +
                (df_class['media_kills'] * 0.8)
            ).round(1)

            for role in ['Duelist', 'Initiator', 'Controller', 'Sentinel']:
                sub = df_class[df_class['class'] == role]
                if not sub.empty:
                    best_by_class[role] = sub.loc[sub['rating'].idxmax()].to_dict()

        return {
            "week_start": ws,
            "current_week": current_week,
            "available_weeks": available_weeks,
            "highlights": highlights,
            "best_by_class": best_by_class,
            "ranking": df.to_dict(orient='records')
        }
    except Exception as e:
        print(f"Erro ao gerar leaderboard: {e}")
        return {
            "week_start": ws,
            "current_week": current_week,
            "available_weeks": available_weeks,
            "highlights": None,
            "best_by_class": {},
            "ranking": []
        }