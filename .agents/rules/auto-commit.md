# Commit Automático de Ajustes

Sempre que concluir ajustes, implementações, correções ou refatorações solicitadas pelo usuário:

1. Inspecione os arquivos com `git status` para garantir que apenas os arquivos pertinentes ao ajuste sejam adicionados.
2. Não adicione arquivos de cache (`.next/`, `*.tsbuildinfo`), variáveis de ambiente (`.env*`) ou arquivos de SO (`.DS_Store`).
3. Execute `git add` e crie o commit com mensagem clara e semântica em português (ex: `feat:`, `fix:`, `refactor:`, `style:`, `chore:`).
4. Forneça o hash e a mensagem do commit ao usuário no fechamento da resposta.
