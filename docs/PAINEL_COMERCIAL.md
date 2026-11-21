# Painel comercial e financeiro — Frela do Dia

**Implementado em 21/11/2026:** área administrativa dentro de [`/painel/`](https://frela-do-dia.l7526080.workers.dev/painel/), conectada ao Neon **development-rls**. A API da Cloudflare está publicada. A página inicial do Frela do Dia continua demonstrativa e não possui cobrança real.

## Navegação administrativa

| Área | Dados apresentados | Origem |
| --- | --- | --- |
| Visão geral | Empresas, PFs, trabalhadores, vagas abertas, clientes que pagaram e receita bruta confirmada | Tabelas do Neon de desenvolvimento |
| Moderação | Empresas, pessoas físicas e vagas pendentes, com aprovação/rejeição | `frela_admin_queue` e `frela_admin_decide` |
| Anunciantes | Empresas e pessoas físicas cadastradas, por situação de verificação | `companies` e `individual_hirers` |
| Pacotes e preços | Seis produtos comerciais, preço em R$, regras de uso, alteração confirmada e justificada | `app_private.commercial_offers` |
| Financeiro | Clientes pagantes, recibos e receita confirmada | `app_private.billing_receipts` |
| Histórico | Mudanças de preço e justificativas | `app_private.commercial_price_history` |

O catálogo usa **hipóteses previamente escolhidas**, não preços publicados para compra:

| Produto | Valor inicial |
| --- | ---: |
| Emprego fixo — 30 dias | R$ 19,90 |
| Destaque de vaga — 7 dias | R$ 14,90 |
| Aviso comercial — 7 dias | R$ 9,90 |
| Plano Comércio Local — até 4 anúncios em 30 dias | R$ 29,90/mês |
| Plano Empresas — até 3 vagas em 30 dias | R$ 49,90/mês |
| Currículo premium | R$ 7,99 |

Buscar vagas, candidatar-se e anúncios gratuitos previstos **não** fazem parte do catálogo pago.

## Como alterar um valor

1. Entre no painel com a conta administrativa autorizada.
2. Abra **Pacotes e preços**.
3. Digite o novo valor, em reais, e uma justificativa (mínimo 10 caracteres).
4. Clique em **Salvar valor** e confirme.
5. A API envia `p_code`, `p_price_cents`, `p_expected_revision` e `p_reason` ao Neon Auth/RPC.
6. O banco verifica a identidade administrativa, grava o novo preço, incrementa a versão e registra o preço anterior e novo no histórico. Se outra sessão já tiver alterado o valor, a atualização antiga é recusada.

**Editar preços não inicia cobrança, não cria faturas e não altera pedidos históricos.** O catálogo está no estado `draft`. A integração comercial com checkout só poderá ser ativada após testes do provedor, termos, moderação, webhook assinado e conciliação de pagamentos.

## O que significa "cliente pagante"

No painel, um cliente entra na lista de pagantes **somente quando existe lançamento com status `paid`** associado ao seu identificador. Os totais de receita somam exclusivamente pagamentos confirmados. O mesmo cliente é contado uma única vez na contagem de pagantes.

Os registros de cobrança foram estruturados, mas **não há gateway de pagamento conectado nem pagamentos registrados**. Assim, os indicadores começam em zero, sem dados fictícios. Um anunciante cadastrado **não é automaticamente um cliente pagante**.

Nenhum botão público permite criar um pagamento, marcar uma transação como paga ou alterar a receita. Isso deverá ser responsabilidade de um componente confiável no backend após a confirmação do provedor, com proteção contra eventos repetidos e manipulações.

## Segurança

- Migração [0008](../database/migrations/0008_commercial_admin.sql) aplicada somente ao Neon `development-rls`.
- Tabelas comerciais no schema `app_private` possuem RLS, sem privilégios de leitura/escrita para roles públicas.
- Funções `frela_admin_commercial` e `frela_admin_change_price` exigem JWT válido **e operador ativo na allowlist privada**. A mera sessão autenticada não confere permissão de administração.
- API Cloudflare expõe `GET /v1/admin/business` e `POST /v1/admin/pricing` somente com bearer token. Campos e parâmetros de preços possuem validação no Worker e no PostgreSQL.
- O Worker não possui senha PostgreSQL, chave de serviço administrativa nem permissão para criar recibos.
- Mudanças de preços geram histórico; alterações concorrentes obsoletas são rejeitadas.
- Endereços particulares, contatos privados e informações bancárias não são enviados ao painel comercial.

## Testes verificados

- [x] Migração 0008 aplicada primeiro na branch isolada `authorization-tests`; depois em `development-rls`.
- [x] Teste de acesso negado a operador não autorizado.
- [x] Teste transacional de atualização de preço, revisão, histórico e conflito por versão (rollback confirmado).
- [x] Teste de API com token simulado aceito, sem token rejeitado, preço negativo e justificativa insuficiente rejeitados.
- [x] Renderização simulada no frontend com preços BRL, cards, clientes e dados vazios, sem números inventados.
- [x] Cloudflare confirmou implantação do Worker de API com as rotas comerciais.
- [ ] **Pendente:** homologar as novas telas e a alteração de preço usando sessão administrativa real no Safari/Chrome do iPhone.
- [ ] **Pendente:** implementar gateway Pix/cartão, webhooks, emissão de recibos, assinaturas e reconciliação financeira.

A branch Neon `production` continua isolada das migrações de desenvolvimento.
