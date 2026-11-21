# API de desenvolvimento — Frela do Dia

**Status:** serviço de testes publicado separadamente do site principal. **Não é uma API de produção.**

Endpoint da Cloudflare (Worker `frela-do-dia-api-dev`):

https://frela-do-dia-api-dev.l7526080.workers.dev

Código: [dev-readonly-worker.js](dev-readonly-worker.js).

## Rotas

| Método e rota | Autenticação | Ação |
| --- | --- | --- |
| `GET /health` | Não | Indicador de instalação, sem dados pessoais |
| `GET /v1/jobs` | Não | Consulta até 20 vagas permitidas pela RLS |
| `GET /v1/me/worker` | JWT Neon válido | Consulta até 20 registros do perfil autorizado pela RLS |
| `GET /v1/me/company` | JWT Neon válido | Consulta dados resumidos da(s) empresa(s) do titular |
| `GET /v1/me/individual` | JWT Neon válido | Consulta dados resumidos do(s) contratante(s) pessoa física do titular |

**Não implementa** criação de usuários, candidaturas, abertura de anúncios, atualização, verificação de empresas, pagamentos ou notificações.

## Restrições de segurança

- O Worker usa somente a URL pública da **Data API da branch de desenvolvimento**; não há string PostgreSQL nem credenciais de administrador.
- O Neon Data API é responsável pela validação dos tokens de acesso e pelo cumprimento das políticas RLS. Não basta verificar o token no JavaScript do navegador.
- Rotas privadas exigem header `Authorization: Bearer <JWT>`; nenhum token é registrado ou retornado.
- Campos expostos são selecionados por allowlist fixa. Contatos privados, endereços residenciais, currículos e informações bancárias não são expostos.
- Apenas `GET` e `OPTIONS`; CORS restrito ao site conhecido e a `http://localhost:5173`. CORS não substitui autenticação.
- Erros do PostgreSQL e do provedor não são repassados aos clientes.
- `Cache-Control: no-store` inclusive para consultas autenticadas.

## Validação

- Upload via API da Cloudflare concluído, domínio `workers.dev` habilitado.
- Teste local de sintaxe JavaScript passou; suíte de [testes simulados](../tests/dev-api.mjs) criada.
- **Teste HTTP externo do Worker não pôde ser concluído nesta sessão**; a ferramenta de acesso externo não conseguiu abrir o domínio.
- Testes Neon RLS com identidades simuladas passaram em transação isolada; **JWT real ainda precisa ser testado** antes de liberar dados pessoais.
- Nenhuma conta real deve usar esta API até homologação e revisão de segurança.

## Próximas etapas

1. Testar `/health`, `/v1/jobs` e bloqueio da rota privada sem token no navegador real.
2. Criar contas de homologação com endereços de e-mail válidos e autenticar com o SDK do Neon.
3. Verificar com dois trabalhadores e dois contratantes distintos que nenhuma consulta retorna dados de outros titulares.
4. Criar API de escrita em backend separado, com autenticação e controle administrativo, transações de preenchimento e moderação. Não estender diretamente a API read-only para escrita sem projeto e testes específicos.
5. Após homologação, migrar as configurações para a branch `production` e integrar à interface pública.
