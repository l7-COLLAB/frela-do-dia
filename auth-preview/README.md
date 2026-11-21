# Frela do Dia — Login de homologação

Integração experimental usando o SDK oficial **Neon Auth**. Este módulo é independente do `index.html` público. Ele não cria contas nem publica vagas.

## Rodar localmente

1. Instale Node.js 20.19+ e execute `npm install` na pasta `auth-preview`.
2. Copie `.env.example` para `.env.local`.
3. Configure a URL pública da **branch development-rls** em `VITE_NEON_AUTH_URL` e o endereço da API Cloudflare de desenvolvimento em `VITE_FRELA_API_URL`.
4. Execute `npm run dev` e abra `http://localhost:5173`.
5. Para versão compilada: `npm run build`, depois `npm run preview`.

A API de testes é descrita em [backend/README.md](../backend/README.md). Não use o backend de desenvolvimento para processar perfis reais.

**Não use URLs da branch production, chaves PostgreSQL, tokens admin ou segredos na pasta do frontend.** Os nomes `VITE_*` são públicos no bundle final.

## Fluxo implementado

- Consulta de sessão ao carregar a página.
- Login com e-mail/senha de **usuário de teste previamente criado**.
- Sessão restaurada após atualizar a página.
- Leitura do **próprio perfil**, com JWT obtido pelo SDK e enviado à **API Cloudflare read-only**. O Worker encaminha a consulta para a Neon Data API, que valida o JWT e aplica RLS.
- Logout, conferência de encerramento da sessão e erros de rede/exibição.
- Nunca exibe ou persiste JWT no DOM; a sessão é gerenciada pelo SDK oficial.

**Cadastro público está desativado no Neon da branch de testes.** Este frontend não possui botão de criação de conta.

## Testes de homologação ainda pendentes

- Contas com senha válida, autenticação e sessão com usuários distintos.
- Testar Worker A/B e PJ/PF A/B, RLS positiva e negativa com JWTs reais.
- Integrar interface à navegação principal sem permitir publicação de anúncios antes da moderação.
- Configurar SMTP próprio para autenticação de produção e revisões LGPD.
- Implantar um backend de confiança para ações administrativas e transações de lotação.

A página é um exercício de integração versionado, não um produto pronto para inscrições reais.
