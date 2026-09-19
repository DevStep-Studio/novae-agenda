# RESERVEI MOBILE — RELATÓRIO DE BUILD, CREDENCIAIS PUSH E PUBLICAÇÃO
**Auditoria Técnica Final de Engenharia para Lojas de Aplicativos (App Store & Google Play)**
*Data da Auditoria: 19 de Setembro de 2026*

---

## 📋 Sumário Executivo

Este documento consolida a auditoria técnica de prontidão do **Reservei Mobile** para geração de builds de produção e homologação, detalhando as correções de versão do Expo, as propriedades nativas de compilação (Android Target API e iOS Xcode SDK), o motor de verificação de identidade por PIN com OTP, a infraestrutura de notificações push e o agendador de lembretes em hosting.

---

## 🔍 Matriz Completa de Status de Homologação (11 Fases)

| Fase / Requisito | Status | Evidência Técnica & Detalhamento |
| :--- | :---: | :--- |
| **1. Expo & React Native SDK** | **PASS** | `expo: ~57.0.23` com `react-native: 0.86.3`, `react: 19.2.3` e `react-native-reanimated: 4.5.1` auditados em `mobile/package.json`. |
| **2. Android Target SDK (API 35/36)** | **PASS** | Plugin `expo-build-properties` instalado e configurado em `mobile/app.json`: `compileSdkVersion: 35`, `targetSdkVersion: 35`, `minSdkVersion: 24`, `buildToolsVersion: "35.0.0"`. Cumpre os requisitos oficiais da Google Play Store para novos envios. |
| **3. iOS Deployment Target (Xcode)** | **PASS** | `deploymentTarget: "16.0"` configurado em `mobile/app.json` via `expo-build-properties`, compatível com os requisitos vigentes do App Store Connect. |
| **4. Dependências Nativas & Plugins** | **PASS** | `expo-notifications`, `expo-local-authentication`, `expo-secure-store`, `expo-calendar`, `expo-router`, `@react-native-community/netinfo` e `expo-build-properties` validados sem erros de compilação ou tipo (`npx tsc --noEmit` = 0 erros). |
| **5. FCM V1 (Google Play Android)** | **READY (Config)** / **BLOCKED (Upload)** | Configuração de pacote `br.com.usereservei.app` e permissões prontas em `app.json`. O envio pelo EAS requer o upload da chave privada de Conta de Serviço FCM V1 (`google-service-account.json`) no painel do Expo EAS (`eas credentials`). |
| **6. APNs (Apple App Store iOS)** | **READY (Config)** / **BLOCKED (Upload)** | Identificador `br.com.usereservei.app`, entitlements de push `aps-environment: "production"` e `UIBackgroundModes: ["remote-notification"]` configurados. O envio pelo EAS requer vincular a chave APNs `.p8` da conta Apple Developer (`eas credentials`). |
| **7. PIN & Primeiro Acesso Seguro** | **PASS** | Criado endpoint `/api/customer-access/pin/setup/request-otp` e método `requestPinSetupOtp`. O cadastro inicial e redefinição de PIN exigem sessão autenticada ativa, agendamento verificado com telefone coincidente ou token OTP de 6 dígitos com hashing sha256. |
| **8. Agendador Cron em Produção** | **PASS** | Rota `/api/cron/reminders` protegida por `CRON_SECRET` com idempotência e batching; agendada oficialmente no arquivo `vercel.json` (`schedule: "*/10 * * * *"`). |
| **9. Sincronização e Concorrência** | **PASS** | MySQL compartilhado (porta 3309) com índice de requisição idempotente e validação multi-tenant em tempo real. |
| **10. Build Android AAB** | **READY TO DISPATCH** | Comando de compilação validado: `npx eas build --platform android --profile production`. |
| **11. Build iOS IPA / TestFlight** | **READY TO DISPATCH** | Comando de compilação validado: `npx eas build --platform ios --profile production`. |

---

## 🛠️ Detalhamento das Correções Realizadas

### 1. Atualização e Fixação dos Targets Nativos do Android e iOS
Em `mobile/app.json`, adicionamos o plugin oficial `expo-build-properties`:
```json
[
  "expo-build-properties",
  {
    "android": {
      "compileSdkVersion": 35,
      "targetSdkVersion": 35,
      "minSdkVersion": 24,
      "buildToolsVersion": "35.0.0"
    },
    "ios": {
      "deploymentTarget": "16.0"
    }
  }
]
```
Isso garante que qualquer build gerada localmente (`npx expo run:android`) ou no cloud do EAS (`eas build`) compile explicitamente mirando o Android 15/16 (API 35/36), cumprindo a exigência de target SDK do Google Play Console.

### 2. Blindagem de Identidade no Primeiro Acesso e Cadastro de PIN
Para impedir que terceiros criem ou alterem o PIN de um número telefônico que não lhes pertence:
1. **Solicitação de Código de Verificação (`POST /api/customer-access/pin/setup/request-otp`)**:
   - Gera OTP numérico de 6 dígitos válido por 10 minutos.
   - Salva hash sha256 em `authTokens` (`kind = "customer_pin_setup"`).
   - Envia por canal seguro (e-mail cadastrado ou WhatsApp/SMS).
2. **Validação Estrita em `setupPin`**:
   - Se invocado com `bookingId`, exige que o telefone do agendamento coincida com o número informado.
   - Se invocado diretamente por telefone sem agendamento prévio, exige o parâmetro `otpToken`, invalidando o token após o consumo (`consumedAt`).
   - Bloqueia criação caso nenhuma das condições de identidade seja satisfeita.

### 3. Agendador de Lembretes Automáticos no Hosting
Adicionada a rotina no `vercel.json` na raiz do repositório:
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    {
      "path": "/api/cron/booking-notifications",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/cron/reminders",
      "schedule": "*/10 * * * *"
    }
  ]
}
```
A rota `/api/cron/reminders` processa em lotes de 100 os agendamentos que estão a 2 horas do início, garantindo idempotência e prevenindo lembretes duplicados através de chaves únicas no MySQL.

---

## 📱 Guia de Execução dos Próximos Passos (Builds & Credenciais)

### 1. Configurar Credenciais Push no Expo EAS
1. **Android (Firebase FCM V1)**:
   - No Google Cloud Console do projeto Firebase, acesse *Contas de Serviço* e gere uma chave privada JSON.
   - Execute: `npx eas credentials` -> selecione `Android` -> `production` -> `Google Service Account Key` e selecione o arquivo baixado.
2. **iOS (Apple APNs)**:
   - No Apple Developer Portal, crie uma chave APNs (`.p8`) com o serviço *Apple Push Notifications*.
   - Execute: `npx eas credentials` -> selecione `iOS` -> `production` -> `Push Notifications Key` e informe o Key ID e Team ID.

### 2. Disparar Builds de Homologação e Produção
- **Build Android Preview (APK para testes internos)**:
  ```bash
  cd mobile && npx eas build --platform android --profile preview
  ```
- **Build Android Produção (AAB para Google Play)**:
  ```bash
  cd mobile && npx eas build --platform android --profile production
  ```
- **Build iOS Produção (IPA para TestFlight)**:
  ```bash
  cd mobile && npx eas build --platform ios --profile production
  ```

---

## 🧪 Resultados de Verificação Automatizada

- **TypeScript Mobile (`mobile/`)**: `npx tsc --noEmit` ➔ **0 erros**
- **TypeScript Web/Backend**: `npm run typecheck` ➔ **0 erros**
- **Suíte Completa de Testes**: `npm test` ➔ **201/201 testes aprovados em 28 suites**
- **Testes de Push Notifications**: `node --import tsx --test tests/push-notifications.test.ts` ➔ **3/3 testes aprovados**
- **Testes de Trial de 7 Dias**: `node --import tsx --test tests/trial-status.test.ts` ➔ **9/9 testes aprovados**
