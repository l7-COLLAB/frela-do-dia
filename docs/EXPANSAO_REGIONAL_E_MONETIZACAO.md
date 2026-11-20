# Frela do Dia | Expansão regional e monetização
**Data de planejamento:** 20/11/2026
**Status:** proposta de produto — **nada deste documento foi ativado no site público**.

## Posicionamento e diferenciação

Marketplace **regional de oportunidades de trabalho e contratações pontuais**, com vagas formais, apoio eventual de pessoas físicas e, como módulo separado, uma vitrine do comércio local. A característica central é **disponibilidade e informação atualizadas**.

Não concorrer apenas como mais um classificado de vagas ou portal de notícias. Empresas, moradores e trabalhadores precisam perceber uma utilidade concreta desde o primeiro anúncio.

Pesquisa de referência (novembro/2026):
- Sine de Ijuí: https://www.ijui.rs.gov.br/public/index.php/noticia/print-noticia/5042/sine-de-ijui-divulga-vagas-de-emprego-disponiveis-no-municipio/
- ACI Ijuí: https://aciijui.com.br/2026/04/17/conecte-divulgue-e-venda-mais-com-a-vitrine-aci/
- Rua do Comércio Ijuí: https://ruadocomercioijui.com.br/

## Proposta comercial: preços de teste (não são preços validados)

| Produto | Preço sugerido | Entrega inicial |
|---|---:|---|
| Buscar / candidatar-se | Grátis | Sem paywall para o trabalhador |
| Serviço pontual de pessoa física | Grátis no lançamento | Anúncio moderado, limites por conta |
| Serviço temporário de empresa | Grátis no lançamento | Uma forma de atrair oferta |
| Vaga de emprego fixo (30 dias) | R$ 19,90 | 1 anúncio, renovação manual |
| Destaque de vaga (7 dias) | R$ 14,90 | Aparece em destaque; identificado |
| Aviso comercial local (7 dias) | R$ 9,90 | Oferta, mudança de horário ou novidade |
| Plano Comércio Local (30 dias) | R$ 29,90 | Até 4 avisos, desconto sobre avulsos |
| Plano Empresas (30 dias) | R$ 49,90 | Até 3 vagas fixas, desconto sobre avulsos |
| Currículo premium (opcional) | R$ 7,99 | Modelo especial e edição |
 
**Teste comercial:** conversar com 10–15 empresas locais, conseguir publicações verificadas e validar disposição de pagar antes de lançar o checkout. Não prometer candidaturas ou contratações em troca da taxa de anúncio. Revisar atividade econômica e tributação antes de faturar.

## Funcionalidades por ordem de implementação

### P0 — Núcleo operacional indispensável
1. **Conta que atua como pessoa física ou empresa:** 
   - Mesmo usuário pode ter perfil de trabalhador e perfil de contratante; cada ação possui papel autorizado.
   - Contratante PF: nome de exibição, telefone/e-mail verificados (privados), cidade, bairro, tipo de serviço, valor, quantidade de pessoas, materiais, requisitos e riscos.
   - Empresa: CNPJ verificado internamente, nome fantasia e responsável com autorização; NÃO mostrar CPF, documentos ou telefone sem consentimento.
   - Para PF, limite inicial de anúncios ativos, checagem antifraude e moderação humana; verificação reforçada antes de liberar endereço exato.
2. **Tipo de anúncio distinto:** `servico_pontual`, `vaga_temporaria`, `vaga_fixa`.
   - Temporário: remuneração total, data, hora, duração, pausas combinadas, atividades e pagamento.
   - Fixo: regime de contratação, jornada, local, modalidade, salário ou faixa quando possível, benefícios, requisitos objetivos, como se candidatar e prazo.
   - Evitar sugerir que serviço recorrente/emprego fixo é automaticamente freelancer autônomo; revisão trabalhista.
3. **Ciclo de vida e lotação:** `draft → pending_review → published → partially_filled → filled / expired / cancelled`.
   - Encerrar automaticamente ao atingir todas as vagas confirmadas e impedir novas candidaturas.
   - Se preenchida: mostrar "Preenchida" por período curto em link direto; remover dos resultados de vagas abertas. Guardar histórico para contratante.
   - Expirar por prazo real e oferecer reabrir apenas com confirmação de condições; moderar mudanças substanciais.
   - Evitar condições de corrida: reserva/ocupação feita em transação atômica no backend; não confiar no contador do navegador.
4. **Duplicar vaga:** botão no painel do contratante → cria **rascunho novo** com título, tarefas, requisitos e valor copiados.
   - Exigir confirmação de nova data/horário, quantidade, valor e meio/prazo de pagamento antes de publicar.
   - Novo ID, novo ciclo de moderação, sem copiar candidaturas, mensagens, avaliações, pagamentos ou estado da vaga.
   - Recorrência de serviços é funcionalidade futura e precisa de limites contra spam.

### P1 — Melhorias para conversão
5. **Agenda do usuário:** candidaturas, entrevistas, turnos confirmados, lembretes manuais, filtro mensal/semanal e exportação ICS. 
   - Eventos privados por usuário; não mostrar localização completa ao público.
   - Inserir em "Meu perfil / Minha agenda"; não ampliar o menu principal até haver procura.
   - Evitar agendas conflitantes com avisos, não bloqueio compulsório.
6. **Mensagens internas:** uma conversa por candidatura (contratante + candidato), acessível somente às duas partes.
   - Sem contatos públicos obrigatórios; envio, recebimento, contagem não lida, bloqueio e denúncia.
   - RLS por participantes; verificação de autorização a cada mensagem; limites de frequência, auditoria, retenção, exclusão.
   - Começar com **mensagens assíncronas**. Indicador "digitando" e sockets/realtime só depois da validação.
   - Sem anexos na primeira versão do chat; anexos de pagamento e dados sensíveis exigem controle adicional.
7. **Notificações:** preferência granular: novas vagas da categoria/cidade, candidatura, mensagem, serviço amanhã, vaga encerrada.
   - Toda notificação é opt-in, com horários de silêncio, botão de cancelar e opção de receber por e-mail.
   - No iPhone, Web Push requer **web app adicionado à Tela de Início** (iOS 16.4+), permissão solicitada após gesto do usuário. Não disparar prompt no primeiro acesso.
   - Necessários manifesto PWA, ícones, service worker, HTTPS, armazenamento de subscriptions, servidor Web Push.
   - Hospedagem atual só serve / e /index.html; antes disso, configurar entrega de `manifest.webmanifest`, `sw.js`, ícones e demais assets.

### P2 — Monetização e retenção local
8. **Emprego fixo pago:** publicar e editar vagas no painel; validade visível, taxa explícita e pagamento por Pix/cartão.
   - Não cobrar para trabalhadores se candidatarem. Não garantir candidato/contratação.
   - Só liberar o anúncio após confirmação server-side de pagamento + moderação. Validar webhooks assinados e idempotência.
9. **Mural do comércio de Ijuí:** cartões de ofertas, inaugurações, mudanças de horário, eventos e serviços.
   - Campos: estabelecimento verificado, tipo de aviso, título, descrição, foto autorizada, validade, endereço público comercial, horário excepcional, link de contato.
   - Marcações "Publicidade" ou "Patrocinado" quando houver cobrança; ofertas com data de validade e condições claras.
   - Notificações de comércio **separadas** das notificações de emprego para evitar spam.
   - Exibir numa seção separada com acesso pela home, **não** misturar ofertas com vagas.
10. **Planos de anunciantes:** pagamentos e histórico financeiro, cotas por plano, renovação controlada, relatórios de visualizações/candidaturas (sem expor dados pessoais), nota fiscal conforme enquadramento.
11. **Ferramentas de produtividade da empresa:** modelos de anúncio, duplicação em lote com limite, relatórios de vagas preenchidas e contatos recebidos, favoritos de candidatos apenas com base legal e controles.

### P3 — Somente após haver tração
- Match por região/horário com explicabilidade e opt-in.
- Lista de serviços recorrentes, criada mediante confirmação de cada ocorrência.
- Avaliações, disputas e acordos de pagamento: **ADIADOS** conforme [FUTURE_REVIEWS.md](FUTURE_REVIEWS.md).

## Experiência e identidade visual (preservar protótipo aprovado)

Não redesenhar a home, cores ou fontes. Na etapa inicial:
- "Trabalho do dia" e "Emprego fixo" como filtros do mesmo catálogo de vagas.
- "Sou contratante" abre escolha "Empresa" ou "Pessoa física".
- "Minha agenda" e notificações ficam no Perfil.
- Chat aparece nas candidaturas autenticadas como "Conversas" (com contador discreto).
- "Comércio local" ganha bloco acessório próprio na home, depois uma seção independente.
- Anúncios encerrados com status claro e sem botão de candidatura.

## Segurança e conformidade

- Validar quem publica anúncios PF e PJ, denunciar vaga falsa, exigir requisitos de segurança e evitar discriminação.
- Exibir publicamente apenas bairro/cidade em serviços residenciais, nunca endereço completo antes da seleção.
- Separar tabelas privadas de visão pública; políticas RLS para identidade, candidaturas, chats, agendas e anúncios.
- Evitar cobrança ao candidato por intermediação; revisar enquadramento jurídico/CNAE e termos de contratação.
- Incluir condições e expiração em promoções, preço não enganoso, rótulos claros de publicidade.
- LGPD: minimização, base legal por finalidade, consentimento específico para avisos promocionais, exclusão de dados, controle de retenção.
- Não implantar novidades sensíveis sem autenticação real e teste com contas distintas.

## Medidas para validar o negócio

Antes de desenvolver chat em tempo real, assinaturas e ranking:
- 10–15 estabelecimentos consultados sobre anúncio de vagas.
- 5–10 contratantes reais interessados em serviço rápido, incluindo PF.
- Pelo menos 20–30 vagas/oportunidades publicadas com autorização, rastreando quantas são preenchidas.
- Medir visitas → cliques → candidaturas → preenchimento; e empresas que voltam a anunciar.
- Preço pago só após verificar resultado concreto. Metas são hipóteses de validação, não previsões.

## Fontes técnicas e regulatórias

- Web Push iOS: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- PWA / static assets: https://developers.cloudflare.com/workers/static-assets/
- Webhooks de pagamento: https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/notifications
- Identificação de anúncios: https://www.gov.br/mj/pt-br/assuntos/noticias/senacon-alerta-publicidade-nas-redes-sociais-deve-ser-claramente-identificada-1/
- Proteção de dados: https://www.gov.br/anpd/pt-br/acesso-a-informacao/perguntas-frequentes
- Não discriminação: https://www.planalto.gov.br/ccivil_03/leis/l9029.htm
