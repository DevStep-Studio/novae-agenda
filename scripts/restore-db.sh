#!/usr/bin/env bash
# ==============================================================================
# Reservei — Restauração de Backup do Banco de Dados MySQL 8.0+
# ==============================================================================
set -euo pipefail

# Garante acesso aos binários do MySQL no PATH padrão do Homebrew e Linux
export PATH="/opt/homebrew/opt/mysql-client/bin:/usr/local/opt/mysql-client/bin:/usr/local/bin:/usr/bin:${PATH}"

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

TARGET_URL="${2:-${DATABASE_URL:-mysql://root:root@127.0.0.1:3306/novae_agenda}}"

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "Erro: Arquivo de backup não encontrado: ${BACKUP_FILE}"
  exit 1
fi

echo "==> [Reservei] Extraindo parâmetros do banco de destino..."
DB_PARAMS=$(TARGET_URL="${TARGET_URL}" node -e '
  try {
    const raw = process.env.TARGET_URL;
    const url = new URL(raw.replace(/^mysql2?:/, "http:"));
    const user = decodeURIComponent(url.username || "root");
    const password = decodeURIComponent(url.password || "");
    const host = url.hostname || "127.0.0.1";
    const port = url.port || "3306";
    const database = url.pathname.replace(/^\//, "") || "novae_agenda";
    console.log(JSON.stringify({ user, password, host, port, database }));
  } catch (err) {
    console.error("Falha ao analisar TARGET_URL:", err.message);
    process.exit(1);
  }
')

DB_USER=$(echo "${DB_PARAMS}" | node -e 'console.log(JSON.parse(require("fs").readFileSync(0, "utf-8")).user)')
DB_PASS=$(echo "${DB_PARAMS}" | node -e 'console.log(JSON.parse(require("fs").readFileSync(0, "utf-8")).password)')
DB_HOST=$(echo "${DB_PARAMS}" | node -e 'console.log(JSON.parse(require("fs").readFileSync(0, "utf-8")).host)')
DB_PORT=$(echo "${DB_PARAMS}" | node -e 'console.log(JSON.parse(require("fs").readFileSync(0, "utf-8")).port)')
DB_NAME=$(echo "${DB_PARAMS}" | node -e 'console.log(JSON.parse(require("fs").readFileSync(0, "utf-8")).database)')

echo "==> [Reservei] ATENÇÃO: Restaurando backup no banco MySQL..."
echo "    Arquivo: ${BACKUP_FILE}"
echo "    Banco:   ${DB_NAME} em ${DB_HOST}:${DB_PORT}"

export MYSQL_PWD="${DB_PASS}"

# Garante que o banco de destino existe antes da restauração
mysql \
  --host="${DB_HOST}" \
  --port="${DB_PORT}" \
  --user="${DB_USER}" \
  --default-character-set=utf8mb4 \
  -e "CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Restaura o dump descompactado
gunzip -c "${BACKUP_FILE}" | mysql \
  --host="${DB_HOST}" \
  --port="${DB_PORT}" \
  --user="${DB_USER}" \
  --default-character-set=utf8mb4 \
  "${DB_NAME}"

echo "==> [Reservei] Restauração concluída com sucesso no banco '${DB_NAME}'!"
