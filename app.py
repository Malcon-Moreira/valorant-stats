import os
from flask import Flask, jsonify, request
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from models import *
from flask_cors import CORS
import json, time

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

    raw_matches = fetch_latest_matches(user['nick'], user['tag'])
    if raw_matches:
        df_new = process_matches(raw_matches, user['nick'], user['tag'], user['id_player'])
        update_database(df_new)

    partidas = get_historico_partidas(user['id_player'])
    profile = get_player_profile(user['id_player'])
    return jsonify({"profile": profile, "matches": partidas})

@app.route('/api/player/<int:id_player>', methods=['GET'])
@jwt_required()
def ver_perfil_jogador(id_player):
    profile = get_player_profile(id_player)
    if not profile:
        return jsonify({"msg": "Jogador não encontrado"}), 404
    partidas = get_historico_partidas(id_player)
    return jsonify({"profile": profile, "matches": partidas})

@app.route('/api/leaderboard', methods=['GET'])
@jwt_required()
def listar_leaderboard():
    ranking = get_leaderboard()
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
        tag = jogador['tag'].strip().lstrip('#')  # Remove '#' caso alguém tenha cadastrado com ele

        try:
            raw_matches = fetch_latest_matches(nick, tag)
            if not raw_matches:
                relatorio.append({
                    "jogador": f"{nick}#{tag}",
                    "status": "ignorado",
                    "motivo": "API não retornou partidas (verifique nick/tag, região ou se jogou competitivo)"
                })
            else:
                df_new = process_matches(raw_matches, nick, tag, jogador['id_player'])
                update_database(df_new)
                sucessos += 1
                relatorio.append({
                    "jogador": f"{nick}#{tag}",
                    "status": "atualizado",
                    "partidas_7_dias": len(df_new)
                })
        except Exception as e:
            print(f"Erro ao atualizar {nick}#{tag}: {e}")
            relatorio.append({
                "jogador": f"{nick}#{tag}",
                "status": "erro",
                "motivo": str(e)
            })

        time.sleep(1.5)  # Evita erro 429 (Too Many Requests) na API do HenrikDev

    return jsonify({
        "status": "sucesso",
        "msg": f"Rotina finalizada. {sucessos} de {len(jogadores)} jogadores atualizados.",
        "detalhes": relatorio
    }), 200

if __name__ == '__main__':
    app.run(debug=True, port=5000)
