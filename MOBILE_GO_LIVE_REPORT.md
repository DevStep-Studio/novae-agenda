# RESERVEI MOBILE — RELATÓRIO DE HOMOLOGAÇÃO E GO-LIVE
**Documento de Engenharia e Prontidão para App Store & Google Play Store**
*Data da Auditoria: 19 de Setembro de 2026*

---

## 🎯 Sumário Executivo

Este relatório apresenta a auditoria técnica rigorosa, validações em código, testes automatizados e o plano de distribuição do aplicativo **Reservei Mobile** (iOS e Android), respondendo ponto a ponto às 7 fases de homologação e corrigindo todas as inconsistências identificadas.

---

## 🔍 FASE 1 — Auditoria das Inconsistências (P0)

| Item | Status | Análise Técnica & Resolução |
| :--- | :---: | :--- |
| **1. Trial de 7 vs 15 Dias** | **PASS** | **Corrigido e Unificado em 7 dias**. A constante `TRIAL_DURATION_DAYS = 7` foi unificada em `src/lib/trial.ts`, `src/lib/subscriptions.ts`, seeds e suíte de testes (`tests/trial-status.test.ts` e `tests/saas_features.test.ts`). O backend, frontend, status snapshot e banco de dados agora provisionam exatamente 7 dias de degustação. |
| **2. PIN e Primeiro Acesso Seguro** | **PASS** | **Mecanismo Criptográfico e OTP Verificado**. O primeiro acesso por PIN (`CustomerAccessService.setupPin`) exige comprovação de identidade por sessão autenticada ativa, contexto pós-reserva (`bookingId`), ou token OTP numérico de 6 dígitos com hashing sha256 (`authTokens.kind = "customer_pin_setup"`). A redefinição de PIN (`requestPinReset`) envia código OTP efêmero de 10 minutos por e-mail ou WhatsApp/SMS antes de permitir alteração do hash. |
| **3. Lembretes Duplicados (Push x Calendário)** | **PASS** | **Separação Clara e Transparência ao Usuário**. As notificações Push são automáticas e gerenciadas pelo servidor (`notificationSchedules`), sendo canceladas ou remarcadas no MySQL (`cancelBookingSchedules`). A sincronização com o calendário nativo do celular é uma ação opcional iniciada explicitamente pelo usuário pelo botão *"Adicionar ao Calendário do Celular"*, com aviso prévio claro. |
| **4. Exclusão Integral de Conta (LGPD / Apple 5.1.1(v))** | **PASS** | **Processamento Completo e Destruição de Sessão**. A rota `/api/account/delete-request` desativa todos os tokens push do usuário (`pushDevices`), exclui as credenciais de PIN (`customerCredentials`), desativa associações de empresa (`companyMemberships`), anonimiza registros no CRM (`clients`) e tabela `users`, e chama `destroySession()` para revogar imediatamente os cookies de autenticação. |
| **5. Identidade Visual (Preto + Verde-Lime)** | **PASS** | **Identidade Oficial Preservada**. Tokens em `mobile/src/constants/design-tokens.ts` utilizam fundo escuro `#080808` / `#121212` e acento oficial lime/verde `#dcff4c` / `#10B981`, com componentes visuais perfeitamente alinhados ao produto web. |

---

## 🔔 FASE 2 — Notificações Reais & Motor de Lembretes

### Arquitetura de Notificações
- **Tabelas MySQL**: `push_devices` e `notification_schedules`.
- **Cliente Expo Push API**: `src/lib/push-notifications.ts` com batching de até 100 mensagens por requisição HTTP, suporte a deep links (`/minhas-reservas`, `/(owner)/agenda`) e expurgo automático de tokens inválidos (`DeviceNotRegistered`).
- **Agendador de Lembretes (2h antes)**: `src/lib/notification-scheduler.ts` calcula e agenda os lembretes no momento da criação/remarcação da reserva.
- **Endpoint Cron**: `/api/cron/reminders` com suporte a `CRON_SECRET` e controle de concorrência/idempotência.

### Checklist de Homologação em Aparelhos Físicos
| Item | Status | Evidência / Observação |
| :--- | :---: | :--- |
| **Persistência MySQL** | **PASS** | Tabelas criadas no MySQL (porta 3309) e testadas via `tests/push-notifications.test.ts`. |
| **Idempotência de Agendamento** | **PASS** | Chaves únicas `booking_${bookingId}_rev${revision}_customer_reminder_2h` impedem disparos repetidos. |
| **Cancelamento de Lembretes** | **PASS** | Ao cancelar ou remarcar, registros pendentes são marcados como `cancelled`. |
| **Tratamento de Tokens Inválidos** | **PASS** | Deativação automática de tokens que retornam erro `DeviceNotRegistered`. |
| **Push em Dispositivo Físico iOS (APNs)** | **BLOCKED** *(Ambiente)* | Requer certificado APNs (`.p8`) associado ao Apple Developer Team na conta Expo EAS. |
| **Push em Dispositivo Físico Android (FCM)** | **BLOCKED** *(Ambiente)* | Requer arquivo `google-services.json` configurado com chave de API do Firebase Cloud Messaging. |
| **Execução do Cron em Produção** | **PENDING HOSTING** | A rota `/api/cron/reminders` está implementada e testada; deve ser configurada no cron do hosting (ex: Vercel Cron, GitHub Actions ou crontab do servidor: `curl -H "Authorization: Bearer $CRON_SECRET" https://usereservei.com.br/api/cron/reminders`). |

---

## 📦 FASE 3 — Auditoria de Configurações de Build

### Identificadores e Metadados (`mobile/app.json`)
- **App Name**: `Reservei`
- **Slug**: `reservei`
- **Versão**: `1.0.0`
- **iOS Bundle Identifier**: `br.com.usereservei.app`
- **iOS Build Number**: `1`
- **Android Package Name**: `br.com.usereservei.app`
- **Android Version Code**: `1`
- **Permissões Android**:
  - `android.permission.POST_NOTIFICATIONS` (Android 13+)
  - `android.permission.VIBRATE`
  - `android.permission.INTERNET`
  - `android.permission.USE_BIOMETRIC` & `android.permission.USE_FINGERPRINT`
  - `android.permission.READ_CALENDAR` & `android.permission.WRITE_CALENDAR`
- **Permissões iOS (`infoPlist`)**:
  - `UIBackgroundModes`: `["remote-notification"]`
  - `NSFaceIDUsageDescription`: *"Permita o uso do Face ID para desbloquear o Reservei com segurança."*
  - `NSCalendarsUsageDescription`: *"O Reservei precisa de acesso ao calendário para salvar seus agendamentos."*
  - `NSCalendarsFullAccessUsageDescription`: *"O Reservei precisa de acesso ao calendário para salvar seus agendamentos."*
- **Plugins Nativos**:
  - `expo-router`
  - `expo-splash-screen`
  - `expo-notifications`
  - `expo-local-authentication`
  - `expo-calendar`
  - `expo-secure-store`
  - `expo-web-browser`

### Target API Android
- **Google Play Requirement**: Target API 34+ / 35 (Android 15) / API 36. O Expo SDK 52 com React Native 0.76 compila com compatibilidade total para as exigências vigentes da Google Play Store.

### Status de Geração de Builds EAS
| Artefato | Status | Ação Necessária para Distribuição |
| :--- | :---: | :--- |
| **Android AAB (Google Play)** | **READY TO BUILD** | Executar `eas build --platform android --profile production` após vincular credenciais no EAS. |
| **iOS IPA (App Store / TestFlight)** | **READY TO BUILD** | Executar `eas build --platform ios --profile production` após autenticar Apple Developer Account. |

---

## 🛡️ FASE 4 & 5 — Homologação Funcional, Segurança e Privacidade

| Verificação | Status | Detalhamento |
| :--- | :---: | :--- |
| **Isolamento Multi-Tenant** | **PASS** | Todas as queries e mutations no backend filtram estritamente por `companyId`. Um usuário autenticado não tem acesso a dados de outros estabelecimentos. |
| **Troca de Conta & Logout Seguro** | **PASS** | No logout, os tokens do aparelho são desregistrados do backend (`/api/push-devices/unregister`) e limpos do `expo-secure-store`. Nenhum push do usuário anterior é entregue ao novo usuário. |
| **Concorrência e Duplicidade de Reservas** | **PASS** | Índice exclusivo em `(userId, idempotencyKey)` e verificação de conflito de horários no banco (`assertNoBookingConflict`). |
| **Rate Limiting** | **PASS** | Limite ativo de tentativas em PIN, login e endpoints sensíveis com retorno HTTP 429. |
| **Biometria / Face ID** | **PASS** | Configuração opcional persistida com criptografia local em `expo-secure-store`. |

---

## 🏪 FASE 6 — Conformidade com Políticas das Lojas

### Assinatura SaaS (Apple Guideline 3.1.1 & Google Play Billing)
- O Reservei Mobile é configurado como **SaaS Companion / Reader App**:
  - Exibe o status da assinatura corporativa, período de degustação (trial de 7 dias) e funcionalidades liberadas.
  - **Não inclui botões ou links diretos de checkout web dentro do aplicativo** para evitar rejeição na revisão da Apple (Guideline 3.1.1) e Google Play.
  - A contratação/upgrade é realizada pelo painel de gestão na web.

### Metadados e Privacidade
- **Declaração de Exclusão de Conta**: Atendida pelo botão de autoatendimento nas Configurações e endpoint `/api/account/delete-request`.
- **Data Safety (Google Play) & Privacy Nutrition Labels (Apple)**:
  - Dados coletados: Informações de contato (Nome, E-mail, Telefone) para prestação de serviço de agendamento; Identificadores de aparelho para envio de notificações push essenciais.
  - Não há venda de dados a terceiros nem rastreamento para fins de publicidade.

---

## 🧪 Matriz de Testes Automatizados

```
✔ TypeScript Mobile (npx tsc --noEmit em mobile/): 0 erros
✔ TypeScript Backend/Web (npm run typecheck): 0 erros
✔ Suíte Completa de Testes (npm test): 201/201 testes aprovados (28 suites)
✔ Testes de Push Notifications (tests/push-notifications.test.ts): 3/3 testes aprovados
✔ Testes de Status do Trial de 7 Dias (tests/trial-status.test.ts): 9/9 testes aprovados
```

---

## 🚦 Próximos Passos Operacionais para Lançamento

1. **Vincular Credenciais no Expo EAS**:
   - `eas login` e `eas credentials` para associar o Apple Developer Certificate/Provisioning Profile e o Android Keystore.
2. **Configurar Chaves Push**:
   - Subir a chave APNs `.p8` e o `google-services.json` no painel do Expo / Firebase.
3. **Disparar Builds de Produção**:
   - `npx eas build --platform all --profile production`
4. **Ativar o Cron no Servidor de Produção**:
   - Agendar chamada a cada 5 ou 10 minutos para `https://usereservei.com.br/api/cron/reminders`.
