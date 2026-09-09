#!/usr/bin/env bash
# ==============================================================================
# Nova(e) — Restauração de Backup do Banco PostgreSQL
# ==============================================================================
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Uso: $0 <caminho-do-arquivo.sql.gz> [TARGET_DATABASE_URL]"
  exit 1
fi

BACKUP_FILE="$1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [ -f "${ROOT_DIR}/.env" ]; then
  # shellcheck disable=SC2046
  export $(grep -E '^[A-Za-z_]+=' "${ROOT_DIR}/.env" | tr -d '"' | tr -d "'" || true)
fi

TARGET_URL="${2:-${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:5432/novae_agenda}}"

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "Erro: Arquivo de backup não encontrado: ${BACKUP_FILE}"
  exit 1
fi

echo "==> [Nova(e)] ATENÇÃO: Restaurando backup no banco de dados..."
echo "    Arquivo: ${BACKUP_FILE}"
echo "    Destino: ${TARGET_URL}"

gunzip -c "${BACKUP_FILE}" | psql --dbname="${TARGET_URL}" -v ON_ERROR_STOP=1

echo "==> [Nova(e)] Restauração concluída com sucesso!"
