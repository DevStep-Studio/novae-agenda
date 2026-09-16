# RESERVEI — FLUXOS DE ACESSO E AUTENTICAÇÃO

Este documento descreve a arquitetura e o funcionamento dos fluxos de autenticação, navegação, permissões e autorização do Reservei para cada um dos três perfis do sistema: **Cliente (Customer)**, **Proprietário (Owner)** e **Funcionário (Professional)**.

---

## 1. CLIENTE (CUSTOMER)

### Objetivo
Experiência minimalista, focada exclusivamente em agendar serviços e acompanhar suas próprias reservas. O cliente não possui acesso a dashboards administrativos, relatórios, métricas financeiras ou menus do estabelecimento.

### Autenticação & Identificação
- **Credenciais**: Celular + PIN de 6 dígitos.
- **PIN Obrigatório**: Nenhum cliente consegue finalizar uma reserva ou acessar o portal sem possuir ou cadastrar um PIN de 6 dígitos.
- **Segurança do PIN**:
  - Hashing forte (Bcrypt + SHA-256 HMAC lookup com pepper).
  - Bloqueio temporário (lockout) após 5 tentativas consecutivas incorretas (15 minutos de bloqueio).
  - Rate limiting por IP, por telefone normalizado e por hash do PIN.
  - O PIN nunca é retornado em texto puro nas APIs.

### Fluxo de Booking Público (`/agendar/[slug]`)
1. Cliente escolhe o serviço e profissional (ou qualquer profissional).
2. Cliente escolhe a data e horário disponíveis.
3. Cliente informa Nome e Celular (WhatsApp).
4. O backend valida o telefone:
   - **Cliente com PIN cadastrado (`HAS_PIN`)**: Exibe o campo de 6 dígitos: *"Digite seu PIN para continuar"*.
   - **Cliente sem PIN / Primeiro acesso (`NEEDS_PIN_SETUP` ou `NOT_FOUND`)**: Exibe *"Crie um PIN de 6 dígitos para proteger seus agendamentos"* com confirmação de PIN.
5. Cliente escolhe a forma de pagamento presencial (PIX, Dinheiro ou Cartão na unidade).
6. Cliente revisa e confirma a reserva.
7. Sessão do cliente é estabelecida e o usuário é direcionado para suas reservas.

### Portal do Cliente (`/minhas-reservas`)
- **Rota canônica**: `/minhas-reservas` (com redirecionamento automático de `/cliente` e `/meus-agendamentos`).
- **Conteúdo da Tela**:
  - **Próxima Reserva (Destaque Hero)**: Data, horário, serviço, profissional, empresa, endereço e status.
  - **Ações Rápidas**: Ver detalhes, Remarcar, Desmarcar/Cancelar, Como chegar (Google Maps), Adicionar ao calendário (.ics), WhatsApp do estabelecimento.
  - **Demais Agendamentos Futuros**: Lista limpa em formato de cards.
  - **Histórico de Agendamentos**: Seção de atendimentos anteriores com botão **[Agendar novamente]** para repetição rápida.
  - **Agendar Novo Horário**: Link direto para a página de booking da empresa.
- **Isolamento de Dados (Anti-IDOR)**:
  - O cliente só pode consultar, remarcar ou cancelar reservas onde `booking.userId === currentSession.userId`.

---

## 2. PROPRIETÁRIO (OWNER)

### Objetivo
Acesso administrativo completo à sua empresa (gestão de agenda, clientes, catálogo de serviços, equipe, financeiro, relatórios, personalização e assinatura SaaS).

### Autenticação & Onboarding
- **Credenciais**: E-mail + Senha.
- **Fluxo de Entrada**:
  1. Login via e-mail e senha.
  2. Verificação de status de configuração (`companies.onboarded` no MySQL):
     - `onboarded === false`: Redirecionamento automático para o fluxo de `/onboarding`.
     - `onboarded === true`: Acesso direto ao Dashboard de Gestão (`/gestao`).
  3. O estado do onboarding é persistido no banco de dados e sincronizado na sessão.

### Separação de Experiência
- O proprietário **NÃO** possui tela de *"Meus agendamentos"* de cliente.
- Todas as reservas da empresa são visualizadas e gerenciadas através da **AGENDA / CALENDÁRIO** (`/gestao/agenda`) e pelo painel operacional de atendimento.
- No calendário, o proprietário pode:
  - Visualizar bookings por dia, semana ou mês.
  - Filtrar por profissional ou unidade.
  - Atualizar status do cliente (*Cliente chegou*, *Iniciar*, *Finalizar*, *No-show*, *Cancelar*).
  - Lançar novos agendamentos manuais / encaixes.
- **Criação de Funcionários**: Somente o proprietário/gerente pode criar novos profissionais na aba **Equipe** (`/gestao/equipe`). Não existe cadastro público para funcionários.

---

## 3. FUNCIONÁRIO (PROFESSIONAL)

### Objetivo
Acesso operacional restrito para acompanhar sua própria grade de horários, atender seus clientes e atualizar os status dos seus atendimentos diários.

### Criação & Autenticação
- **Criação da Conta**: Criada exclusivamente pelo proprietário no painel da empresa (`POST /api/employees`).
- **Credenciais**: E-mail + Senha.
- **Portal Operacional**: `/profissional`.

### Permissões & Restrições
- **Acesso Permitido**:
  - Início / Hoje (visão rápida do próximo cliente e atendimentos do dia).
  - Minha agenda (calendário restrito aos próprios atendimentos).
  - Meus clientes (clientes vinculados aos seus atendimentos).
  - Notificações de novos agendamentos e alterações.
  - Meu perfil (foto, bio e dados de contato).
  - Link de agendamento do seu perfil profissional.
  - Ações operacionais: Marcar chegada do cliente, iniciar atendimento, finalizar atendimento.
- **Restrições Rígidas (Bloqueio 403 Forbidden no Backend)**:
  - Proibido acesso ao módulo Financeiro completo da empresa.
  - Proibido acesso a faturas e planos de assinatura SaaS (`/gestao/assinatura`).
  - Proibido criar, editar ou excluir outros funcionários.
  - Proibido alterar configurações institucionais ou dados de outras empresas.
  - As listagens de atendimentos da API filtram compulsoriamente `appointments.employeeId = auth.user.employeeId`.

---

## 4. MATRIZ DE GUARDS & SESSÕES

### Guards de Servidor (`src/lib/auth.ts`)
- `requireCustomer()` / `requireClient()`: Exige sessão autenticada de cliente.
- `requireProfessional()` / `requireEmployee()`: Exige que o usuário seja funcionário vinculado ou gerente/owner.
- `requireOwner()` / `requireRole("owner")`: Exige papel de proprietário ou administrador.
- `requireBusinessAccess(targetCompanyId)`: Garante o isolamento multi-tenant estrito para que nenhum usuário acerte dados de outra empresa.
- `requireSuperAdmin()`: Restrito aos mantenedores globais da plataforma.

### Middleware de Redirecionamento Canônico (`src/middleware.ts`)
- Redireciona URLs legadas para as rotas padronizadas:
  - `/cliente` e `/meus-agendamentos` $\rightarrow$ `/minhas-reservas` (301)
  - `/dashboard` $\rightarrow$ `/gestao` (301)
  - `/agenda` $\rightarrow$ `/gestao/agenda` (301)
  - `/equipe` $\rightarrow$ `/gestao/equipe` (301)
  - `/financeiro` $\rightarrow$ `/gestao/financeiro` (301)
  - `/assinatura` e `/minha-assinatura` $\rightarrow$ `/gestao/assinatura` (301)
