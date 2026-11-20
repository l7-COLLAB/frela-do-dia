# Neon — configuração e implantação do Frela do Dia

**Status:** migrações propostas, ainda NÃO executadas no banco. Site público continua como demonstração.

## Arquitetura

- GitHub `l7-COLLAB/frela-do-dia`: código, documentação e migrações.
- Cloudflare Worker: hospedagem atual da demonstração e futuro backend de confiança.
- Neon PostgreSQL: banco exclusivo do Frela do Dia.
- Managed Neon Auth (Better Auth) + Neon Data API: login e JWT autenticado, com RLS nativa do PostgreSQL.

**Nunca compartilhar chave administrativa, URL com senha do PostgreSQL, secret JWT ou token de API em chat, GitHub, HTML público, log ou tela de usuário.**
Apenas URLs públicas de serviço e configurações publicáveis podem ir ao front-end.

## Pré-requisitos

1. Criar o projeto separado `frela-do-dia` em https://console.neon.tech/ (plano Free).
2. Selecionar a região disponível mais próxima dos usuários brasileiros.
3. Habilitar **Managed Neon Auth** e **Data API** no projeto e criar uma branch de teste.
4. Confirmar os papéis PostgreSQL `anonymous`, `authenticated` e a função `auth.user_id()`; não usar o SQL se a configuração de identidade for diferente.
5. Usar o console SQL com conexão administrativa **somente na branch de teste**.

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

Cada arquivo contém uma transação `BEGIN ... COMMIT`. **Nunca aplicar 0001 sem 0002 em um banco já aberto ao público.** Ainda que 0001 bloqueie o acesso, o produto ficará inoperante até configurar as políticas.

Depois, executar [verify_access.sql](../database/tests/verify_access.sql) e os testes com usuários reais de teste.

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

## Decisão de escopo (20/11/2026)

As seis tabelas iniciais tratam de perfis, empresas, vagas, endereços privados, candidaturas e contratações. **Avaliações, notas e contestações de pagamento não serão criadas nesta fase.** Nenhuma migração posterior de disputa deve ser executada sem nova aprovação e revisão de segurança.
