# Frela do Dia | Documento de produto (rascunho)

## Problema
Pessoas com disponibilidade imediata têm dificuldade para localizar trabalhos pontuais com informações claras sobre remuneração, duração, local e exigências. Pequenas empresas têm dificuldade para encontrar apoio eventual com agilidade.

## Público inicial
- Trabalhadores que buscam diárias, turnos, atividades temporárias e eventos.
- Empresas, organizadores e contratantes locais na região de Ijuí/RS.

## Funcionalidades projetadas

### Trabalhador
- Conta e perfil com cidade, qualificações, experiência, horários e funções preferidas.
- Currículo opcional e controle de visibilidade do perfil.
- Busca com filtros e candidaturas rastreáveis.
- Alertas somente mediante consentimento.

### Contratante
- Cadastro com verificação de responsável/empresa e contato.
- Vaga com título, categoria, endereço aproximado público e endereço exato privado, tarefas, requisitos objetivos, valor total, duração, horário, quantidade de vagas, forma e prazo do pagamento.
- Revisão de anúncio antes de publicar.
- Gestão de candidaturas, encerramento da vaga e registro das condições combinadas.

### Administração
- Aprovação de empresas e oportunidades; canal de denúncias.
- Suspensão de contas/anúncios suspeitos e trilha de auditoria.
- Política de privacidade, termos de uso e canal para titulares de dados.


## Evolução proposta: trabalho, agenda e comércio local

O site mantém sua identidade visual atual e terá três áreas funcionais:
1. **Trabalhos e vagas:** serviços pontuais (inclusive anúncios de moradores), temporários e empregos fixos, com categorias e regras de contratação distintas.
2. **Minha agenda e conversas:** eventos do trabalhador, entrevistas e compromissos; chat privado por candidatura e notificações opcionais.
3. **Comércio de Ijuí:** novidades, ofertas e alterações de horários em seção própria, sem misturar promoções a vagas.

Os controles do anunciante terão **encerrar/preenchida**, expiração automática e **duplicar para novo rascunho**. A duplicação nunca replica candidaturas, mensagens ou pagamentos, exigindo confirmação dos novos detalhes.

Funcionalidades comerciais propostas: anúncio de vaga fixa, destaque opcional, avisos de comércio e planos mensais. Os valores ainda são hipóteses sem validação. O trabalhador não paga para buscar ou se candidatar.

Todas as extensões que tratam de dados pessoais dependerão de autenticação, RLS, moderação e testes reais no Neon, antes de serem disponibilizadas ao público.

Detalhes, ordem de implementação, termos de segurança e referências: [EXPANSAO_REGIONAL_E_MONETIZACAO.md](EXPANSAO_REGIONAL_E_MONETIZACAO.md).

## Estado da interface demonstrativa — 20/11/2026

A tela de anúncio já permite simular escolha de **pessoa física** ou **empresa**, bem como **serviço pontual, diária/temporário ou emprego fixo**. O painel do contratante permite marcar posições preenchidas, encerrar vagas e duplicar anúncios com confirmação de novos dados. A agenda pode guardar compromissos **apenas no aparelho**.

**Isso não corresponde a contas ou processos reais.** Até conectar o Neon e validar as políticas de autorização, não há autenticação, moderação operacional, candidaturas, cobrança ou sincronização entre dispositivos. Chat, notificações push e mural comercial continuam planejados.

## Avaliações e contestações: adiadas
As notas bilaterais e a contestação de falta de pagamento **não serão oferecidas no lançamento inicial**. A proposta foi preservada em [funcionalidades futuras](FUTURE_REVIEWS.md). O MVP não publicará acusações, reputações nem mensagens de disputa.

## Modelo de receita — hipótese para validação
- Busca e candidatura gratuitas.
- Currículo básico gratuito; premium opcional por R$ 7,99.
- Vagas comuns gratuitas na fase de aquisição; destaque de vaga e plano para empresas no futuro.

Valores são hipóteses comerciais, não preços definitivos.

## Restrições antes do lançamento
- Validar demanda de empresas locais antes de desenvolver funcionalidades complexas.
- Cumprir a LGPD: minimização de dados, base legal, prazos de retenção e controles de acesso.
- Proteger contatos/endereço exato e prevenir exposição de currículos.
- Proibir exigências discriminatórias; critérios de higiene/segurança devem ser necessários e pertinentes à função.
- Evitar apresentar serviço autônomo como substituto automático das obrigações trabalhistas aplicáveis.
- Implantar moderação, mecanismos contra fraudes e aviso de não garantia de contratação.

## Critérios de aceite do MVP real
- Empresa não verificada não publica anúncio público.
- Candidatura só chega ao contratante autorizado, com consentimento informado.
- Vaga expirada não aparece como disponível.
- Dados pessoais não são divulgados em páginas públicas por padrão.
- Pagamento de serviços de destaque só é liberado após confirmação do provedor.
