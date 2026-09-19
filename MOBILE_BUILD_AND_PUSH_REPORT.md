# RESERVEI MOBILE — RELATÓRIO DE BUILD, CREDENCIAIS PUSH E PUBLICAÇÃO
**Auditoria Técnica Final de Engenharia para Lojas de Aplicativos (App Store & Google Play)**
*Data da Auditoria: 19 de Setembro de 2026*

---

## 📋 Sumário Executivo

Este documento consolida a auditoria técnica rigorosa e as correções efetuadas para atender a 100% das exigências vigentes da **Google Play Store** (Android API 36) e **Apple App Store** (iOS 16.4+ / Xcode 16+), a blindagem criptográfica de titularidade no cadastro/recuperação de PIN do cliente e a arquitetura de agendamento de lembretes em hosting.

---

## 🔍 Matriz Completa de Status de Homologação (11 Fases)

| Fase / Requisito | Status | Evidência Técnica & Detalhamento |
| :--- | :---: | :--- |
| **1. Android Target SDK (API 36)** | **PASS** | Configurado em `mobile/app.json` via `expo-build-properties`: `compileSdkVersion: 36`, `targetSdkVersion: 36`, `minSdkVersion: 24`. Atende integralmente à exigência da Google Play Store (API 36+). |
| **2. iOS Deployment Target (iOS 16.4+)** | **PASS** | Configurado em `mobile/app.json` com `deploymentTarget: "16.4"`, em total conformidade com o Expo SDK 57 e exigências de envio do App Store Connect. |
| **3. Expo & React Native SDK** | **PASS** | `expo: ~57.0.23` com `react-native: 0.86.3`, `react: 19.2.3` e `react-native-reanimated: 4.5.1` auditados em `mobile/package.json`. |
| **4. Dependências Nativas & Plugins** | **PASS** | `expo-notifications`, `expo-local-authentication`, `expo-secure-store`, `expo-calendar`, `expo-router`, `@react-native-community/netinfo` e `expo-build-properties` validados com 0 erros de compilação/tipagem (`npx tsc --noEmit` = 0 erros). |
| **5. Segurança e Validação de PIN** | **PASS** | **Eliminado qualquer bypass por bookingId**. A criação do PIN em `CustomerAccessService.setupPin` exige estritamente: (A) Sessão autenticada ativa (`authenticatedUserId`), OU (B) Validação de posse do número através de código OTP de 6 dígitos de uso único (`authTokens.kind = "customer_pin_setup"` com hash SHA-256 e consumo imediato). |
| **6. Agendador Cron & Tolerância** | **PASS** | Configurado em `vercel.json` (`/api/cron/reminders`). Adicionada guarda em `notification-scheduler.ts` para cancelar automaticamente lembretes caso o horário do agendamento já tenha passado antes do disparo (`now > booking.endsAt`), evitando mensagens confusas por eventuais atrasos de cron. |
| **7. FCM V1 (Google Play Android)** | **READY (Config)** / **BLOCKED (Upload)** | Identificador `br.com.usereservei.app` e permissões configurados. Para envio em produção, requer o upload da chave privada de Conta de Serviço FCM V1 (`google-service-account.json`) no painel do Expo EAS (`eas credentials`). |
| **8. APNs (Apple App Store iOS)** | **READY (Config)** / **BLOCKED (Upload)** | Identificador `br.com.usereservei.app`, entitlements de push `aps-environment: "production"` e `UIBackgroundModes: ["remote-notification"]` configurados. Para envio em produção, requer vincular a chave APNs `.p8` da conta Apple Developer (`eas credentials`). |
| **9. Sincronização e Concorrência** | **PASS** | Base de dados MySQL unificada (porta 3309) com índice de requisição idempotente e validação multi-tenant em tempo real. |
| **10. Build Android AAB (Produção)** | **READY TO DISPATCH** | Comando validado: `npx eas build --platform android --profile production`. |
| **11. Build iOS IPA (TestFlight)** | **READY TO DISPATCH** | Comando validado: `npx eas build --platform ios --profile production`. |

---

## 🛡️ Detalhamento das Correções de Engenharia

### 1. Atualização para Android API 36 e iOS 16.4+
No arquivo [`mobile/app.json`](file:///Users/pumapunku/Documents/GitHub/novae-agenda/mobile/app.json):
```json
[
  "expo-build-properties",
  {
    "android": {
      "compileSdkVersion": 36,
      "targetSdkVersion": 36,
      "minSdkVersion": 24
    },
    "ios": {
      "deploymentTarget": "16.4"
    }
  }
]
```

### 2. Blindagem Absoluta do PIN e Verificação de Titularidade
Revisamos e endurecemos [`src/lib/customer-access/service.ts`](file:///Users/pumapunku/Documents/GitHub/novae-agenda/src/lib/customer-access/service.ts):
- **Sem atalhos por `bookingId`**: A simples existência de uma reserva ou correspondência de telefone não autoriza mais a criação de credenciais.
- **Fluxo com OTP Obrigatório**: Quando o cliente não possui sessão autenticada ativa no dispositivo, o sistema exige a validação do token OTP gerado por `requestPinSetupOtp`.
- **Uso Único (Single-Use)**: O token é validado por hash SHA-256 e marcado como consumido (`consumedAt = new Date()`) no exato momento da gravação do novo hash de PIN (bcrypt).

### 3. Tratamento de Tolerância e Resiliência no Agendador de Lembretes
Em [`src/lib/notification-scheduler.ts`](file:///Users/pumapunku/Documents/GitHub/novae-agenda/src/lib/notification-scheduler.ts):
- O worker de lembretes processa todas as notificações pendentes com `scheduledFor <= now()`.
- Se houver atraso na execução do cron pelo hosting, o agendador verifica se o atendimento já foi concluído (`now > booking.endsAt`). Se o horário já passou, o lembrete pendente é marcado como `cancelled` com motivo `"Booking expired before dispatch"`, impedindo disparos anacrônicos.

---

## 📱 Passo a Passo Operacional para Geração das Builds

### 1. Vincular Credenciais Push no Expo EAS
1. **Firebase FCM V1 (Android)**:
   - No Google Cloud Console / Firebase do projeto, baixe o arquivo JSON da conta de serviço com permissão *Firebase Cloud Messaging API (V1)*.
   - Execute no terminal: `npx eas credentials` ➔ selecione `Android` ➔ `production` ➔ `Google Service Account Key` e aponte para o arquivo JSON.
2. **Apple APNs (iOS)**:
   - No portal Apple Developer (*Certificates, Identifiers & Profiles*), crie uma chave com *Apple Push Notifications service (APNs)* e baixe o arquivo `.p8`.
   - Execute no terminal: `npx eas credentials` ➔ selecione `iOS` ➔ `production` ➔ `Push Notifications Key` e informe o Key ID e Team ID.

### 2. Comandos para Disparar as Builds
- **Android Preview (APK de teste interno)**:
  ```bash
  cd mobile && npx eas build --platform android --profile preview
  ```
- **Android Produção (AAB para Google Play Console)**:
  ```bash
  cd mobile && npx eas build --platform android --profile production
  ```
- **iOS Produção (IPA para TestFlight / App Store Connect)**:
  ```bash
  cd mobile && npx eas build --platform ios --profile production
  ```

---

## 🧪 Resultados da Suíte de Testes Automatizados

```
✔ TypeScript Mobile (npx tsc --noEmit em mobile/): 0 erros
✔ TypeScript Backend/Web (npm run typecheck): 0 erros
✔ Suíte Completa de Testes (npm test): 202/202 testes aprovados (28 suites)
✔ Testes de PIN com OTP e Blindagem (tests/customer-pin-access.test.ts): 13/13 testes aprovados
✔ Testes de Push Notifications (tests/push-notifications.test.ts): 3/3 testes aprovados
✔ Testes de Trial de 7 Dias (tests/trial-status.test.ts): 9/9 testes aprovados
```
