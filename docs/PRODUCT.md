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


## Avaliações bilaterais (projeto de funcionalidade)
- A avaliação só poderá ser criada depois de a contratação ser registrada, confirmada e concluída.
- Trabalhador avalia contratante: pagamento do valor anunciado, cumprimento de intervalos informados, escopo das tarefas e condições de segurança.
- Contratante avalia trabalhador: comparecimento, pontualidade, cumprimento do período, execução das atividades e comunicação.
- Uma avaliação por lado e por contratação; notas de 1 a 5, critérios objetivos e comentário opcional.
- Cada parte avalia independentemente; o desenho definitivo deve evitar influência ou retaliação por nota.
- Condições factuais potencialmente controvertidas (não pagamento, desvio de função, intervalo não concedido) deverão ter fluxo privado de contestação e análise.
- Não transformar denúncias, notas isoladas ou avaliações não verificadas em penalidades automáticas ou afirmações públicas.
- Perfil público exibirá apenas dados agregados quando houver amostra suficiente e moderação efetiva, respeitando LGPD e normas aplicáveis.
- Demonstração atual: avaliações fictícias guardadas somente no navegador do dispositivo, sem autenticação, comprovação de prestação ou publicação.

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
