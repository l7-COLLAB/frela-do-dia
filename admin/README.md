# Painel administrativo — Frela do Dia

**Endereço público:** https://frela-do-dia.l7526080.workers.dev/painel/

**Status:** interface implantada no Worker público em 20/11/2026, conectada **somente ao Neon de desenvolvimento**. Login e ações reais ainda requerem conta administrativa habilitada e testes com JWTs válidos. A página pública de vagas permanece um protótipo com anúncios fictícios.

## O que já existe

- Página responsiva de login, com a identidade visual aprovada.
- Fila de **empresas**, **pessoas físicas** e **vagas** com estado pendente.
- Botões de aprovação/rejeição mediante justificativa obrigatória (10–1.200 caracteres) e confirmação.
- Endpoint protegido `GET /v1/admin/queue` no Worker de API e endpoint `POST /v1/admin/decision`.
- Funções do Neon `frela_admin_queue` e `frela_admin_decide`, que exigem JWT válido **e operador presente na allowlist privada** do banco.
- Registro das decisões de moderação em `app_private.audit_events`, conforme migração 0006.
- Nenhuma conta administrativa foi criada ou autorizada automaticamente.
- Não existem dados ou vagas reais carregados nesta fase.

## Separação de segurança

1. A página `/painel/` é acessível pela internet, mas não contém dados de anunciantes embutidos.
2. Neon Auth emite o token de autenticação para o usuário.
3. O browser envia o JWT à API da Cloudflare, sem uma senha administrativa.
4. A API encaminha ao RPC do Neon; **o banco rejeita quem não está autorizado**, inclusive usuários autenticados comuns.
5. A tabela `app_private.admin_operators` não é exposta e começa **vazia**, com `active=false` por padrão.
6. O esquema privado não tem permissões para `anonymous` nem `authenticated`.
7. O frontend jamais é um controle de segurança suficiente, a proteção é verificada no Neon em toda ação.

## Como habilitar sua própria conta administrativa, depois da homologação

- Criar e verificar a conta **do titular autorizado** no Neon Auth de desenvolvimento, usando e-mail real. O usuário define suas credenciais diretamente no fluxo seguro, sem compartilhá-las no chat.
- Confirmar o ID real de usuário retornado pelo Neon Auth e, **somente no SQL Console do Neon de desenvolvimento**, inserir manualmente a autorização:
  
  ```sql
  INSERT INTO app_private.admin_operators(user_id, active, grant_reason)
  VALUES ('ID_VERIFICADO_DO_NEON_AUTH', true,
          'Administradora responsável pelo ambiente de desenvolvimento');
  ```

- Essa operação é exclusivamente administrativa, após confirmar a identidade do titular. **Nunca** aceitar um ID de usuário enviado pela interface pública para conceder acesso.
- Testar login, encerramento de sessão, acesso negado a outro usuário e decisões com auditoria.
- No ambiente `production`, implementar novo fluxo controlado, sem copiar automaticamente contas ou testes.

## Limitações registradas

- **Não foi confirmada uma sessão real de login no navegador.** A integração com o SDK do Neon é uma implementação cuja execução ponta a ponta ainda precisa de testes.
- Dependência ESM do SDK no navegador utiliza versão fixa via CDN; a disponibilidade e o comportamento em Safari iPhone devem ser confirmados antes de abrir a operação.
- A publicação do Worker foi confirmada via Cloudflare API, e a rota foi acrescentada ao código. Não foi possível verificar a resposta HTTP externa do domínio nesta sessão.
- O preenchimento da fila pública ainda é vazio: cadastros e anúncios verdadeiros não estão abertos.
- Não há upload de documentos, avaliação automática de identidade, denúncia, histórico completo no painel, nem gerenciamento financeiro.
- O backend administrativo futuro exigirá regras de identidade, antifraude, limites de requisição, auditoria de sessões e revisão LGPD.
- **Avaliações bilaterais e contestação de pagamento continuam adiadas.**

## Arquivos relacionados

- [Interface do painel](index.html)
- [Cliente Neon Auth e API](app.js)
- [Worker principal](../backend/public-site-worker.js)
- [API Cloudflare](../backend/dev-readonly-worker.js)
- [Migração de allowlist e RPC](../database/migrations/0007_admin_dashboard_access.sql)
- [Moderação auditada](../database/migrations/0006_private_moderation_and_hiring.sql)
- [Teste de autorização simulado](../database/tests/verify_admin_rpc_simulated.sql)
- [Teste estático](../tests/admin-static.mjs)
