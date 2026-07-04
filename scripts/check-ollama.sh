#!/usr/bin/env bash
# Diagnóstico y reparación de Ollama para desarrollo en casa
# Usa solo la API HTTP — no requiere el comando `ollama` en PATH
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

CHAT_MODEL="qwen2.5:3b-instruct"
EMBED_MODEL="bge-m3"
OLLAMA_URL="http://127.0.0.1:11434"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi
CHAT_MODEL="${CHAT_MODEL:-qwen2.5:3b-instruct}"
EMBED_MODEL="${EMBEDDING_MODEL:-bge-m3}"
OLLAMA_URL="${OLLAMA_BASE_URL:-http://127.0.0.1:11434}"

echo "=== Diagnóstico Ollama ==="
echo "URL:    $OLLAMA_URL"
echo "Chat:   $CHAT_MODEL"
echo "Embed:  $EMBED_MODEL"
echo ""

export OLLAMA_URL CHAT_MODEL EMBED_MODEL
python3 << 'PYEOF'
import json
import os
import sys
import urllib.error
import urllib.request

OLLAMA_URL = os.environ["OLLAMA_URL"].rstrip("/")
CHAT_MODEL = os.environ["CHAT_MODEL"]
EMBED_MODEL = os.environ["EMBED_MODEL"]


def api(method, path, body=None, timeout=30):
    url = f"{OLLAMA_URL}{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        url, data=data, method=method,
        headers={"Content-Type": "application/json"} if data else {},
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read().decode()
        if not raw.strip():
            return {}
        # /api/pull devuelve NDJSON en stream — tomar última línea con status
        if "\n" in raw and path == "/api/pull":
            lines = [l for l in raw.strip().split("\n") if l.strip()]
            return json.loads(lines[-1])
        return json.loads(raw)


def has_model(installed, wanted):
    base = wanted.split(":")[0]
    for name in installed:
        if name == wanted or name.split(":")[0] == base:
            return True
    return False


def pull_model(name):
    print(f"⬇ Descargando {name} (puede tardar varios minutos)...")
    url = f"{OLLAMA_URL}/api/pull"
    body = json.dumps({"name": name}).encode()
    req = urllib.request.Request(url, data=body, method="POST", headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=600) as resp:
        for line in resp:
            try:
                chunk = json.loads(line.decode())
                status = chunk.get("status", "")
                if "pulling" in status or "downloading" in status:
                    pct = chunk.get("completed", 0)
                    total = chunk.get("total", 0)
                    if total:
                        print(f"  {status} {pct * 100 // total}%", end="\r")
                    else:
                        print(f"  {status}", end="\r")
            except json.JSONDecodeError:
                pass
    print(f"\n✓ {name} descargado")


# 1. Ping
try:
    tags = api("GET", "/api/tags")
except (urllib.error.URLError, TimeoutError, ConnectionResetError) as e:
    print(f"❌ Ollama no responde en {OLLAMA_URL}")
    print(f"   ({e})")
    print()
    print("Solución: abre la app Ollama (icono en la barra de menú de macOS)")
    sys.exit(1)

print("✓ Ollama responde")

installed = [m["name"] for m in tags.get("models", [])]
print("\nModelos instalados:")
for n in installed:
    print(f"  - {n}")

# 2. Descargar faltantes (vía API, sin CLI)
if not has_model(installed, CHAT_MODEL):
    print()
    pull_model(CHAT_MODEL)
    installed.append(CHAT_MODEL)

if not has_model(installed, EMBED_MODEL):
    print()
    pull_model(EMBED_MODEL)

# 3. Probar chat
print(f"\nProbando chat con {CHAT_MODEL} ...")
try:
    result = api("POST", "/api/chat", {
        "model": CHAT_MODEL,
        "messages": [{"role": "user", "content": "di hola en una palabra"}],
        "stream": False,
        "options": {"num_ctx": 2048, "num_predict": 20},
    }, timeout=120)
except urllib.error.HTTPError as e:
    err_body = e.read().decode()
    print("❌ Chat falló:")
    try:
        print(json.dumps(json.loads(err_body), indent=2, ensure_ascii=False))
    except json.JSONDecodeError:
        print(err_body)
    print()
    if any(k in err_body.lower() for k in ("metal", "segmentation", "runner", "500")):
        print("── Posibles soluciones (MacBook Air) ──")
        print()
        print("A) Actualiza Ollama desde https://ollama.com")
        print("B) Prueba modelo más ligero en tu .env:")
        print("     CHAT_MODEL=llama3.2:3b")
        print("   Luego ejecuta de nuevo: ./scripts/check-ollama.sh")
        print("C) Reduce RAM en tu .env:")
        print("     OLLAMA_NUM_CTX=2048")
        print("     OLLAMA_NUM_PREDICT=700")
    sys.exit(1)

if result.get("message", {}).get("content"):
    print("✓ Chat funciona")
    print(f"  Respuesta: {result['message']['content'][:80]}")
    print()
    print("Todo listo. Reinicia la API si estaba corriendo y prueba el chat en la web.")
    sys.exit(0)

error = result.get("error", str(result))
print(f"❌ Chat falló: {error}")
sys.exit(1)
PYEOF
