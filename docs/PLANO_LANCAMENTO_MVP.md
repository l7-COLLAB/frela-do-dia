# Plano de lançamento MVP — Frela do Dia
Data: 2026-11-21
Estado: execução por etapas. NÃO liberar inscrições públicas nem usar dados reais antes da homologação.

## Etapa 1 — Identidade, dados e segurança (EM EXECUÇÃO)
- [x] Identificar projeto Neon frela-do-dia, branch `development-rls` e branch `production`.
- [x] Confirmar 7 tabelas públicas na branch de desenvolvimento com RLS habilitada.
- [x] Confirmar Neon Auth ativo somente em `development-rls`.
- [x] Confirmar que `production` não possui as tabelas públicas do MVP nem Neon Auth.
- [x] Confirmar existência da rota `/conta/` com cadastro público desabilitado no código.
- [ ] Homologar login/senha, recuperação OTP, logout, sessão e persistência em navegadores reais.
- [ ] Testar dois trabalhadores e duas empresas, com JWTs reais, isolamento e negativas de acesso.
- [ ] Finalizar termos, privacidade, antifraude e e-mails transacionais.
- [ ] Configurar inscrição pública com confirmação, rate limiting e proteção contra bots APENAS no momento apropriado.
**Critério de aceite:** cadastro e dados persistem entre sessões e dispositivos; acesso cruzado é negado; não há exposição de segredos.

## Etapa 2 — Categorias, vagas e pesquisa
- [ ] Criar taxonomia de 16 categorias, profissões e aliases inclusivos, validando atualização no frontend e banco.
- [ ] Ligar publicação real de anúncio aos perfis de empresas/PF verificadas.
- [ ] Moderação antes da publicação; expiração e encerramento automáticos.
- [ ] Busca por profissão, modalidade, cidade, turno e remuneração.
- [ ] Remover amostras fictícias da experiência pública.
**Critério de aceite:** vaga real aprovada aparece nos filtros; vaga expirada/encerrada não aparece.

## Etapa 3 — Candidaturas e contratação
- [ ] Candidatura autenticada, confirmação, histórico e privacidade.
- [ ] Contratante autorizado vê apenas candidaturas da própria vaga.
- [ ] Seleção/lotação transacional; fechamento de posições.
- [ ] Registro de status e informações combinadas, sem prometer garantia de pagamento.
**Critério de aceite:** fluxo ponta a ponta com múltiplos usuários e concorrência controlada.

## Etapa 4 — Administração
- [ ] Confirmar moderação PF/PJ, vagas e denúncias no painel real.
- [ ] Testar acesso do administrador em Safari e desktop.
- [ ] Homologar indicadores, preços de pacotes, clientes pagantes e trilha de auditoria.
- [ ] Não habilitar cobrança sem checkout, conciliação e recibos reais.
**Critério de aceite:** decisões administrativas aplicadas e auditadas sem acesso de usuário comum.

## Etapa 5 — Segurança, conformidade, qualidade
- [ ] Termos/privacidade, consentimento de notificações e direitos LGPD.
- [ ] Prevenção de fraude, canal de denúncia, limites de requisição, proteção do endereço exato.
- [ ] Testes automatizados e manuais iPhone Safari/Chrome, Android e desktop.
- [ ] Testes de acessibilidade, performance, falhas e backups.
**Critério de aceite:** zero falhas bloqueantes e zero vazamentos observados nas matrizes de permissão.

## Etapa 6 — Produção e piloto Ijuí
- [ ] Revisar migrações 0001–0009, criar backup e checklist de rollback.
- [ ] Aplicar esquema e configurar Neon Auth em `production` apenas após homologação.
- [ ] Confirmar domínio, HTTPS, e-mail de suporte, monitoramento e erros.
- [ ] Criar piloto controlado de anunciantes e trabalhadores reais, com consentimento.
- [ ] Medir vagas publicadas, candidaturas, vagas preenchidas e incidentes.
**Critério de aceite:** lançamento gradual com suporte e rollback disponível.

## Verificação observada em 2026-11-21
- Repositório: `l7-COLLAB/frela-do-dia` (branch `main`).
- Neon project: `patient-morning-04134066`.
- Desenvolvimento: `br-flat-pine-bcokt9x3` (`development-rls`): 7 tabelas `public` com `rowsecurity=true`, Neon Auth ativo.
- Produção: `br-raspy-hall-bcdsw4ve` (`production`): sem tabelas de produto e sem Neon Auth.
- Isto é uma auditoria estrutural; não significa fluxo real de login/candidatura homologado.
