# RESERVEI — GUIA DEFINITIVO DE DEPLOY & PRODUÇÃO

Este documento contém todos os procedimentos e requisitos para hospedar e rodar o **Reservei** em ambiente de produção com **MySQL oficial**, **Frontend & Backend integrados**, **autenticação segura**, **jobs de agendamento** e **SSL**.

---

## 1. Requisitos de Sistema

- **Node.js**: `v20.x` ou `v22.x` (LTS recomendado).
- **Gerenciador de Pacotes**: `npm` v10+ ou `pnpm` v9+.
- **Banco de Dados**: **MySQL 8.0+** (ou MariaDB 10.6+).
  - Charset: `utf8mb4`
  - Collation: `utf8mb4_unicode_ci`
  - Storage Engine: `InnoDB`
- **Domínio**: `https://usereservei.com.br` (com certificado SSL/TLS ativo).
- **Memória Mínima**: 1 GB RAM (2 GB recomendado para compilação com Turbopack/Next.js).

---

## 2. Arquitetura de Produção

```
[ NAVEGADOR DO CLIENTE / DONO ]
             │
             ▼ HTTPS (Porta 443)
[ REVERSE PROXY / NGINX / CLOUDFLARE ]
             │
             ▼ Proxy reverso interno (127.0.0.1:3000)
[ NEXT.JS APP (FRONTEND + API ROUTES) ]
             │
             ▼ Conexão Privada / Pool MySQL (Porta 3306 - NÃO EXPOSTA PÚBLICA)
[ MYSQL 8.0 DATABASE (RESERVEI_PROD) ]
```

> **IMPORTANTE**: O banco de dados MySQL nunca deve ter sua porta 3306 aberta para a internet pública. O acesso é exclusivo do processo Node.js backend.

---

## 3. Variáveis de Ambiente (`.env`)

Crie o arquivo `.env` na raiz do projeto (`/var/www/reservei/.env` ou nas variáveis do provedor de hospedagem):

```env
# Ambiente
NODE_ENV="production"
PORT=3000

# Domínio público oficial
APP_URL="https://usereservei.com.br"

# Conexão Oficial MySQL (Substitua pelos dados reais do seu MySQL)
DATABASE_URL="mysql://reservei_user:SUA_SENHA_SEGURA@127.0.0.1:3306/reservei_prod"

# Chave JWT de Sessão (Gere com: openssl rand -base64 48)
SESSION_SECRET="cole-aqui-uma-chave-aleatoria-de-64-caracteres"

# Gateway de Pagamento Mercado Pago (SaaS Reservei)
MERCADO_PAGO_ACCESS_TOKEN="APP_USR-seu-token-de-producao"
MERCADO_PAGO_WEBHOOK_SECRET="seu-webhook-secret"

# Envio de E-mails Transacionais (Resend ou Console)
EMAIL_TRANSPORT="resend"
RESEND_API_KEY="re_seu_token_resend"
EMAIL_FROM="Reservei <notificacoes@usereservei.com.br>"

# Segredo para Disparo de Cron/Workers (Gere com: openssl rand -hex 32)
CRON_SECRET="seu-cron-secret-para-lembretes"
```

---

## 4. Passo a Passo de Instalação e Inicialização

### Passo 1: Clonar o Repositório e Instalar Dependências
```bash
git clone git@github.com:seu-usuario/novae-agenda.git /var/www/reservei
cd /var/www/reservei
npm ci --omit=dev # ou npm install
```

### Passo 2: Criar o Banco MySQL e Usuário Dedicado
Acesse o terminal do MySQL como root:
```sql
CREATE DATABASE IF NOT EXISTS reservei_prod CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'reservei_user'@'127.0.0.1' IDENTIFIED BY 'SUA_SENHA_SEGURA';
GRANT ALL PRIVILEGES ON reservei_prod.* TO 'reservei_user'@'127.0.0.1';
FLUSH PRIVILEGES;
EXIT;
```

### Passo 3: Executar as Migrações do Banco de Dados
Execute o script de migração que cria todas as 38 tabelas e índices necessários:
```bash
npx tsx scripts/migrate-saas.ts
```

### Passo 4: Popular os Planos SaaS Iniciais
Para inicializar os 6 planos oficiais (Essencial, Profissional, Equipe, Negócio, Empresa, Enterprise):
```bash
npx tsx -e 'import("./src/lib/saas/plans-seed.js").then(m => m.seedSaasPlans())'
```
*(Opcional: Caso deseje popular os dados de demonstração da barbearia Studio Prime para testes, execute `npx tsx scripts/seed.ts`)*.

### Passo 5: Gerar o Build de Produção
```bash
npm run build
```

---

## 5. Gerenciador de Processos (PM2) em VPS

Para manter a aplicação rodando 24/7 com auto-restart:

```bash
# Instalar PM2 globalmente
npm install -g pm2

# Iniciar a aplicação
pm2 start npm --name "reservei-app" -- start

# Salvar lista de processos e habilitar inicialização no boot do SO
pm2 save
pm2 startup
```

---

## 6. Configuração do Nginx (Reverse Proxy & SSL)

Crie o arquivo `/etc/nginx/sites-available/usereservei.com.br`:

```nginx
server {
    listen 80;
    server_name usereservei.com.br www.usereservei.com.br;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name usereservei.com.br www.usereservei.com.br;

    # Certificados SSL (Let's Encrypt / Certbot)
    ssl_certificate /etc/letsencrypt/live/usereservei.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/usereservei.com.br/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Ativar site e recarregar Nginx:
```bash
ln -s /etc/nginx/sites-available/usereservei.com.br /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

---

## 7. Agendador de Tarefas / Cron (Lembretes 24h e 2h)

O sistema possui um worker em `/api/cron/booking-notifications` que dispara lembretes automáticos para clientes e profissionais.

Adicione ao `crontab -e` do servidor (executa a cada 5 minutos):
```bash
*/5 * * * * curl -s -X POST "https://usereservei.com.br/api/cron/booking-notifications" -H "Authorization: Bearer seu-cron-secret-para-lembretes" > /dev/null 2>&1
```

---

## 8. Backup e Recuperação do MySQL

### Backup Diário Automático:
```bash
mysqldump -u reservei_user -p'SUA_SENHA_SEGURA' --single-transaction --quick --routines --triggers reservei_prod | gzip > /var/backups/reservei_$(date +\%Y\%m\%d_\%H\%M\%S).sql.gz
```

### Restauração de Backup:
```bash
gunzip < /var/backups/reservei_20260911_120000.sql.gz | mysql -u reservei_user -p'SUA_SENHA_SEGURA' reservei_prod
```

---

## 9. Procedimento de Rollback

Caso uma nova versão apresente instabilidades em produção:

```bash
# 1. Voltar para o commit anterior estável
git checkout <commit-anterior-estavel>

# 2. Reinstalar dependências se necessário
npm ci --omit=dev

# 3. Recompilar build
npm run build

# 4. Reiniciar processo PM2
pm2 restart reservei-app
```
