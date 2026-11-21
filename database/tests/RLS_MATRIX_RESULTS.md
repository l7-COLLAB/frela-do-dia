# Matriz de isolamento por identidade — resultados de 20/11/2026

**Ambiente:** Neon `frela-do-dia`, branch `authorization-tests` (clone de `development-rls`). Execução em transação única.

## Método e limitações

Para não criar contas com e-mails fictícios nem expor credenciais, foi substituída **temporariamente, dentro de uma transação reversível**, a função `public.frela_auth_user_id()` por um stub que obtém a identidade de um parâmetro de teste definido na sessão. A função original foi restaurada por `ROLLBACK TO SAVEPOINT`, confirmado por consulta a `pg_get_functiondef`.

Esse mecanismo testa o comportamento de filtros e de RLS com diferentes identidades. **Não testa a assinatura, a emissão, a expiração nem a validação de JWTs do Neon Auth.**

Foram criados transitoriamente: dois perfis de trabalhadores, duas empresas, dois contratantes PF, quatro anúncios (três disponíveis e um preenchido), candidaturas e contratações vinculadas, além de dois endereços privados.

## Consultas e resultados

| Identidade simulada | Perfis visíveis | Empresas próprias | PF próprias | Vagas visíveis | Candidaturas | Contratações | Endereços completos |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Visitante anônimo | sem permissão | sem permissão | sem permissão | 3 | sem permissão | sem permissão | sem permissão |
| Trabalhador A | 1 | 0 | 0 | 3 | 1 | 1 | 1 |
| Trabalhador B | 1 | 0 | 0 | 3 | 1 | 1 | 1 |
| Empresa A | 0 | 1 | 0 | 4 | 1 | 1 | 1 |
| Pessoa física B | 0 | 0 | 1 | 3 | 1 | 1 | 1 |

A empresa A visualiza seu próprio anúncio preenchido no painel; o visitante e os demais usuários não o recebem entre vagas disponíveis.

**Após rollback:** zero perfis, zero empresas, zero pessoas físicas e zero vagas dos testes. A função `public.frela_auth_user_id()` original voltou a chamar `auth.user_id()`.

## Bloqueios antes da produção

- [ ] Login com usuários de teste e JWTs **reais** do Neon Auth.
- [ ] Consultas equivalentes via Data API HTTP, com tokens válidos de contas distintas.
- [ ] Verificar explicitamente revogação de sessão e tentativas de acesso cruzado por ID.
- [ ] Realizar testes de integração no Safari (iPhone), Android e desktop.
- [ ] Não publicar o ambiente `authorization-tests` com a função de teste ativa; **nenhuma substituição permanece ativa segundo a consulta final**.

Os scripts e políticas oficiais para produção continuam em [migrações 0001–0005](../migrations). Não adicionar parâmetros de identidade simulada ao código publicado.
