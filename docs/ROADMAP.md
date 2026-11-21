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
- [ ] Implementar verificação de identidade e moderação real para PF e PJ
- [x] Diferenciar, na interface demonstrativa, emprego fixo, diária e serviço pontual
- [x] Modelar os três tipos de vaga no Neon de testes, com regras de remuneração
- [ ] Integrar os três tipos às APIs reais e ao painel administrativo
- [x] Simular preenchimento de vagas, encerramento manual e expiração por data no navegador
- [ ] Implementar bloqueio real de candidaturas e lotação em transações seguras
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
- [ ] Publicar, testar e integrar login à interface principal
- [ ] Homologar banco, autenticação e RLS antes de abrir cadastros
- [ ] Cadastro e verificação de empresas/contratantes
- [ ] Gestão real de vagas, expiração e moderação
- [ ] Candidaturas com privacidade e confirmação de envio
- [ ] Painel administrativo e trilha de auditoria
- [ ] Termos, política de privacidade e controles LGPD
- [ ] Testes de acessibilidade e fluxos mobile

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
