# Contas de trabalhadores, pessoas físicas e empresas — Frela do Dia

**Entrega de 21/11/2026. Estado: homologação; inscrições públicas não liberadas.**

Rota publicada no Worker principal: https://frela-do-dia.l7526080.workers.dev/conta/

A nova área preserva a interface do protótipo e não substitui o fluxo demonstrativo de vagas. O login e a recuperação de senha usam Neon Auth; os cadastros de perfil são persistidos no Neon `development-rls` por RPCs, com autorização por JWT e RLS.

## Funções implementadas

| Perfil | Campos mínimos | Operação no Neon | Estado |
|---|---|---|---|
| Trabalhador | Nome para exibição, cidade, apresentação e disponibilidade opcionais | Criar/atualizar perfil próprio | Operacional para contas autorizadas de homologação |
| Contratante pessoa física | Nome de exibição, cidade | Criar solicitação de cadastro | Pendente de verificação administrativa |
| Empresa | Razão social, nome de exibição, cidade | Criar solicitação de cadastro | Pendente de verificação administrativa |

Cada identidade autenticada pode manter um perfil de trabalhador, uma PF contratante e uma empresa. A empresa/PF não recebe status `verified` automaticamente e não pode publicar vagas apenas por se cadastrar. A atualização de dados de empresa/PF foi adiada até existir fluxo seguro de revisão; evita trocar nomes depois de uma verificação.

A página contempla login por e-mail e senha, recuperação por OTP, restauração de sessão, logout, consulta de perfis e confirmação de persistência. A senha é tratada somente pelo Neon Auth. Os formulários não solicitam telefone, documentos ou endereços nesta etapa.

## API

Worker: `frela-do-dia-api-dev`, autenticado por JWT do Neon.

| Rota | Método | Função SQL |
|---|---|---|
| `/v1/account` | GET | `frela_account_self()` |
| `/v1/account/worker` | POST | `frela_account_save_worker(...)` |
| `/v1/account/individual` | POST | `frela_account_register_individual(...)` |
| `/v1/account/company` | POST | `frela_account_register_company(...)` |

- A API aceita somente campos explícitos; rejeita tentativas de informar `user_id`, `owner_user_id`, `verification_state` e outros valores controlados pelo banco.
- A identidade é determinada por `public.frela_auth_user_id()` (Neon JWT), não por parâmetros recebidos do frontend.
- As funções são `SECURITY INVOKER`, com RLS por proprietário; `anonymous` não pode executá-las.
- Os cadastros de PF/empresa entram como `pending`; a empresa só pode ter uma solicitação por identidade durante o MVP.
- O Worker não armazena token, senha, dados PostgreSQL nem credenciais administrativas.

Migração [0009_account_onboarding.sql](../database/migrations/0009_account_onboarding.sql). Teste reversível [verify_account_onboarding.sql](../database/tests/verify_account_onboarding.sql). Testes automatizados [account-onboarding.mjs](../tests/account-onboarding.mjs).

## Criação de conta e verificação de e-mail — preparada, não liberada

O frontend contém o fluxo futuro `signUp.email({name,email,password})` e a confirmação de e-mail com `emailOtp.verifyEmail({email,otp})`. O formulário só é mostrado se as duas condições explícitas `PUBLIC_SIGNUPS_OPEN` e `LEGAL_DOCUMENTS_READY` estiverem habilitadas.

No código atual **as duas estão `false`**, o botão permanece desabilitado e o Neon Auth continua com `allow_sign_up=false`, independentemente de alguém manipular a interface no navegador. Antes da liberação deverão existir termos e política de privacidade e novos testes reais de segurança/antifraude. Não alterar os flags isoladamente como substituto da configuração do servidor.

## Verificações concluídas

- [x] Migração aplicada primeiro na branch isolada `authorization-tests`, depois em `development-rls`.
- [x] Dois titulares fictícios criaram perfis distintos; as consultas protegidas retornaram apenas registros do titular da sessão.
- [x] Atualização do perfil do trabalhador persistiu; duplicação de PF/empresa foi rejeitada.
- [x] Testes de autorização sem JWT, entrada com campos extras, dados inválidos e origem CORS não autorizada.
- [x] Transação de testes revertida; nenhuma conta ou perfil fictício permaneceu gravado.
- [x] Neon continua com sete tabelas públicas sob RLS.
- [x] GitHub Actions concluiu os testes automáticos da implementação com sucesso.
- [x] Os Workers `frela-do-dia` e `frela-do-dia-api-dev` foram publicados e confirmados habilitados pela Cloudflare.

## Bloqueios antes da abertura de inscrições públicas

1. **Manter `allow_sign_up=false` no Neon de desenvolvimento.** A página informa que novos cadastros estão fechados, e o botão não permite simular inscrição que ainda não funciona. Login e perfis estão disponíveis somente para contas já autorizadas.
2. Revisar políticas LGPD, termos de uso, diretrizes contra discriminação e prevenção de fraude. Não aceitar dados pessoais reais do público enquanto não houver base e transparência de tratamento.
3. Implementar cadastro público com verificação do e-mail, limites de requisição, proteção anti-abuso e recuperação de senha. Habilitar apenas após testes com contas e JWTs válidos e distintos.
4. Migrar esquema RLS e código para **production** depois da homologação; a branch de produção continua sem as tabelas do MVP.
5. Testar login, saída, restauração de sessão, salvar perfil, tentar acessar dados alheios e recuperação no Safari e Chrome do iPhone, além de desktop.
6. Criar APIs de vagas reais, candidaturas e notificações transacionais antes de anunciar o site como plataforma funcional.
7. Configurar SMTP próprio, suporte e monitoramento de erros antes de abrir uso real.

## Fora do escopo desta etapa

Ainda não há inscrição pública habilitada, publicação de vagas reais, candidaturas funcionais, chat, notificações push, sincronização de agenda ou pagamentos. O site inicial permanece demonstração. O botão `Minha conta (homologação)` conduz à nova área, sem criar falsas expectativas de cadastro aberto.

**Referência:** [roadmap](ROADMAP.md), [documento do produto](PRODUCT.md), [segurança Neon](NEON_SETUP.md).
