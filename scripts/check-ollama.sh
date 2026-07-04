#!/usr/bin/env bash
# Diagnóstico y reparación de Ollama para desarrollo en casa
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Cargar modelos desde .env si existe
CHAT_MODEL="${CHAT_MODEL:-qwen2.5:3b-instruct}"
EMBED_MODEL="${EMBEDDING_MODEL:-bge-m3}"
OLLAMA_URL="${OLLAMA_BASE_URL:-http://127.0.0.1:11434}"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
  CHAT_MODEL="${CHAT_MODEL:-qwen2.5:3b-instruct}"
  EMBED_MODEL="${EMBEDDING_MODEL:-bge-m3}"
  OLLAMA_URL="${OLLAMA_BASE_URL:-http://127.0.0.1:11434}"
fi

echo "=== Diagnóstico Ollama ==="
echo "URL:    $OLLAMA_URL"
echo "Chat:   $CHAT_MODEL"
echo "Embed:  $EMBED_MODEL"
echo ""

# 1. ¿Ollama responde?
if ! curl -sf "$OLLAMA_URL/api/tags" >/dev/null 2>&1; then
  echo "❌ Ollama no responde en $OLLAMA_URL"
  echo ""
  echo "Solución:"
  echo "  1. Abre la app Ollama (icono en la barra de menú) o ejecuta: ollama serve"
  echo "  2. Vuelve a ejecutar: ./scripts/check-ollama.sh"
  exit 1
fi
echo "✓ Ollama responde"

# 2. Modelos instalados
echo ""
echo "Modelos instalados:"
ollama list 2>/dev/null || curl -s "$OLLAMA_URL/api/tags" | python3 -c "
import sys, json
for m in json.load(sys.stdin).get('models', []):
    print(f\"  - {m['name']}\")
"

has_chat=false
has_embed=false
while IFS= read -r name; do
  [[ "$name" == *"${CHAT_MODEL%%:*}"* ]] && has_chat=true
  [[ "$name" == *"${EMBED_MODEL%%:*}"* ]] && has_embed=true
done < <(ollama list 2>/dev/null | tail -n +2 | awk '{print $1}')

# 3. Descargar modelos faltantes
if [[ "$has_chat" == false ]]; then
  echo ""
  echo "⬇ Descargando modelo de chat: $CHAT_MODEL ..."
  ollama pull "$CHAT_MODEL"
fi
if [[ "$has_embed" == false ]]; then
  echo ""
  echo "⬇ Descargando modelo de embeddings: $EMBED_MODEL ..."
  ollama pull "$EMBED_MODEL"
fi

# 4. Probar chat
echo ""
echo "Probando chat con $CHAT_MODEL ..."
RESP=$(curl -s "$OLLAMA_URL/api/chat" \
  -d "{\"model\":\"$CHAT_MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"di hola\"}],\"stream\":false,\"options\":{\"num_ctx\":2048,\"num_predict\":20}}")

if echo "$RESP" | grep -q '"message"'; then
  echo "✓ Chat funciona"
  echo ""
  echo "Todo listo. Reinicia la API si estaba corriendo y prueba el chat en la web."
  exit 0
fi

# Error — mostrar detalle
echo "❌ Chat falló:"
echo "$RESP" | python3 -m json.tool 2>/dev/null || echo "$RESP"
echo ""

if echo "$RESP" | grep -qi "metal\|segmentation\|runner\|500"; then
  echo "── Posibles soluciones (MacBook Air) ──"
  echo ""
  echo "A) Actualizar Ollama a la última versión:"
  echo "     brew upgrade ollama   # o descarga desde https://ollama.com"
  echo ""
  echo "B) Probar con un modelo más ligero — edita tu .env:"
  echo "     CHAT_MODEL=llama3.2:3b"
  echo "     Luego: ollama pull llama3.2:3b"
  echo "     Reinicia la API (uvicorn)"
  echo ""
  echo "C) Reducir uso de RAM — en tu .env:"
  echo "     OLLAMA_NUM_CTX=2048"
  echo "     OLLAMA_NUM_PREDICT=700"
  echo ""
  echo "D) Si tienes Mac M5 y macOS reciente con error Metal, prueba:"
  echo "     brew install --HEAD ollama"
  echo "     (ver https://github.com/ollama/ollama/issues/15541)"
fi

exit 1
