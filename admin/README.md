# Painel administrativo — Frela do Dia

**Endereço público:** https://frela-do-dia.l7526080.workers.dev/painel/

**Status:** interface implantada no Worker público em 20/11/2026, conectada **somente ao Neon de desenvolvimento**. Uma única conta administrativa de desenvolvimento foi cadastrada e autorizada. A interface atual usa **e-mail e senha**, com uma opção separada para definir a primeira senha por **código OTP enviado ao e-mail**. A sessão com JWT real ainda precisa ser homologada no navegador. A página pública de vagas permanece um protótipo com anúncios fictícios.

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

## Acesso administrativo de homologação — e-mail e senha

1. Abra **https://frela-do-dia.l7526080.workers.dev/painel/** no Safari.
2. Se ainda não definiu sua senha, selecione **Definir ou recuperar senha**.
3. Informe o **e-mail já autorizado** e clique em **Enviar código de verificação**.
4. Copie os seis números recebidos no Gmail, escolha uma senha de pelo menos **12 caracteres** e confirme-a. A senha é tratada exclusivamente pelo Neon Auth; não envie por chat.
5. Volte ao formulário principal, informe e-mail e senha e toque em **Entrar**.
6. A API mantém a verificação de JWT e a allowlist privada de operadores. Não são permitidos novos cadastros.

**Configuração Neon:** e-mail/senha habilitados, `disable_sign_up=true`, exigência de e-mail verificado e revogação de sessões antigas ao definir nova senha. A conta administrativa já existe, estava verificada e **não tinha credencial de senha** antes deste ajuste. O método Magic Link foi retirado da interface; a configuração de infraestrutura existente foi mantida temporariamente como contingência até a primeira entrada por senha ser homologada.

**Limitações de teste:** o envio e o consumo de um OTP real ainda não foram testados na caixa de entrada da titular. O fluxo foi preparado conforme os métodos `forgetPassword.emailOtp` e `emailOtp.resetPassword` documentados pelo Neon, com confirmação de senha, bloqueio de novas contas e senhas nunca persistidas pelo código do painel.

## Correção de sessão no Gmail / iPhone — 21/11/2026

Após o primeiro link de acesso, a interface mostrou **“Sessão expirada. Entre novamente.”** mesmo com uma sessão registrada no Neon Auth e com o e-mail verificado. O diagnóstico apontou que o código consultava somente `auth.token().data.token`; essa chamada não forneceu o token naquele contexto.

- O frontend passa a priorizar o **JWT retornado em `auth.getSession().data.session.token`**, conforme a documentação do plugin JWT do Neon; mantém `auth.token()` como alternativa para SDKs compatíveis.
- O valor é validado quanto ao formato JWT antes de ser enviado à API. Tokens opacos de sessão não são enviados como bearer.
- Um botão **“Tentar acessar novamente”** permite reconsultar a API sem reenviar e-mail enquanto houver sessão local.
- Se o navegador interno do Gmail não conseguir disponibilizar a sessão à API, orientar a abertura do painel no **Safari**, solicitando novo link somente quando necessário.
- Foram adicionados [testes de recuperação de token](../tests/admin-token.mjs) (quatro cenários) e revisadas as verificações estáticas.

**Estado confirmado:** e-mail verificado e uma sessão ativa no Neon Auth; testes simulados do código passaram. Ainda falta a confirmação de login completo no Safari/Gmail com um JWT real e a resposta da API ao token.

## Alteração de acesso — 21/11/2026

Após novas tentativas, o navegador interno do Gmail exibiu **“Sessão inválida ou expirada”** mesmo com o e-mail verificado. A decisão foi substituir o Magic Link na interface por **login com e-mail e senha**.

- [x] Formulário atualizado com dois campos: e-mail e senha.
- [x] Definição de primeira senha / recuperação por OTP de seis dígitos (opção recolhida).
- [x] Neon configurado para manter inscrição pública desativada, exigência de e-mail verificado e revogação de sessões na redefinição.
- [x] Rotina de teste simulado de autenticação por senha, solicitação do código e gravação da nova senha.
- [ ] A titular definir a primeira senha com OTP real e confirmar acesso no Safari.
- [ ] Homologar renovação de JWT e resposta dos endpoints administrativos com a sessão por senha.

## Correção do erro "Sessão inválida ou expirada" — 21/11/2026

A conta administrativa passou a ter credencial de senha registrada no Neon Auth, com e-mail verificado e autorização ativa, mas o painel ainda exibia `Sessão inválida ou expirada` após o login. A verificação do Worker de API revelou um defeito na expressão de validação do header Bearer.

- **Antes:** `/^Bearer [^\\\\s]+$/` dentro do JavaScript do Worker. A classe de caracteres incluía um escape incorreto e rejeitava tokens contendo a letra minúscula `s`.
- **Agora:** `/^Bearer [^\\s]+$/`, aceitando o token JWT codificado sem espaço em branco. A validação criptográfica do token **continua a cargo do Neon Data API**.
- O Worker `frela-do-dia-api-dev` foi atualizado via Cloudflare API, e uma leitura de confirmação mostrou a nova validação no código publicado.
- Um teste local de requisição simulada com JWT de exemplo contendo `s` retornou 200 e comprovou o encaminhamento intacto para o RPC; o caso foi acrescentado a `tests/dev-api.mjs`.
- A interface `admin/app.js` agora diferencia `authentication_required` e `token_rejected_by_neon`, facilitando diagnosticar uma eventual rejeição restante, sem expor tokens no navegador.
- **Ainda falta** confirmar a entrada real no Chrome ou Safari da titular após a correção; não alegar homologação sem observação real.

O código temporário de redefinição de senha que apareceu na captura da titular não foi utilizado nem copiado para repositórios ou documentação. **Nenhuma redefinição adicional da senha é necessária por causa deste bug.**

## Limitações registradas

- **Ainda não foi confirmada uma sessão administrativa funcional por e-mail e senha no navegador.** A integração com o SDK do Neon é uma implementação cuja execução ponta a ponta ainda precisa de testes.
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
