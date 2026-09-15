#!/usr/bin/env bash
# ==============================================================================
# Reservei — Backup Automatizado do Banco de Dados MySQL 8.0+
# ==============================================================================
set -euo pipefail

# Garante acesso aos binários do MySQL no PATH padrão do Homebrew e Linux
export PATH="/opt/homebrew/opt/mysql-client/bin:/usr/local/opt/mysql-client/bin:/usr/local/bin:/usr/bin:${PATH}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKUP_DIR="${ROOT_DIR}/backups"

# Carrega variáveis de ambiente se existir .env
if [ -f "${ROOT_DIR}/.env" ]; then
  # shellcheck disable=SC2046
  export $(grep -E '^[A-Za-z_]+=' "${ROOT_DIR}/.env" | tr -d '"' | tr -d "'" || true)
fi

DATABASE_URL="${DATABASE_URL:-mysql://root:root@127.0.0.1:3306/novae_agenda}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
OUTPUT_FILE="${BACKUP_DIR}/reservei_backup_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

echo "==> [Reservei] Extraindo parâmetros de conexão da DATABASE_URL..."
DB_PARAMS=$(node -e '
  try {
    const raw = process.env.DATABASE_URL;
    const url = new URL(raw.replace(/^mysql2?:/, "http:"));
    const user = decodeURIComponent(url.username || "root");
    const password = decodeURIComponent(url.password || "");
    const host = url.hostname || "127.0.0.1";
    const port = url.port || "3306";
    const database = url.pathname.replace(/^\//, "") || "novae_agenda";
    console.log(JSON.stringify({ user, password, host, port, database }));
  } catch (err) {
    console.error("Falha ao analisar DATABASE_URL:", err.message);
    process.exit(1);
  }
')

DB_USER=$(echo "${DB_PARAMS}" | node -e 'console.log(JSON.parse(require("fs").readFileSync(0, "utf-8")).user)')
DB_PASS=$(echo "${DB_PARAMS}" | node -e 'console.log(JSON.parse(require("fs").readFileSync(0, "utf-8")).password)')
DB_HOST=$(echo "${DB_PARAMS}" | node -e 'console.log(JSON.parse(require("fs").readFileSync(0, "utf-8")).host)')
DB_PORT=$(echo "${DB_PARAMS}" | node -e 'console.log(JSON.parse(require("fs").readFileSync(0, "utf-8")).port)')
DB_NAME=$(echo "${DB_PARAMS}" | node -e 'console.log(JSON.parse(require("fs").readFileSync(0, "utf-8")).database)')

echo "==> [Reservei] Iniciando backup do banco MySQL: ${DB_NAME} em ${DB_HOST}:${DB_PORT}..."

export MYSQL_PWD="${DB_PASS}"

mysqldump \
  --host="${DB_HOST}" \
  --port="${DB_PORT}" \
  --user="${DB_USER}" \
  --single-transaction \
  --quick \
  --default-character-set=utf8mb4 \
  --set-gtid-purged=OFF \
  --routines \
  --triggers \
  "${DB_NAME}" | gzip > "${OUTPUT_FILE}"

FILE_SIZE=$(du -h "${OUTPUT_FILE}" | cut -f1)
echo "==> [Reservei] Backup concluído com sucesso!"
echo "    Arquivo: ${OUTPUT_FILE}"
echo "    Tamanho: ${FILE_SIZE}"

# Política de retenção: remove backups com mais de 14 dias
find "${BACKUP_DIR}" -name "reservei_backup_*.sql.gz" -type f -mtime +14 -delete || true
echo "==> [Reservei] Política de retenção aplicada (14 dias)."
