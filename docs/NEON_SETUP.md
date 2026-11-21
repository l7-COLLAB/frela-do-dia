# Neon — configuração e implantação do Frela do Dia

**Status em 20/11/2026:** projeto Neon gratuito `frela-do-dia` criado. Branch de testes `development-rls` com Neon Auth, Data API e migrações **0001 a 0007 aplicadas**. As sete tabelas do MVP estão com RLS habilitada, incluindo `individual_hirers`. A branch `production` **não recebeu o esquema do MVP**. Site público continua como demonstração, sem banco conectado.

## Arquitetura

- GitHub `l7-COLLAB/frela-do-dia`: código, documentação e migrações.
- Cloudflare Worker: hospedagem atual da demonstração e futuro backend de confiança.
- Neon PostgreSQL: banco exclusivo do Frela do Dia.
- Managed Neon Auth (Better Auth) + Neon Data API: login e JWT autenticado, com RLS nativa do PostgreSQL.

**Nunca compartilhar chave administrativa, URL com senha do PostgreSQL, secret JWT ou token de API em chat, GitHub, HTML público, log ou tela de usuário.**
Apenas URLs públicas de serviço e configurações publicáveis podem ir ao front-end.

## Pré-requisitos

1. [Concluído em teste] Criar o projeto separado `frela-do-dia` em https://console.neon.tech/ (plano Free).
2. [Concluído] Região `aws-us-east-1` (Virginia), selecionada para viabilizar Functions e Storage, sujeitos à disponibilidade e cotas do plano.
3. [Concluído na branch de testes] Habilitar **Managed Neon Auth** e **Data API**; por segurança, cadastro público **desativado**, exigência de verificação de e-mail ativada.
4. [Concluído] Confirmar os papéis PostgreSQL `anonymous`, `authenticated` e a função `auth.user_id()`; não usar o SQL se a configuração de identidade for diferente.
5. [Concluído] Aplicar e verificar as migrações **somente na branch de teste**.

### Verificação de pré-requisitos

```sql
SELECT to_regprocedure('auth.user_id()') AS neon_auth_uid_function;
SELECT rolname FROM pg_roles
 WHERE rolname IN ('anonymous', 'authenticated')
 ORDER BY rolname;
```

A primeira consulta deve retornar uma função, e a segunda deve retornar os dois papéis.
Se não retornar, **pare** e configure Auth/Data API. A função de identidade não pode ser substituída por um valor fornecido pelo navegador.

## Aplicar as migrações

Executar na ordem, separadamente, após fazer uma branch de teste:

1. [0001_initial_schema.sql](../database/migrations/0001_initial_schema.sql): tabelas, chaves, restrições, RLS ligada e permissões fechadas por padrão.
2. [0002_rls_policies.sql](../database/migrations/0002_rls_policies.sql): permissões por usuário e regras de visibilidade.
3. [0003_neon_auth_rls_bridge.sql](../database/migrations/0003_neon_auth_rls_bridge.sql): função intermediária e políticas ajustadas ao esquema gerenciado `auth` do Neon. **É indispensável nesta configuração**: o papel `authenticated` não tem acesso direto ao schema `auth` administrado por `cloud_admin`.
4. [0004_individual_hirers_and_job_types.sql](../database/migrations/0004_individual_hirers_and_job_types.sql): contratantes PF, associação exclusiva PF/PJ, emprego fixo, diárias e lotação.
5. [0005_individual_hirer_rls.sql](../database/migrations/0005_individual_hirer_rls.sql): políticas RLS de PF e revisão dos acessos a anúncios, candidaturas e contratações.
6. [0006_private_moderation_and_hiring.sql](../database/migrations/0006_private_moderation_and_hiring.sql): schema `app_private`, funções administrativas de verificação e publicação, seleção de candidatura com limite de vagas e trilha de auditoria.
7. [0007_admin_dashboard_access.sql](../database/migrations/0007_admin_dashboard_access.sql): allowlist privada de operadores, consulta de pendências e decisões administrativas via RPC autorizado por identidade Neon Auth.

Cada arquivo contém uma transação `BEGIN ... COMMIT`. **Executar 0001 → 0002 → 0003 → 0004 → 0005 → 0006 → 0007 nesta ordem, apenas em ambiente controlado e sem usuários reais.** A migração 0001 já habilita RLS e nega permissões, mas a aplicação só poderá operar após todas as políticas e testes.

Depois, executar [verify_access.sql](../database/tests/verify_access.sql), [verify_hirer_and_jobs.sql](../database/tests/verify_hirer_and_jobs.sql), [verify_roles_no_jwt.sql](../database/tests/verify_roles_no_jwt.sql) e os testes com JWTs reais emitidos pelo Neon Auth. Os três primeiros testes **passaram** no ambiente de desenvolvimento em 20/11/2026; os testes ponta a ponta com sessões válidas ainda estão pendentes.

Após 0006, executar também [verify_moderation_security.sql](../database/tests/verify_moderation_security.sql). O teste reversível de seleção e moderação está em [verify_moderation_and_slots.sql](../database/tests/verify_moderation_and_slots.sql): passou na branch isolada `authorization-tests` e deixou zero registros fictícios.

## Testes obrigatórios antes do lançamento

Usar contas de teste independentes: trabalhador A, trabalhador B, empresa A, empresa B e administrador com função confiável.

1. Sem login: ler vagas publicadas futuras; não conseguir ler perfis, empresas, candidaturas ou endereços.
2. Trabalhador A: consegue ler/editar seu próprio perfil; não consegue ler/editar perfil do trabalhador B.
3. Trabalhador A: insere candidatura apenas para si mesmo em vaga publicada e válida. Tentativa em vaga encerrada falha.
4. Empresa A: vê apenas seus dados e candidaturas de vagas próprias. Não lê candidaturas da empresa B.
5. Empresa não verificada: não publica uma vaga diretamente. Empresa verificada insere apenas vaga em estado pendente; não altera o estado para publicada.
6. Trabalhador sem contratação aceita: não acessa endereço exato. Participante com contratação aceita: acessa somente o endereço da própria vaga.
7. Trabalhador/empresa: não consegue criar contratação concluída diretamente nem mudar status de candidatura.
8. Realizar esses testes via **Data API com tokens válidos emitidos pelo Neon Auth**, não apenas com usuário superprivilegiado no SQL Editor.

## Backend e cuidados de segurança

- A aprovação de empresas, publicação de vagas, confirmação de contratações, endereços completos e moderação de anúncios exigem endpoints de backend com autorização explícita e logs de auditoria.
- Não basta existir RLS: funções e processos administrativos que usam credenciais privilegiadas podem contorná-la. Proteger estas credenciais em Secrets da Cloudflare e limitar seu escopo.
- Antes de adicionar uploads de currículo, definir autorização de leitura de objetos, tamanho/formato permitido, retenção e exclusão; RLS de tabelas não protege automaticamente arquivos no Object Storage.
- RLS protege linhas; para políticas LGPD, também são necessários consentimentos/base legal, transparência, minimização, exclusão, respostas a titulares e procedimentos para incidentes.
- Avaliações e disputas sobre pagamentos estão fora do MVP. A proposta futura está documentada em [FUTURE_REVIEWS.md](FUTURE_REVIEWS.md).
- Não ativar cadastramento real nem recolher currículos enquanto essas verificações não forem concluídas.

## Referências técnicas

- https://neon.com/docs/
- https://neon.com/blog/a-postgrest-compatible-data-api-now-on-neon
- https://neon.com/blog/neon-auth-branchable-identity-in-your-database

## Integração com o site

A versão atual em `index.html` usa dados fictícios e `localStorage`. Isso foi preservado propositalmente.
A implementação do login e das chamadas reais será uma etapa posterior ao sucesso dos testes de RLS.

## Painel administrativo na rota pública (acesso restrito)

O [painel](../admin/README.md) está publicado em `/painel/`, sem substituir a página de vagas. A API da Cloudflare encaminha o JWT à Neon Data API, que autentica e executa `frela_admin_queue` e `frela_admin_decide`. Ambas exigem um operador **ativo** cadastrado exclusivamente no schema privado. Não existem contas administrativas autorizadas ainda. Não inserir credenciais no GitHub.

A migração 0007 foi executada no Neon `development-rls`. O [teste reversível](../database/tests/verify_admin_rpc_simulated.sql) passou em branch isolada: usuário sem permissão foi bloqueado; administrador simulado consultou e aprovou um cadastro; trilha de auditoria foi criada; todos os dados de teste foram revertidos.

**Não considerar lançamento real:** a implementação do login ainda não foi testada com JWT válido em navegador real, e a publicação HTTP do site não pôde ser acessada pela ferramenta de verificação externa. O Worker principal foi atualizado via API e a Cloudflare confirmou implantação e subdomínio habilitado.

## Moderação administrativa no desenvolvimento

O módulo [MODERACAO_E_OPERACOES.md](MODERACAO_E_OPERACOES.md) descreve a migração 0006. Empresas e pessoas físicas só podem obter estado verificado por decisão administrativa; anúncios pendentes só podem ser publicados após revisão. A função privada de seleção confirma uma candidatura por vez, bloqueia lotação excessiva e fecha o anúncio ao atingir todas as posições.

A trilha `app_private.audit_events` é privada, protegida por RLS, e o schema não está exposto na Data API. Funções administrativas são `SECURITY INVOKER`, sem permissão de EXECUTE para usuários comuns. O backend administrativo futuro deverá autenticar o operador e guardar credenciais em Secrets. **Esse backend ainda não existe** e a API de desenvolvimento continua somente leitura.

## Decisão de escopo (20/11/2026)

As seis tabelas iniciais tratam de perfis, empresas, vagas, endereços privados, candidaturas e contratações. **Avaliações, notas e contestações de pagamento não serão criadas nesta fase.** Nenhuma migração posterior de disputa deve ser executada sem nova aprovação e revisão de segurança.

## Autenticação no frontend (homologação, não em produção)

O diretório [auth-preview](../auth-preview/README.md) contém a primeira integração com o SDK Neon Auth: login, sessão, logout e consulta ao próprio perfil com JWT. Para executar, usar Node.js, `npm install` e variáveis públicas `VITE_NEON_AUTH_URL` / `VITE_FRELA_API_URL` específicas da branch `development-rls`.

A configuração do desenvolvimento mantém **novas inscrições desativadas**, exige confirmação de e-mail e restringe origens da Data API ao site conhecido e a `http://localhost:5173`. Não publicar esse módulo no site principal antes de homologar autenticação, segurança, regras de moderação e requisitos LGPD. Nenhuma senha ou segredo está versionado.
