import os
from flask import Flask, jsonify, request
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from models import *
from flask_cors import CORS
import json

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
    return jsonify(partidas)


@app.route('/test-riot', methods=['GET'])
def test_riot():
    import requests
    # Vamos verificar se o Render está a ler as chaves corretamente
    chave = os.getenv('API_KEY')
    regiao = os.getenv('REGION', 'br')

    # URL forçada com o seu nick (já com %20 no espaço para evitar erros)
    url = f"https://api.henrikdev.xyz/valorant/v3/matches/{regiao}/Vivano%20Steak/zandn?size=1"
    headers = {"Authorization": chave} if chave else {}

    try:
        resp = requests.get(url, headers=headers)
        return jsonify({
            "1_status_code": resp.status_code,
            "2_api_key_configurada_no_render": bool(chave),
            "3_regiao_lida_pelo_render": regiao,
            "4_resposta_da_riot": resp.json() if resp.status_code == 200 else resp.text
        })
    except Exception as e:
        return jsonify({"erro": str(e)})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
