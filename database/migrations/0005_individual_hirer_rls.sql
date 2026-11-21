-- Frela do Dia | 0005: RLS para anunciantes PF e 3 modalidades
-- Executar depois de 0004, exclusivamente em ambiente de teste.
-- Sem acesso direto a pagamentos, documentos ou endereços residenciais.
BEGIN;

CREATE POLICY individual_hirers_self_select
ON public.individual_hirers FOR SELECT TO authenticated
USING (owner_user_id = (SELECT public.frela_auth_user_id()));

CREATE POLICY individual_hirers_self_insert
ON public.individual_hirers FOR INSERT TO authenticated
WITH CHECK (
  owner_user_id = (SELECT public.frela_auth_user_id())
  AND verification_state = 'pending'
);
GRANT SELECT, INSERT ON public.individual_hirers TO authenticated;

-- Disponibilidade de anúncios públicos: somente published, com posições e
-- prazo de candidatura. Nenhuma pessoa consegue alterar status diretamente.
ALTER POLICY job_postings_public_list ON public.job_postings
USING (
 status = 'published'
 AND filled_slots < slots
 AND COALESCE(application_deadline, starts_at) > now()
);

ALTER POLICY job_postings_company_own_list ON public.job_postings
USING (
 EXISTS (
   SELECT 1 FROM public.companies c
   WHERE c.id = public.job_postings.company_id
     AND c.owner_user_id = (SELECT public.frela_auth_user_id())
 )
 OR EXISTS (
   SELECT 1 FROM public.individual_hirers h
   WHERE h.id = public.job_postings.individual_hirer_id
     AND h.owner_user_id = (SELECT public.frela_auth_user_id())
 )
);

ALTER POLICY job_postings_company_submit ON public.job_postings
WITH CHECK (
 status = 'pending'
 AND published_at IS NULL
 AND filled_slots = 0
 AND (
   EXISTS (
     SELECT 1 FROM public.companies c
     WHERE c.id = public.job_postings.company_id
       AND c.owner_user_id = (SELECT public.frela_auth_user_id())
       AND c.verification_state = 'verified'
       AND c.display_name = public.job_postings.company_display_name
   )
   OR EXISTS (
     SELECT 1 FROM public.individual_hirers h
     WHERE h.id = public.job_postings.individual_hirer_id
       AND h.owner_user_id = (SELECT public.frela_auth_user_id())
       AND h.verification_state = 'verified'
       AND h.display_name = public.job_postings.company_display_name
   )
 )
);

ALTER POLICY job_private_locations_authorized_read ON public.job_private_locations
USING (
 EXISTS (
   SELECT 1 FROM public.job_postings j
   JOIN public.companies c ON c.id = j.company_id
   WHERE j.id = public.job_private_locations.job_id
     AND c.owner_user_id = (SELECT public.frela_auth_user_id())
 )
 OR EXISTS (
   SELECT 1 FROM public.job_postings j
   JOIN public.individual_hirers h ON h.id = j.individual_hirer_id
   WHERE j.id = public.job_private_locations.job_id
     AND h.owner_user_id = (SELECT public.frela_auth_user_id())
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
     AND j.filled_slots < j.slots
     AND COALESCE(j.application_deadline, j.starts_at) > now()
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
 OR EXISTS (
   SELECT 1 FROM public.job_postings j
   JOIN public.individual_hirers h ON h.id = j.individual_hirer_id
   WHERE j.id = public.applications.job_id
     AND h.owner_user_id = (SELECT public.frela_auth_user_id())
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
 OR EXISTS (
   SELECT 1 FROM public.individual_hirers h
   WHERE h.id = public.engagements.individual_hirer_id
     AND h.owner_user_id = (SELECT public.frela_auth_user_id())
 )
);

COMMIT;
