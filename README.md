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

## Como executar

O projeto não depende de bibliotecas, instalação ou servidor:

1. Baixe o repositório e abra `index.html` em um navegador.
2. Para desenvolvimento local com servidor HTTP, opcionalmente execute `python3 -m http.server 8000` na pasta do projeto e visite `http://localhost:8000`.
3. Para validar a estrutura e a sintaxe do JavaScript, execute `node tests/smoke.mjs` (Node.js 20 ou superior).

## Publicação futura (GitHub Pages)

Quando decidir tornar a demonstração pública: abra **Settings → Pages → Build and deployment**, escolha `Deploy from a branch`, selecione `main` e `/ (root)`. O site está no `index.html`, pronto para hospedagem estática.

**Nota:** a publicação da demo não transforma o sistema em um serviço real. Dados introduzidos nos formulários ficam apenas no navegador; não há backend e nenhuma vaga é verificada.

## Banco de dados e segurança (Neon — em preparação)

A arquitetura planejada usará **Neon PostgreSQL + Managed Neon Auth + Data API**, com RLS e um backend seguro na Cloudflare.

- [Guia de configuração e testes](docs/NEON_SETUP.md)
- [Funcionalidades futuras: avaliações e contestação privada](docs/FUTURE_REVIEWS.md)
- [Esquema inicial](database/migrations/0001_initial_schema.sql)
- [Políticas RLS](database/migrations/0002_rls_policies.sql)
- [Auditoria SQL](database/tests/verify_access.sql)

**As migrações estão versionadas, mas não foram aplicadas a nenhum banco de dados.**
O site público ainda é uma demonstração sem login real. Não informe dados pessoais reais nos formulários de teste.
Executar `node tests/rls-static.mjs` para conferir algumas invariantes do código. Esse teste **não comprova** autorização real; será necessário testar com usuários distintos e tokens válidos depois de conectar o Neon.

## Planejamento de novas funcionalidades

- [Expansão regional, contratação por pessoas físicas, agenda, chat, notificações e monetização](docs/EXPANSAO_REGIONAL_E_MONETIZACAO.md)
- **Status:** plano documentado, não implementado. O protótipo público continua inalterado.

## Roadmap

Consulte [docs/ROADMAP.md](docs/ROADMAP.md) para prioridades e [docs/PRODUCT.md](docs/PRODUCT.md) para escopo e regras de negócio.

## Decisões técnicas

- **Fase 0 (atual):** HTML, CSS e JavaScript sem dependências. Simulação via `localStorage`.
- **Fase 1 (MVP):** autenticação, empresas verificadas, vagas reais moderadas, candidaturas e dados protegidos.
- **Fase 2:** perfis profissionais, alertas e currículo premium opcional.

Ainda **não foi escolhida uma licença de código aberto**. Todos os direitos permanecem reservados até decisão explícita da proprietária.