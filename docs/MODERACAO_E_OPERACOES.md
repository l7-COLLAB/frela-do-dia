# Moderação e seleção de trabalhadores — Frela do Dia

**Estado em 20/11/2026:** funções SQL auditadas aplicadas **somente na branch Neon `development-rls`**. Não existem painel administrativo conectado, usuários reais ou endpoints de escrita. A branch `production` continua isolada. **Não usar este módulo para operar contratações reais antes de concluir a homologação.**

## Princípios de segurança

O contratante cria uma solicitação em estado `pending`. A empresa ou pessoa física **não consegue atribuir a si mesma o estado `verified`** nem mudar uma vaga para `published`. Somente um backend com operador autenticado e autorizado poderá executar decisões de moderação.

As operações estão isoladas no schema `app_private`, fora dos schemas expostos pela Neon Data API. As três funções são `SECURITY INVOKER`, têm `search_path` fixo e **não** concedem EXECUTE nem USAGE a `anonymous` ou `authenticated`. O backend administrativo futuro deverá guardar suas credenciais em Secrets, autenticar o operador e verificar sua função; **não** é seguro aceitar um `operator_id` digitado pelo próprio anunciante como autorização.

Todos os resultados ficam registrados em `app_private.audit_events`, com operador, tipo da ação, registro afetado, estado anterior, novo estado, justificativa e data. O histórico de auditoria é privado.

## Regras implementadas no banco de desenvolvimento

### 1. Verificação de anunciantes

`app_private.review_hirer(kind, id, decision, operator_id, justification)`

- Pode tratar `company` ou `individual_hirer`.
- Autoriza `pending → verified` ou `pending → rejected`.
- Autoriza `verified → suspended`.
- Uma suspensão encerra os anúncios ainda `published` desse contratante e bloqueia novas publicações.
- Serviços/contratações anteriormente confirmados **não são cancelados automaticamente**: exigem análise administrativa específica, comunicação com as partes e preservação dos registros relevantes.
- Exige uma justificativa administrativa entre 10 e 1.200 caracteres e identificador do operador.

### 2. Aprovação ou rejeição de anúncios

`app_private.review_job(job_id, decision, operator_id, justification)`

- Apenas anúncios em `pending` podem ser avaliados.
- Para publicar, o contratante precisa estar `verified` e o nome público deve coincidir com o cadastro verificado.
- Não permite publicar vaga cujo prazo de candidatura já venceu ou que esteja preenchida.
- Registra aprovação/rejeição na auditoria.
- **Não pode ser chamada por usuários comuns.**

### 3. Aceitar uma candidatura e encerrar vaga preenchida

`app_private.accept_application(application_id, operator_id, justification)`

- Exige candidatura em `submitted` ou `shortlisted`, anúncio `published`, prazo válido e posição disponível.
- Usa bloqueios de linha (`FOR UPDATE`) para serializar a seleção e impede ultrapassar a lotação.
- Cria `engagements`, marca a candidatura como `accepted` e incrementa `filled_slots` em uma transação.
- Ao ocupar a última vaga, muda o anúncio para `closed`, impedindo novas candidaturas.
- **Interpretação:** `status='closed'` e `filled_slots=slots` representa preenchimento completo; `closed` com menos posições significa encerramento por outro motivo. A interface deve diferenciar os casos.
- Não envia e-mail, não processa remuneração e não executa contratação trabalhista formal por si só.

## Testes realmente executados

- [x] Migração `0006_private_moderation_and_hiring.sql` testada na branch isolada `authorization-tests` e, após correção, aplicada em `development-rls`.
- [x] Empresa em `pending` não teve seu anúncio aprovado.
- [x] Uma empresa e uma pessoa física verificadas tiveram anúncios de teste publicados.
- [x] Uma candidatura foi aceita; outra foi bloqueada após a lotação atingir 100%.
- [x] Ao suspender a PF, o anúncio já publicado foi automaticamente encerrado.
- [x] Operações registraram seis eventos de auditoria no teste.
- [x] Papéis `anonymous` e `authenticated` não têm acesso ao schema `app_private` nem às funções.
- [x] A auditoria de permissões passou na branch `development-rls`.
- [x] A transação de testes foi revertida; todos os registros sintéticos e eventos temporários foram eliminados.

[SQL do módulo administrativo](../database/migrations/0006_private_moderation_and_hiring.sql) · [Teste funcional reversível](../database/tests/verify_moderation_and_slots.sql) · [Auditoria de privilégios](../database/tests/verify_moderation_security.sql)

## Pendências para abrir o serviço de verdade

1. Criar identidade administrativa própria, com autenticação forte, função autorizada no backend e registro de sessão.
2. Projetar API administrativa **separada**, sem expor a conexão PostgreSQL privilegiada ao navegador ou ao GitHub.
3. Construir painel de revisão de empresas/PF e de vagas pendentes, com critérios de verificação e denúncia.
4. Criar APIs do anunciante para cadastrar/editar anúncios, duplicar como novo rascunho e encerrá-los, com permissões verificadas.
5. Executar testes ponta a ponta com **JWTs reais** de trabalhadores e contratantes distintos, inclusive tentativas de abuso.
6. Validar situações de concorrência real (duas aceitações simultâneas), sessão expirada, recuperação de conta, logs e limites de requisição.
7. Definir termos, privacidade, retenção documental, revisão de vagas enganosas e procedimento de reclamações sob a LGPD.
8. Integrar interface e banco na branch de produção **após** a homologação.

**Fora de escopo:** notas de avaliação e disputas de pagamento permanecem adiadas, conforme [FUTURE_REVIEWS.md](FUTURE_REVIEWS.md).
