#!/usr/bin/env bash
# ==============================================================================
# Nova(e) — Backup Automatizado do Banco PostgreSQL
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKUP_DIR="${ROOT_DIR}/backups"

# Carrega variáveis de ambiente se existir .env
if [ -f "${ROOT_DIR}/.env" ]; then
  # shellcheck disable=SC2046
  export $(grep -E '^[A-Za-z_]+=' "${ROOT_DIR}/.env" | tr -d '"' | tr -d "'" || true)
fi

DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:5432/novae_agenda}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
OUTPUT_FILE="${BACKUP_DIR}/novae_backup_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

echo "==> [Nova(e)] Iniciando backup do banco de dados..."
pg_dump --dbname="${DATABASE_URL}" --clean --if-exists --no-owner --no-privileges | gzip > "${OUTPUT_FILE}"

FILE_SIZE=$(du -h "${OUTPUT_FILE}" | cut -f1)
echo "==> [Nova(e)] Backup concluído com sucesso!"
echo "    Arquivo: ${OUTPUT_FILE}"
echo "    Tamanho: ${FILE_SIZE}"

# Política de retenção: remove backups com mais de 14 dias
find "${BACKUP_DIR}" -name "novae_backup_*.sql.gz" -type f -mtime +14 -delete || true
echo "==> [Nova(e)] Política de retenção aplicada (14 dias)."
