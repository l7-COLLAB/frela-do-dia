-- Frela do Dia | 0003: compatibilidade da RLS com Neon Auth no banco de testes
-- Observação: o schema auth é propriedade de cloud_admin no Neon.
-- O papel authenticated não tem USAGE direto no schema gerenciado, por isso
-- invocar auth.user_id() nas políticas gera erro 'permission denied for schema auth'.
-- O invólucro abaixo é SECURITY DEFINER, executa SOMENTE auth.user_id(),
-- fixa search_path e concede execução SOMENTE a authenticated.
-- Não inclui DELETE, DROP nem comandos de dados; aplicar após 0001 e 0002.
BEGIN;

CREATE OR REPLACE FUNCTION public.frela_auth_user_id() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $fn$ SELECT auth.user_id(); $fn$;

REVOKE ALL ON FUNCTION public.frela_auth_user_id() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.frela_auth_user_id() TO authenticated;

ALTER TABLE public.worker_profiles ALTER COLUMN user_id SET DEFAULT public.frela_auth_user_id();

ALTER TABLE public.companies ALTER COLUMN owner_user_id SET DEFAULT public.frela_auth_user_id();

ALTER TABLE public.applications ALTER COLUMN applicant_user_id SET DEFAULT public.frela_auth_user_id();

ALTER POLICY worker_profiles_self_select ON public.worker_profiles
USING (user_id = (SELECT public.frela_auth_user_id()));

ALTER POLICY worker_profiles_self_insert ON public.worker_profiles
WITH CHECK (user_id = (SELECT public.frela_auth_user_id()));

ALTER POLICY worker_profiles_self_update ON public.worker_profiles
USING (user_id = (SELECT public.frela_auth_user_id()))
  WITH CHECK (user_id = (SELECT public.frela_auth_user_id()));

ALTER POLICY companies_owner_select ON public.companies
USING (owner_user_id = (SELECT public.frela_auth_user_id()));

ALTER POLICY companies_owner_request ON public.companies
WITH CHECK (
    owner_user_id = (SELECT public.frela_auth_user_id())
    AND verification_state = 'pending'
  );

ALTER POLICY job_postings_company_own_list ON public.job_postings
USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = public.job_postings.company_id
        AND c.owner_user_id = (SELECT public.frela_auth_user_id())
    )
  );

ALTER POLICY job_postings_company_submit ON public.job_postings
WITH CHECK (
    status = 'pending'
    AND published_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = public.job_postings.company_id
        AND c.owner_user_id = (SELECT public.frela_auth_user_id())
        AND c.verification_state = 'verified'
    )
  );

ALTER POLICY job_private_locations_authorized_read ON public.job_private_locations
USING (
    EXISTS (
      SELECT 1 FROM public.job_postings j
      JOIN public.companies c ON c.id = j.company_id
      WHERE j.id = public.job_private_locations.job_id AND c.owner_user_id = (SELECT public.frela_auth_user_id())
    )
    OR EXISTS (
      SELECT 1 FROM public.engagements e
      WHERE e.job_id = public.job_private_locations.job_id
        AND e.worker_user_id = (SELECT public.frela_auth_user_id())
        AND e.status IN ('accepted','completed')
    )
  );

ALTER POLICY applications_worker_insert ON public.applications
WITH CHECK (
    applicant_user_id = (SELECT public.frela_auth_user_id())
    AND status = 'submitted'
    AND EXISTS (
      SELECT 1 FROM public.job_postings j
      WHERE j.id = public.applications.job_id
        AND j.status = 'published'
        AND j.ends_at > now()
    )
  );

ALTER POLICY applications_participants_select ON public.applications
USING (
    applicant_user_id = (SELECT public.frela_auth_user_id())
    OR EXISTS (
      SELECT 1 FROM public.job_postings j
      JOIN public.companies c ON c.id = j.company_id
      WHERE j.id = public.applications.job_id
        AND c.owner_user_id = (SELECT public.frela_auth_user_id())
    )
  );

ALTER POLICY engagements_participants_select ON public.engagements
USING (
    worker_user_id = (SELECT public.frela_auth_user_id())
    OR EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = public.engagements.company_id
        AND c.owner_user_id = (SELECT public.frela_auth_user_id())
    )
  );

COMMIT;
