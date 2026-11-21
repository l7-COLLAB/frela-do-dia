# Painel administrativo — Frela do Dia

**Endereço público:** https://frela-do-dia.l7526080.workers.dev/painel/

**Status:** interface implantada no Worker público em 20/11/2026, conectada **somente ao Neon de desenvolvimento**. Uma única conta administrativa de desenvolvimento foi cadastrada e autorizada. A autenticação usa **Magic Link** (link por e-mail com duração de 10 minutos), sem senha. A sessão com JWT real ainda deve ser homologada. A página pública de vagas permanece um protótipo com anúncios fictícios.

## O que já existe

- Página responsiva de login, com a identidade visual aprovada.
- Fila de **empresas**, **pessoas físicas** e **vagas** com estado pendente.
- Botões de aprovação/rejeição mediante justificativa obrigatória (10–1.200 caracteres) e confirmação.
- Endpoint protegido `GET /v1/admin/queue` no Worker de API e endpoint `POST /v1/admin/decision`.
- Funções do Neon `frela_admin_queue` e `frela_admin_decide`, que exigem JWT válido **e operador presente na allowlist privada** do banco.
- Registro das decisões de moderação em `app_private.audit_events`, conforme migração 0006.
- Uma conta administrativa de desenvolvimento foi cadastrada manualmente no Neon Auth e autorizada na tabela privada, vinculada ao ID da conta. O e-mail não é divulgado no repositório.
- Não existem dados ou vagas reais carregados nesta fase.

## Separação de segurança

1. A página `/painel/` é acessível pela internet, mas não contém dados de anunciantes embutidos.
2. Neon Auth emite o token de autenticação para o usuário.
3. O browser envia o JWT à API da Cloudflare, sem uma senha administrativa.
4. A API encaminha ao RPC do Neon; **o banco rejeita quem não está autorizado**, inclusive usuários autenticados comuns.
5. A tabela `app_private.admin_operators` não é exposta. Há **um operador de desenvolvimento ativo**, criado manualmente; novos cadastros de usuário continuam bloqueados.
6. O esquema privado não tem permissões para `anonymous` nem `authenticated`.
7. O frontend jamais é um controle de segurança suficiente, a proteção é verificada no Neon em toda ação.

## Acesso administrativo de homologação

1. Abra https://frela-do-dia.l7526080.workers.dev/painel/.
2. Informe o e-mail **previamente cadastrado e autorizado** no Neon Auth e selecione **Enviar link seguro de acesso**.
3. Abra a mensagem na mesma conta de e-mail e siga o link recebido. Ele expira em **10 minutos**, e o reenvio possui um intervalo mínimo na interface.
4. O Neon Auth gerencia a sessão. O painel envia um JWT à API Cloudflare, que exige a presença do ID do usuário na tabela privada de administradores.
5. Faça logout ao terminar. Não compartilhe o link de acesso nem o token, e não utilize dados de pessoas reais enquanto a homologação não estiver concluída.

**Configuração:** o plugin Magic Link foi habilitado **somente no Neon de desenvolvimento**, com `disable_sign_up=true`; cadastro público por e-mail/senha permanece desativado. A conta criada ainda não possuía sessão autenticada quando a autorização foi registrada. O login por Magic Link comprova controle da caixa postal ao criar uma sessão.

**Acesso não é fornecido pelo e-mail digitado:** somente o JWT emitido pelo Neon para o ID autorizado libera as consultas. Não inserir operador diretamente a partir de uma requisição pública.


## Correção de sessão no Gmail / iPhone — 21/11/2026

Após o primeiro link de acesso, a interface mostrou **“Sessão expirada. Entre novamente.”** mesmo com uma sessão registrada no Neon Auth e com o e-mail verificado. O diagnóstico apontou que o código consultava somente `auth.token().data.token`; essa chamada não forneceu o token naquele contexto.

- O frontend passa a priorizar o **JWT retornado em `auth.getSession().data.session.token`**, conforme a documentação do plugin JWT do Neon; mantém `auth.token()` como alternativa para SDKs compatíveis.
- O valor é validado quanto ao formato JWT antes de ser enviado à API. Tokens opacos de sessão não são enviados como bearer.
- Um botão **“Tentar acessar novamente”** permite reconsultar a API sem reenviar e-mail enquanto houver sessão local.
- Se o navegador interno do Gmail não conseguir disponibilizar a sessão à API, orientar a abertura do painel no **Safari**, solicitando novo link somente quando necessário.
- Foram adicionados [testes de recuperação de token](../tests/admin-token.mjs) (quatro cenários) e revisadas as verificações estáticas.

**Estado confirmado:** e-mail verificado e uma sessão ativa no Neon Auth; testes simulados do código passaram. Ainda falta a confirmação de login completo no Safari/Gmail com um JWT real e a resposta da API ao token.

## Limitações registradas

- **Não foi confirmada uma sessão real de login via Magic Link no navegador.** A integração com o SDK do Neon é uma implementação cuja execução ponta a ponta ainda precisa de testes.
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
