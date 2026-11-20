-- Frela do Dia | 0002: políticas RLS (Neon Auth + Data API)
-- PRÉ-REQUISITOS: executar 0001, ativar Neon Auth + Data API,
-- e verificar se os papéis anonymous/authenticated e auth.user_id() existem.
-- NÃO executar em Supabase ou outro backend sem adaptação.
-- Não conceder credenciais de owner/DB à aplicação no navegador.
BEGIN;

-- Cada nova tabela inicia em negação explícita para usuários da Data API.
ALTER TABLE public.worker_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_postings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_private_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.worker_profiles,
  public.companies,
  public.job_postings,
  public.job_private_locations,
  public.applications,
  public.engagements,
  public.reviews
FROM PUBLIC, anonymous, authenticated;

GRANT USAGE ON SCHEMA public TO anonymous, authenticated;

-- PERFIS: cada pessoa pode ler e editar apenas o próprio perfil.
-- Excluir dados/arquivos definitivamente: operação auditável no backend.
CREATE POLICY worker_profiles_self_select ON public.worker_profiles
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.user_id()));
CREATE POLICY worker_profiles_self_insert ON public.worker_profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.user_id()));
CREATE POLICY worker_profiles_self_update ON public.worker_profiles
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.user_id()))
  WITH CHECK (user_id = (SELECT auth.user_id()));
GRANT SELECT, INSERT, UPDATE ON public.worker_profiles TO authenticated;

-- EMPRESAS: os dados legais e contatos privados são do proprietário.
-- Criação sempre pendente; verificação/suspensão são ações administrativas.
CREATE POLICY companies_owner_select ON public.companies
  FOR SELECT TO authenticated
  USING (owner_user_id = (SELECT auth.user_id()));
CREATE POLICY companies_owner_request ON public.companies
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_user_id = (SELECT auth.user_id())
    AND verification_state = 'pending'
  );
GRANT SELECT, INSERT ON public.companies TO authenticated;

-- VAGAS: qualquer visitante pode consultar APENAS vagas publicadas e
-- ainda não encerradas. Nenhum campo privado de localização está nesta tabela.
CREATE POLICY job_postings_public_list ON public.job_postings
  FOR SELECT TO anonymous, authenticated
  USING (status = 'published' AND ends_at > now());
CREATE POLICY job_postings_company_own_list ON public.job_postings
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = public.job_postings.company_id
        AND c.owner_user_id = (SELECT auth.user_id())
    )
  );
-- Empresa verificada pode SOLICITAR publicação, mas não aprovar anúncios.
CREATE POLICY job_postings_company_submit ON public.job_postings
  FOR INSERT TO authenticated
  WITH CHECK (
    status = 'pending'
    AND published_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = public.job_postings.company_id
        AND c.owner_user_id = (SELECT auth.user_id())
        AND c.verification_state = 'verified'
    )
  );
GRANT SELECT ON public.job_postings TO anonymous, authenticated;
GRANT INSERT ON public.job_postings TO authenticated;
-- UPDATE, DELETE e alterações de status: somente backend confiável.

-- Endereço completo: visível ao dono da empresa ou a trabalhador designado
-- para a vaga. Não pode ser lido por um candidato comum.
CREATE POLICY job_private_locations_authorized_read ON public.job_private_locations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.job_postings j
      JOIN public.companies c ON c.id = j.company_id
      WHERE j.id = public.job_private_locations.job_id AND c.owner_user_id = (SELECT auth.user_id())
    )
    OR EXISTS (
      SELECT 1 FROM public.engagements e
      WHERE e.job_id = public.job_private_locations.job_id
        AND e.worker_user_id = (SELECT auth.user_id())
        AND e.status IN ('accepted','completed')
    )
  );
GRANT SELECT ON public.job_private_locations TO authenticated;
-- Endereços são inseridos/atualizados por API autenticada e validada.

-- CANDIDATURAS: pessoa se candidata apenas em seu nome, a vaga aberta.
CREATE POLICY applications_worker_insert ON public.applications
  FOR INSERT TO authenticated
  WITH CHECK (
    applicant_user_id = (SELECT auth.user_id())
    AND status = 'submitted'
    AND EXISTS (
      SELECT 1 FROM public.job_postings j
      WHERE j.id = public.applications.job_id
        AND j.status = 'published'
        AND j.ends_at > now()
    )
  );
-- Candidato lê apenas suas candidaturas; empresa lê apenas candidaturas
-- das vagas da qual é proprietária.
CREATE POLICY applications_participants_select ON public.applications
  FOR SELECT TO authenticated
  USING (
    applicant_user_id = (SELECT auth.user_id())
    OR EXISTS (
      SELECT 1 FROM public.job_postings j
      JOIN public.companies c ON c.id = j.company_id
      WHERE j.id = public.applications.job_id
        AND c.owner_user_id = (SELECT auth.user_id())
    )
  );
GRANT SELECT, INSERT ON public.applications TO authenticated;
-- Sem UPDATE/DELETE direto, inclusive sobre candidaturas alheias.

-- CONTRATAÇÕES: são confirmadas e concluídas exclusivamente por API de
-- confiança; usuários só podem visualizá-las quando são participantes.
CREATE POLICY engagements_participants_select ON public.engagements
  FOR SELECT TO authenticated
  USING (
    worker_user_id = (SELECT auth.user_id())
    OR EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = public.engagements.company_id
        AND c.owner_user_id = (SELECT auth.user_id())
    )
  );
GRANT SELECT ON public.engagements TO authenticated;

-- AVALIAÇÕES: uma por lado em cada contratação (UNIQUE em 0001).
-- Não permitir notas antes de o serviço estar concluído.
-- Sem UPDATE, DELETE ou leitura da avaliação recebida nesta fase.
CREATE POLICY reviews_author_insert ON public.reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    author_user_id = (SELECT auth.user_id())
    AND moderation_state = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.engagements e
      WHERE e.id = public.reviews.engagement_id
        AND e.status = 'completed'
        AND (
          (author_side = 'worker'
            AND e.worker_user_id = (SELECT auth.user_id()))
          OR
          (author_side = 'company'
            AND EXISTS (
              SELECT 1 FROM public.companies c
              WHERE c.id = e.company_id
                AND c.owner_user_id = (SELECT auth.user_id())
            ))
        )
    )
  );
CREATE POLICY reviews_author_select ON public.reviews
  FOR SELECT TO authenticated
  USING (author_user_id = (SELECT auth.user_id()));
GRANT SELECT, INSERT ON public.reviews TO authenticated;

-- Conferência rápida em ambiente Neon:
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname = 'public' AND tablename IN
-- ('worker_profiles','companies','job_postings','job_private_locations',
--  'applications','engagements','reviews');
-- SELECT * FROM pg_policies WHERE schemaname = 'public';
COMMIT;
