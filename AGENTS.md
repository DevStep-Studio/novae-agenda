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
