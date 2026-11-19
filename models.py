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


def get_historico_partidas(id_player):
    """Busca as partidas de um jogador específico."""
    try:
        query = f"SELECT * FROM stats WHERE id_player = {id_player} ORDER BY date DESC"
        df = pd.read_sql(query, engine)
        if df.empty:
            return []
        df['date'] = df['date'].astype(str)
        return df.to_dict(orient='records')
    except Exception as e:
        print(f"Erro ao ler banco: {e}")
        return []


def fetch_latest_matches(nick, tag):
    # urllib.parse evita que nicks com espaço quebrem a requisição
    nick_seguro = urllib.parse.quote(nick.strip())
    tag_segura = urllib.parse.quote(tag.strip())

    # size=100 traz o histórico máximo permitido pela API de uma só vez
    url = f"https://api.henrikdev.xyz/valorant/v3/matches/na/{nick_seguro}/{tag_segura}?mode=competitive&size=100"

    headers = {"Authorization": api_key}
    response = requests.get(url, headers=headers)
    if response.status_code == 200:
        print("Teste da API", response.json()['data'])
        return response.json()['data']
    return []


def process_matches(matches_data, nick, tag, id_player):
    my_stats = []

    agora = datetime.now()
    limite_7_dias = agora - timedelta(days=7)

    for match in matches_data:
        if match.get('metadata') is None or match.get('players') is None:
            continue

        match_start = datetime.fromtimestamp(match['metadata']['game_start'])

        # Se a partida for mais antiga que 7 dias atrás, descarta
        if match_start < limite_7_dias:
            continue

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
    if new_df.empty: return
    new_df['headshot_percent'] = new_df['headshot_percent'].round(2)
    id_player = int(new_df['id_player'].iloc[0])

    try:
        query = f"SELECT match_id FROM stats WHERE id_player = {id_player}"
        ids_existentes = pd.read_sql(query, engine)['match_id'].tolist()
        df_para_salvar = new_df[~new_df['match_id'].isin(ids_existentes)]
    except Exception:
        df_para_salvar = new_df

    if df_para_salvar.empty: return

    colunas_db = ['id_player', 'date', 'week', 'agent', 'kills', 'deaths', 'score', 'headshot_percent', 'class', 'match_id', 'result', 'map']
    df_final = df_para_salvar[colunas_db].copy()
    try:
        df_final.to_sql('stats', engine, if_exists='append', index=False)
    except Exception as e:
        print(f"Erro ao salvar: {e}")
        raise e

def get_leaderboard():
    try:
        query = """
            SELECT p.nick, p.player_tag,
                   COUNT(s.match_id) as partidas,
                   SUM(s.kills) as total_kills,
                   AVG(s.kills) as media_kills,
                   SUM(s.deaths) as total_deaths,
                   AVG(s.score) as score_medio,
                   AVG(s.headshot_percent) as hs_medio,
                   SUM(CASE WHEN s.result = 'Vitória' THEN 1 ELSE 0 END) as vitorias
            FROM player p
            JOIN stats s ON p.id_player = s.id_player
            WHERE CAST(s.date AS TIMESTAMP) >= CURRENT_DATE - INTERVAL '7 days'
            GROUP BY p.id_player, p.nick, p.player_tag
        """
        df = pd.read_sql(query, engine)
        if df.empty:
            return {"highlights": None, "ranking": []}

        df['kd'] = df.apply(
            lambda r: round(r['total_kills'] / r['total_deaths'], 2) if r['total_deaths'] > 0 else float(r['total_kills']),
            axis=1
        )
        df['media_kills'] = df['media_kills'].round(1)
        df['score_medio'] = df['score_medio'].round(0).astype(int)
        df['hs_medio'] = df['hs_medio'].round(1)
        df['win_rate'] = ((df['vitorias'] / df['partidas']) * 100).round(1)

        # Fórmula de Rating (balanço de todas as estatísticas para MVP e Pior da Semana)
        df['rating'] = (
            (df['kd'] * 30) +
            (df['score_medio'] * 0.25) +
            (df['win_rate'] * 0.20) +
            (df['hs_medio'] * 0.5) +
            (df['media_kills'] * 1.0)
        ).round(1)

        # Ordena do maior para o menor Rating
        df = df.sort_values(by='rating', ascending=False)

        # Extrai os 6 destaques da semana
        highlights = {
            "mvp": df.loc[df['rating'].idxmax()].to_dict(),
            "worst": df.loc[df['rating'].idxmin()].to_dict(),
            "top_kills": df.loc[df['media_kills'].idxmax()].to_dict(),
            "most_deaths": df.loc[df['total_deaths'].idxmax()].to_dict(),
            "top_hs": df.loc[df['hs_medio'].idxmax()].to_dict(),
            "most_wins": df.loc[df['vitorias'].idxmax()].to_dict(),
        }

        return {
            "highlights": highlights,
            "ranking": df.to_dict(orient='records')
        }
    except Exception as e:
        print(f"Erro ao gerar leaderboard: {e}")
        return {"highlights": None, "ranking": []}