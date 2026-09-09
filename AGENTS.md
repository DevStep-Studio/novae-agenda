# Diretrizes e Regras do Repositório (Antigravity)

## Commit Automático de Ajustes

Sempre que o assistente de IA concluir modificações de código, correções, adições de features ou qualquer ajuste solicitado pelo usuário neste projeto:

1. **Revisão de Arquivos**:
   - Verificar o `git status` antes de commitar.
   - NUNCA incluir arquivos sensíveis (`.env`, `.env.local`), caches/builds (`.next/`, `*.tsbuildinfo`, `dist/`), nem arquivos de sistema (`.DS_Store`).

2. **Commit Automático Obrigatório**:
   - Adicionar os arquivos alterados com `git add <arquivos-específicos>` ou `git add .` (desde que os arquivos indesejados estejam no `.gitignore`).
   - Criar um commit com mensagem concisa e semântica em português, seguindo o padrão Conventional Commits (ex: `feat:`, `fix:`, `refactor:`, `style:`, `chore:`).
   - Exemplo: `git commit -m "feat(auth): ajusta fluxo de login e validações"`

3. **Confirmação ao Usuário**:
   - Ao final da resposta, informar o hash do commit e a mensagem gerada para que o usuário tenha total rastreabilidade.

## Validação e Automação de Navegador (Sem Bloqueio)

1. **Tratamento de Limitações de Navegador em Segundo Plano**:
   - NUNCA interromper o usuário nem emitir avisos pedindo instruções quando houver erros de protocolo interno do navegador em segundo plano (como erros CDP `Browser.setDownloadBehavior` ou falhas de contexto do subagente de browser).
   - Não transferir a responsabilidade nem fazer perguntas bloqueantes sobre ferramentas ou limitações internas.

2. **Validação Direta e Autônoma**:
   - Em vez de travar o fluxo com subagentes de gravação quando houver limitações de protocolo, realizar a validação de forma 100% autônoma utilizando:
     - Verificação estática de tipos: `npm run typecheck`
     - Suíte de testes automatizados: `npm test`
     - Checagem de integridade de rotas e servidor local.
   - Garantir que o atendimento seja sempre ágil, fluido e focado na entrega de soluções sem atrito.

