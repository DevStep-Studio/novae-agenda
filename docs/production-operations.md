# Nova(e) — Guia de Produção, Backups e Checklist Operacional

Este documento detalha os procedimentos para publicação em produção, rotinas de backup, restauração e políticas operacionais do sistema Nova(e).

---

## 1. Estratégia e Política de Backup

### 1.1 Banco de Dados (PostgreSQL)

* **Ferramenta nativa**: `pg_dump` e `pg_restore`.
* **Frequência recomendada**:
  * **Backup Completo**: Diário às 03:00 (horário de menor tráfego).
  * **Backup Contínuo / WAL (Point-in-Time Recovery)**: Para ambientes com alto volume de agendamentos e transações de pagamento.
* **Retenção sugerida**:
  * Backups diários: manter por 14 dias.
  * Backups semanais: manter por 8 semanas.
  * Backups mensais: manter por 12 meses.
* **Criptografia e Destino**: Armazenar os dumps compactados e criptografados (ex.: GPG ou AES-256) em bucket de armazenamento seguro (AWS S3, Cloudflare R2 ou GCP Bucket) com ciclo de vida (Lifecycle Rules) configurado.

#### Script Automatizado de Backup (`backup.sh`)
```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/var/backups/novae-agenda"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="novae_backup_${TIMESTAMP}.dump"

mkdir -p "${BACKUP_DIR}"

echo "[$(date)] Iniciando backup do banco de dados..."
pg_dump "${DATABASE_URL}" \
  --format=custom \
  --blobs \
  --no-owner \
  --no-privileges \
  --file="${BACKUP_DIR}/${FILENAME}"

gzip -9 "${BACKUP_DIR}/${FILENAME}"
echo "[$(date)] Backup concluído: ${BACKUP_DIR}/${FILENAME}.gz"

# Limpeza de backups locais com mais de 14 dias
find "${BACKUP_DIR}" -name "novae_backup_*.dump.gz" -type f -mtime +14 -delete
```

#### Procedimento de Restauração
```bash
# 1. Descompactar o dump
gunzip /var/backups/novae-agenda/novae_backup_20261019_030000.dump.gz

# 2. Restaurar no PostgreSQL limpo
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --dbname="${DATABASE_URL}" \
  /var/backups/novae-agenda/novae_backup_20261019_030000.dump
```

---

## 2. Checklist Pré-Produção

- [x] **Banco de Dados**: Migrations aplicadas (`npm run db:migrate`).
- [x] **Typecheck**: 0 erros no TypeScript (`npm run typecheck`).
- [x] **Testes Automatizados**: Suíte completa de testes passando (`npm test`).
- [x] **Build de Produção**: Next.js compilado com sucesso (`npm run build`).
- [ ] **HTTPS / TLS**: Certificado válido instalado (Let's Encrypt / Cloudflare).
- [ ] **Variáveis de Ambiente**:
  - `DATABASE_URL` apontando para cluster Postgres em produção com SSL (`sslmode=require`).
  - `SESSION_SECRET` com chave criptograficamente segura (`openssl rand -base64 48`).
  - `APP_URL` configurado com o domínio real (`https://app.novae.com.br`).
  - `EMAIL_TRANSPORT="resend"` com `RESEND_API_KEY` válida para envio de e-mails transacionais.
- [ ] **Headers de Segurança e CORS**:
  - HSTS, X-Content-Type-Options, X-Frame-Options ativados no proxy reverso (Nginx/Cloudflare).
- [ ] **Rate Limiting**:
  - Tabela `auth_rate_limits` em funcionamento para prevenir ataques de força bruta em `/api/auth/*`.
- [ ] **Health Check**:
  - Monitoramento contínuo em `GET /api/health`.

---

## 3. Comandos de Operação

### Executar Testes Automatizados
```bash
npm test
```

### Checar Tipos
```bash
npm run typecheck
```

### Gerar e Aplicar Migrations
```bash
npm run db:generate
npm run db:migrate
```

### Executar Build de Produção
```bash
npm run build
```

### Iniciar Servidor de Produção
```bash
npm start
```
