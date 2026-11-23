import os
from flask import Flask, jsonify, request
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from models import *
from flask_cors import CORS
import json, time
import requests
from datetime import datetime, timedelta

app = Flask(__name__)
app.config["JWT_SECRET_KEY"] = os.getenv('CHAVE_API')
jwt = JWTManager(app)
CORS(app)


@app.route("/register", methods=["POST"])
def register():
    data = request.json
    sucesso = registrar_jogador(data['nick'], data['tag'], data['email'], data['password'])
    if sucesso:
        return jsonify({"msg": "Usuário criado com sucesso!"}), 201
    return jsonify({"msg": "Erro ao criar usuário ou email já existe."}), 400


@app.route("/login", methods=["POST"])
def login():
    email = request.json.get("email", None)
    password = request.json.get("password", None)

    user = verificar_login(email, password)
    if not user:
        return jsonify({"msg": "Email ou senha incorretos"}), 401

    user_string = json.dumps(user)
    access_token = create_access_token(identity=user_string)

    return jsonify(access_token=access_token)


@app.route('/api/matches', methods=['GET'])
@jwt_required()
def listar_partidas():
    user_string = get_jwt_identity()
    user = json.loads(user_string)

    week = request.args.get('week')
    current_week = get_current_week_start()

    # Só busca na API externa se estiver carregando a semana atual
    if not week or week == current_week:
        raw_matches = fetch_latest_matches(user['nick'], user['tag'])
        if raw_matches:
            df_new = process_matches(raw_matches, user['nick'], user['tag'], user['id_player'])
            update_database(df_new)

    partidas = get_historico_partidas(user['id_player'], week)
    profile = get_player_profile(user['id_player'])
    available_weeks = get_available_weeks(user['id_player'])

    return jsonify({
        "profile": profile,
        "matches": partidas,
        "week_start": week or current_week,
        "current_week": current_week,
        "available_weeks": available_weeks
    })


@app.route('/api/player/<int:id_player>', methods=['GET'])
@jwt_required()
def ver_perfil_jogador(id_player):
    profile = get_player_profile(id_player)
    if not profile:
        return jsonify({"msg": "Jogador não encontrado"}), 404

    week = request.args.get('week')
    current_week = get_current_week_start()
    partidas = get_historico_partidas(id_player, week)
    available_weeks = get_available_weeks(id_player)

    return jsonify({
        "profile": profile,
        "matches": partidas,
        "week_start": week or current_week,
        "current_week": current_week,
        "available_weeks": available_weeks
    })


@app.route('/api/leaderboard', methods=['GET'])
@jwt_required()
def listar_leaderboard():
    week = request.args.get('week')
    ranking = get_leaderboard(week)
    return jsonify(ranking)


@app.route('/api/cron/update-all', methods=['GET', 'POST'])
def cron_update_all():
    cron_token = request.headers.get('Authorization')
    senha_cron = os.getenv('CRON_SECRET')

    if not senha_cron or cron_token != f"Bearer {senha_cron}":
        return jsonify({"erro": "Acesso negado. Token de Cron inválido."}), 401

    jogadores = get_all_players()
    sucessos = 0
    relatorio = []

    for jogador in jogadores:
        nick = jogador['nick'].strip()
        tag = jogador['tag'].strip().lstrip('#')

        try:
            raw_matches = fetch_latest_matches(nick, tag)
            if not raw_matches:
                relatorio.append({
                    "jogador": f"{nick}#{tag}",
                    "status": "ignorado",
                    "motivo": "API não retornou partidas"
                })
            else:
                df_new = process_matches(raw_matches, nick, tag, jogador['id_player'])
                update_database(df_new)
                sucessos += 1
                relatorio.append({
                    "jogador": f"{nick}#{tag}",
                    "status": "atualizado",
                    "partidas_encontradas": len(df_new)
                })
        except Exception as e:
            print(f"Erro ao atualizar {nick}#{tag}: {e}")
            relatorio.append({
                "jogador": f"{nick}#{tag}",
                "status": "erro",
                "motivo": str(e)
            })

        time.sleep(1.5)

    return jsonify({
        "status": "sucesso",
        "msg": f"Rotina finalizada. {sucessos} de {len(jogadores)} jogadores atualizados.",
        "detalhes": relatorio
    }), 200

@app.route('/api/cron/weekly-report', methods=['GET', 'POST'])
def cron_weekly_report():
    cron_token = request.headers.get('Authorization')
    senha_cron = os.getenv('CRON_SECRET')

    if not senha_cron or cron_token != f"Bearer {senha_cron}":
        return jsonify({"erro": "Acesso negado. Token de Cron inválido."}), 401

    # Calcula a segunda-feira da semana que acabou de encerrar
    segunda_atual = datetime.strptime(get_current_week_start(), '%Y-%m-%d')
    segunda_passada_dt = segunda_atual - timedelta(days=7)
    domingo_passado_dt = segunda_atual - timedelta(days=1)

    semana_passada_str = segunda_passada_dt.strftime('%Y-%m-%d')
    periodo_fmt = f"{segunda_passada_dt.strftime('%d/%m')} a {domingo_passado_dt.strftime('%d/%m')}"

    dados = get_leaderboard(semana_passada_str)

    if not dados.get('highlights') or not dados.get('ranking'):
        return jsonify({
            "status": "ignorado",
            "msg": f"Nenhuma partida registrada na semana {periodo_fmt}."
        }), 200

    hl = dados['highlights']
    best_class = dados.get('best_by_class', {})
    ranking = dados['ranking']

    # Monta a legenda formatada para o WhatsApp
    linhas = [
        f"🏆 *RESUMO SEMANAL - VALOSTATS*",
        f"📅 Período: {periodo_fmt}\n",
        f"👑 *MVP da Semana:* {hl['mvp']['nick']}#{hl['mvp']['player_tag']} (Rating: {hl['mvp']['rating']} | K/D: {hl['mvp']['kd']})",
        f"👎 *Lixoso da Semana:* {hl['worst']['nick']}#{hl['worst']['player_tag']} (Rating: {hl['worst']['rating']} | K/D: {hl['worst']['kd']})",
        f"🔫 *Maior Média de Kills:* {hl['top_kills']['nick']} ({hl['top_kills']['media_kills']} kills/jogo)",
        f"🎯 *Maior HS%:* {hl['top_hs']['nick']} ({hl['top_hs']['hs_medio']}%)",
        f"💀 *Quem Mais Morreu:* {hl['most_deaths']['nick']} ({hl['most_deaths']['total_deaths']} mortes)",
        f"🥇 *Quem Mais Venceu:* {hl['most_wins']['nick']} ({hl['most_wins']['vitorias']} vitórias)\n"
    ]

    if best_class:
        linhas.append("🎭 *Melhores por Classe:*")
        for role in ['Duelist', 'Initiator', 'Controller', 'Sentinel']:
            if role in best_class:
                p = best_class[role]
                linhas.append(f"• *{role}:* {p['nick']} (Rating: {p['rating']})")
        linhas.append("")

    linhas.append("📊 *Classificação Geral:*")
    for idx, p in enumerate(ranking, start=1):
        linhas.append(f"{idx}º *{p['nick']}* — {p['rating']} pts (K/D: {p['kd']} | {p['partidas']} jogos)")

    mensagem = "\n".join(linhas)

    # Gera a imagem do placar em memória
    img_buffer = gerar_imagem_leaderboard(dados, periodo_fmt)

    # Disparo da imagem + legenda para a Green-API
    media_url = os.getenv('GREEN_API_MEDIA_URL') or os.getenv('GREEN_API_URL')
    id_instance = os.getenv('GREEN_API_ID')
    api_token = os.getenv('GREEN_API_TOKEN')
    group_id = os.getenv('WHATSAPP_GROUP_ID')

    if not all([media_url, id_instance, api_token, group_id]):
        return jsonify({"erro": "Variáveis da Green-API não configuradas no Render."}), 500

    url_envio = f"{media_url}/waInstance{id_instance}/sendFileByUpload/{api_token}"
    data_payload = {
        "chatId": group_id,
        "caption": mensagem
    }
    files_payload = {
        "file": ("placar_semanal.png", img_buffer, "image/png")
    }

    try:
        res = requests.post(url_envio, data=data_payload, files=files_payload, timeout=20)
        if res.status_code == 200:
            return jsonify({"status": "sucesso", "msg": "Imagem e resumo enviados no WhatsApp!", "green_api": res.json()}), 200
        return jsonify({"status": "erro", "detalhe": res.text}), res.status_code
    except Exception as e:
        return jsonify({"status": "erro", "motivo": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)