# Frela do Dia

**Protótipo responsivo** de uma plataforma regional para oportunidades de trabalho por diária, turno, evento e serviço temporário. Versão inicial focada em Ijuí (RS) e cidades próximas.

> **ATENÇÃO — demonstração:** todas as vagas são fictícias. Nenhuma candidatura, publicação, cadastro ou pagamento é enviado a um servidor. Não use o site para oferecer vagas reais antes de implementar autenticação, moderação, proteção de dados e rotas de contato seguras.

## Funcionalidades desta versão

- Página inicial com vitrine de oportunidades fictícias.
- Pesquisa e filtros de vagas por cidade, área, data, valor e favoritos.
- Detalhes da vaga com atividades, remuneração, duração e requisitos.
- Formulário demonstrativo para contratantes simularem anúncios.
- Perfil profissional demonstrativo, armazenado localmente no dispositivo.
- Editor de currículo com três apresentações e exportação via impressão/PDF do navegador.
- Interface mobile-first, adequada para uso no Safari do iPhone.
- Formulário demonstrativo de contratação para **empresa ou pessoa física**, com serviços pontuais, diárias e empregos fixos.
- Painel **Meus anúncios**: preencher posições fictícias, encerrar e duplicar uma oportunidade de teste.
- **Minha agenda**: compromissos locais, sem sincronização nem notificações reais.

## Como executar

O projeto não depende de bibliotecas, instalação ou servidor:

1. Baixe o repositório e abra `index.html` em um navegador.
2. Para desenvolvimento local com servidor HTTP, opcionalmente execute `python3 -m http.server 8000` na pasta do projeto e visite `http://localhost:8000`.
3. Para validar a estrutura e a sintaxe do JavaScript, execute `node tests/smoke.mjs` (Node.js 20 ou superior).

## Publicação futura (GitHub Pages)

Quando decidir tornar a demonstração pública: abra **Settings → Pages → Build and deployment**, escolha `Deploy from a branch`, selecione `main` e `/ (root)`. O site está no `index.html`, pronto para hospedagem estática.

**Nota:** a publicação da demo não transforma o sistema em um serviço real. Dados introduzidos nos formulários ficam apenas no navegador; não há backend e nenhuma vaga é verificada.

## Banco de dados e segurança (Neon — testes configurados)

A arquitetura planejada usará **Neon PostgreSQL + Managed Neon Auth + Data API**, com RLS e um backend seguro na Cloudflare.

- [Guia de configuração e testes](docs/NEON_SETUP.md)
- [Funcionalidades futuras: avaliações e contestação privada](docs/FUTURE_REVIEWS.md)
- [Esquema inicial](database/migrations/0001_initial_schema.sql)
- [Políticas RLS](database/migrations/0002_rls_policies.sql)
- [Ponte de identidade do Neon Auth](database/migrations/0003_neon_auth_rls_bridge.sql)
- [Contratantes pessoa física e modalidades de vaga](database/migrations/0004_individual_hirers_and_job_types.sql)
- [RLS de pessoas físicas, vagas e candidaturas](database/migrations/0005_individual_hirer_rls.sql)
- [Moderação privada auditada e seleção de candidaturas](database/migrations/0006_private_moderation_and_hiring.sql)
- [Regras administrativas e critérios de homologação](docs/MODERACAO_E_OPERACOES.md)
- [Teste de integridade PF/PJ](database/tests/verify_hirer_and_jobs.sql)
- [Teste de negação sem JWT](database/tests/verify_roles_no_jwt.sql)
- [Auditoria SQL](database/tests/verify_access.sql)

**Migrações 0001 a 0006 aplicadas exclusivamente na branch Neon `development-rls` do projeto `frela-do-dia` (20/11/2026).** A branch `production` continua sem o esquema do MVP. Foram validados RLS nas **sete tabelas**, privilégios estruturais, integridade dos anunciantes e negação de acesso sem JWT válido. Falta homologar com usuários e tokens reais antes de qualquer publicação.
O site público ainda é uma demonstração sem login real. Não informe dados pessoais reais nos formulários de teste.
Executar `node tests/rls-static.mjs` para conferir algumas invariantes do código. Esse teste **não comprova** autorização real; será necessário testar com usuários distintos e tokens válidos depois de conectar o Neon.

## Painel administrativo no site público (acesso restrito)

Acesse **https://frela-do-dia.l7526080.workers.dev/painel/**. O Worker público agora oferece a página administrativa e seu JavaScript em rotas próprias, sem interferir na demonstração de vagas. Há um link discreto no rodapé do site.

O formulário usa **Neon Auth**, e a API da Cloudflare consulta o Neon com JWT. A autorização administrativa depende de uma allowlist privada. **Uma conta de desenvolvimento está previamente autorizada**, mas só poderá entrar após comprovar controle do e-mail por Magic Link e obter um JWT válido. A [migração 0007](database/migrations/0007_admin_dashboard_access.sql) foi executada **somente em `development-rls`**, e os testes simulados negaram acesso a usuários comuns e comprovaram uma aprovação auditada com rollback. Há uma conta administrativa de homologação criada; inscrições públicas, vagas e contratações reais continuam desativadas.

A Cloudflare confirmou o deployment dos dois Workers e habilitação dos subdomínios, mas não foi possível verificar diretamente a resposta HTTP externa desta sessão. O login com JWT real ainda precisa ser homologado. [Instruções e limitações](admin/README.md).

## Moderação e contratação — banco de desenvolvimento

Adicionada a camada `app_private` no Neon para verificação de empresas/PF, aprovação de vagas e seleção com limite de posições. **Funções privadas não podem ser chamadas por usuários comuns**. Todos os atos ficam em trilha de auditoria no banco. Os testes confirmaram bloqueio de anúncio não verificado, encerramento após lotação e suspensão de anúncios de contratante suspenso.

**A funcionalidade administrativa ainda não foi ativada no site nem na API pública.** Não há painel administrativo conectado, credenciais de serviço ou usuários de teste com JWT válido. Consulte [documentação de moderação](docs/MODERACAO_E_OPERACOES.md).

## API Cloudflare de desenvolvimento (somente leitura)

Uma API independente foi implantada na Cloudflare em `frela-do-dia-api-dev`, sem modificar o site principal. O código está em [backend/dev-readonly-worker.js](backend/dev-readonly-worker.js) e a documentação em [backend/README.md](backend/README.md).

A API aceita apenas `GET` em vagas públicas e perfis autorizados. Encaminha tokens de login para a Neon Data API validar e aplicar RLS; não possui senha PostgreSQL nem poderes de publicação. A Cloudflare confirmou upload e subdomínio habilitados, mas **a resposta HTTP do Worker não pôde ser testada externamente** nesta sessão.

O [cliente de homologação](auth-preview/README.md) já aponta para essa API. Testes estáticos e de simulação de HTTP foram adicionados, mas **o login real com JWT válido ainda não foi comprovado**.

## Autenticação em desenvolvimento

O código do [módulo de login de homologação](auth-preview/README.md) foi preparado com o SDK oficial **Neon Auth**, usando URL de autenticação pública e a Data API da branch de teste. Inclui login por e-mail/senha, restauração de sessão, leitura do próprio perfil com JWT, logout e mensagens de erro.

**O módulo ainda não está implantado na página pública**. O cadastro público no Neon de desenvolvimento continua **desativado**; não há usuário de teste autenticado com senha disponível nesta conversa. Os testes com JWTs de diferentes usuários e o fluxo completo no navegador permanecem pendentes. Nunca usar credenciais administrativas ou URL PostgreSQL no frontend.

## Planejamento de novas funcionalidades

- [Expansão regional, contratação por pessoas físicas, agenda, chat, notificações e monetização](docs/EXPANSAO_REGIONAL_E_MONETIZACAO.md)
- **Status:** parte das interfaces demonstrativas foi implementada, mas funcionalidades reais de login, candidaturas, chat, anúncios pagos e integração Neon continuam pendentes.

## Roadmap

Consulte [docs/ROADMAP.md](docs/ROADMAP.md) para prioridades e [docs/PRODUCT.md](docs/PRODUCT.md) para escopo e regras de negócio.

## Decisões técnicas

- **Fase 0 (atual):** HTML, CSS e JavaScript sem dependências. Simulação via `localStorage`.
- **Fase 1 (MVP):** autenticação, empresas verificadas, vagas reais moderadas, candidaturas e dados protegidos.
- **Fase 2:** perfis profissionais, alertas e currículo premium opcional.

Ainda **não foi escolhida uma licença de código aberto**. Todos os direitos permanecem reservados até decisão explícita da proprietária.