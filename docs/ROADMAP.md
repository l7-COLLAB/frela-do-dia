# Roadmap de desenvolvimento

## Fase 0 — Protótipo
- [x] Página inicial responsiva
- [x] Filtros e visualização de vagas fictícias
- [x] Perfil de trabalhador demonstrativo
- [x] Publicação demonstrativa de oportunidades
- [x] Currículo com modelos e opção de PDF
- [x] Avisos claros de demonstração
- [x] Avaliações removidas da demonstração inicial, com proposta arquivada para fase futura

## Fase 1 — Validação da demanda (próxima)
- [ ] Entrevistar ao menos 10 empresas locais
- [ ] Validar quais tipos de serviços e diárias têm demanda
- [ ] Entrevistar trabalhadores sobre disponibilidade e confiança
- [ ] Definir política de moderação, critérios e regras de publicação
- [ ] Validar a marca e disponibilidade de domínio

## Decisão de produto — expansão regional aprovada para planejamento
- [x] Pesquisar recursos e opções de monetização regional sem modificar a interface pública
- [x] Demonstrar formulário para empresas e pessoas físicas
- [x] Criar tabela PF separada e políticas RLS por proprietário no Neon de testes
- [x] Preparar funções SQL privadas para verificar/suspender contratantes, com auditoria
- [x] Publicar rota `/painel/` com interface administrativa responsiva e acesso no rodapé
- [x] Criar allowlist privada de operadores e funções RPC protegidas por autenticação
- [x] Integrar frontend do painel à API Cloudflare de desenvolvimento, com validação e auditabilidade
- [x] Executar teste reversível de acesso negado a usuário comum e decisão administrativa simulada
- [x] Criar conta administrativa de desenvolvimento com e-mail verificado
- [x] Substituir login Magic Link do painel por e-mail/senha e recuperação OTP
- [x] Registrar exclusivamente a identidade administrativa autorizada no Neon de desenvolvimento
- [ ] Definir primeira senha via OTP real, validar login com JWT no Safari e desktop
- [ ] Implementar validação documental e homologação de moderação real para PF e PJ
- [x] Diferenciar, na interface demonstrativa, emprego fixo, diária e serviço pontual
- [x] Modelar os três tipos de vaga no Neon de testes, com regras de remuneração
- [ ] Integrar os três tipos às APIs reais e ao painel administrativo
- [x] Simular preenchimento de vagas, encerramento manual e expiração por data no navegador
- [x] Testar operação transacional de seleção e lotação no banco Neon de desenvolvimento
- [ ] Integrar essa operação à API administrativa com autorização e testes concorrentes
- [x] Demonstrar duplicação com confirmação de data, horário, remuneração e quantidade, sem copiar candidaturas
- [ ] Implementar duplicação no backend como novo rascunho sujeito a revisão
- [x] Demonstrar agenda pessoal com compromissos salvos no aparelho
- [ ] Sincronizar agenda privada por conta autenticada, com lembretes e exportação
- [ ] Adicionar conversa privada entre participantes de candidaturas autenticadas (chat simples, sem anexos)
- [ ] Adicionar PWA e notificações opt-in para iPhone e Android (novas vagas, mensagens e agenda)
- [ ] Criar anúncios de emprego fixo e destaques pagos, após validar demanda
- [ ] Criar mural comercial separado com ofertas, notícias de empresas e horários especiais
- [ ] Criar planos mensais para anunciantes após homologar checkout e conciliação
- [ ] Ver [especificação e preços de teste](EXPANSAO_REGIONAL_E_MONETIZACAO.md)

## Implementação dos cadastros — 21/11/2026

- [x] Criar `/conta/` com login, recuperação de senha, sessão e formulários de trabalhador, PF e empresa
- [x] Criar RPCs próprias com validação de campos, identidade vinda do JWT e proteção RLS
- [x] Testar duas identidades fictícias, isolamento, edição e bloqueio de duplicidades com rollback
- [x] Publicar página e API de perfis separadamente da administração, sem alterar o visual da home
- [x] Atualizar cache da Data API e validar permissões no Neon de desenvolvimento
- [x] Confirmar GitHub Actions passando nos testes de onboarding
- [ ] Homologar salvamento no iPhone com a conta administrativa de teste
- [ ] Finalizar termos, privacidade, antifraude, e-mail e testes com dois logins reais distintos
- [ ] Abrir inscrição pública somente após homologação e migração para `production`
- [ ] Conectar publicação de vagas e candidaturas a partir dos novos perfis

## Fase 2 — MVP funcional
- [x] Modelar tabelas e registrar políticas Neon RLS no GitHub
- [x] Criar projeto Neon `frela-do-dia` e branch de testes `development-rls`
- [x] Habilitar Neon Auth e Data API na branch de testes; novos cadastros desativados
- [x] Executar migrações 0001, 0002 e 0003 na branch de testes, com verificação estrutural
- [x] Documentar matriz de acesso, testes estáticos e guia de homologação
- [x] Conectar projeto Neon e aplicar migrações em branch de teste
- [x] Executar testes de integridade do banco e negativas de acesso sem token
- [ ] Executar testes reais com contas e JWTs distintos (pendente)
- [ ] Definir arquitetura e ambiente separados dos outros projetos
- [x] Preparar módulo de login Neon Auth em diretório de homologação no GitHub
- [x] Preparar API Cloudflare de desenvolvimento somente leitura, com JWT obrigatório nas rotas privadas
- [x] Conectar código do login de homologação à API Cloudflare (sem publicar o login público)
- [x] Executar matriz de RLS com identidades simuladas, em transação reversível
- [ ] Testar endpoints da API Cloudflare por HTTP externo e autenticação com JWT válido
- [x] Publicar login e perfis em rota separada `/conta/` (contas de homologação)
- [ ] Integrar a sessão Neon ao restante da interface pública após homologação
- [ ] Homologar banco, autenticação e RLS antes de abrir cadastros
- [ ] Cadastro e verificação de empresas/contratantes
- [ ] Gestão real de vagas, expiração e moderação
- [ ] Candidaturas com privacidade e confirmação de envio
- [x] Estruturar trilha de auditoria privada e funções com privilégios restritos no banco de teste
- [ ] Construir painel administrativo com revisão e registro de decisões
- [ ] Termos, política de privacidade e controles LGPD
- [ ] Testes de acessibilidade e fluxos mobile

## Entregas da administração comercial — 21/11/2026

- [x] Visão geral do negócio no painel, com indicadores reais do Neon de desenvolvimento
- [x] Relação de empresas e pessoas físicas cadastradas com filtro por situação
- [x] Catálogo dos seis preços de teste do planejamento, com edição e histórico auditável
- [x] Estrutura privada de recibos e lista de clientes pagantes sem inventar receita
- [x] API Cloudflare protegida por JWT/allowlist para leitura de negócio e edição de preços
- [x] Testes de preços, autorização, conflitos de versão e rollback na branch isolada
- [ ] Homologar edição de preços na sessão real do iPhone
- [ ] Conectar provedor Pix/cartão e validar webhooks assinados antes de ativar anúncios pagos
- [ ] Habilitar publicação comercial após integração de pagamento e moderação

## Fase 3 — Monetização e crescimento
- [ ] Perfis profissionais completos e currículo opcional
- [ ] Currículo premium e integração de pagamento por Pix
- [ ] Vagas destacadas e planos para contratantes
- [ ] Alertas por cidade, função e período, com opt-in
- [ ] Métricas de conversão e funil de aquisição local

## Fase futura (após o MVP estar consolidado)
- [ ] Avaliações bilaterais após conclusão de serviços e verificação da contratação
- [ ] Canal privado para contestação de pagamento e tentativa de acordo
- [ ] Critérios de comprovação, análise humana, recurso e linguagem pública proporcional
- [ ] Testes específicos de RLS, LGPD, antifraude e revisão jurídica
- [ ] Ver [proposta arquivada](FUTURE_REVIEWS.md)

## Fora do escopo inicial
- Intermediação financeira da remuneração do trabalhador
- Garantia de contratação e pagamento
- Avaliações públicas de pessoas sem política de moderação
