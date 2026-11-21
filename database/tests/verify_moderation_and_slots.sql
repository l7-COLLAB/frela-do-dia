-- Apenas em authorization-tests / ambiente isolado: teste de moderação e lotação.
-- Todos os registros devem ser revertidos pela transação de teste.
SAVEPOINT frela_moderation_test;

INSERT INTO public.companies(id,owner_user_id,legal_name,display_name,city)
VALUES
 ('00000000-0000-4000-9000-000000000101','fixture-admin-company-a','Empresa A Teste Ltda','Empresa A Teste','Ijuí'),
 ('00000000-0000-4000-9000-000000000102','fixture-admin-company-b','Empresa B Teste Ltda','Empresa B Teste','Ijuí');

INSERT INTO public.individual_hirers(id,owner_user_id,display_name,city)
VALUES ('00000000-0000-4000-9000-000000000103','fixture-admin-pf-a','Pessoa A Teste','Ijuí');

INSERT INTO public.job_postings
 (id,company_id,title,company_display_name,city,category,tasks,starts_at,ends_at,
  pay_cents,payment_terms,slots,application_deadline)
VALUES
 ('00000000-0000-4000-9000-000000000201',
  '00000000-0000-4000-9000-000000000101','Auxiliar de evento','Empresa A Teste','Ijuí','Eventos',
  'Recepcionar convidados e organizar materiais.',
  now()+interval '7 days',now()+interval '7 days 6 hours',12000,'Pix após o serviço',
  1,now()+interval '3 days'),
 ('00000000-0000-4000-9000-000000000202',
  '00000000-0000-4000-9000-000000000102','Trabalho empresa B','Empresa B Teste','Ijuí','Eventos',
  'Apoio operacional em outro evento da cidade.',
  now()+interval '7 days',now()+interval '7 days 4 hours',11000,'Pix após o serviço',
  1,now()+interval '3 days');

INSERT INTO public.job_postings
 (id,individual_hirer_id,title,company_display_name,city,category,tasks,
  starts_at,ends_at,pay_cents,payment_terms,slots,application_deadline)
VALUES
 ('00000000-0000-4000-9000-000000000203',
  '00000000-0000-4000-9000-000000000103','Auxiliar de mudança','Pessoa A Teste','Ijuí','Mudanças',
  'Descarregar caixas pequenas e auxiliar no transporte.',
  now()+interval '8 days',now()+interval '8 days 5 hours',10000,'Pix após o serviço',
  2,now()+interval '4 days');

SELECT app_private.review_hirer(
 'company','00000000-0000-4000-9000-000000000101','verified',
 'moderador-de-teste','Verificação administrativa fictícia da empresa A');
SELECT app_private.review_hirer(
 'individual_hirer','00000000-0000-4000-9000-000000000103','verified',
 'moderador-de-teste','Verificação administrativa fictícia da pessoa A');

DO $test$
DECLARE blocked boolean := false;
BEGIN
  BEGIN
    PERFORM app_private.review_job(
      '00000000-0000-4000-9000-000000000202','published',
      'moderador-de-teste','Tentativa inválida de aprovar empresa ainda pendente');
  EXCEPTION WHEN raise_exception THEN
    blocked := SQLERRM LIKE '%Verificação do contratante%';
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'ERRO: vaga de empresa não verificada foi aprovada'; END IF;
END;
$test$;

SELECT app_private.review_job(
 '00000000-0000-4000-9000-000000000201','published',
 'moderador-de-teste','Anúncio de exemplo revisado e conforme regras');
SELECT app_private.review_job(
 '00000000-0000-4000-9000-000000000203','published',
 'moderador-de-teste','Anúncio de pessoa física conferido para o teste');

INSERT INTO public.applications(id,job_id,applicant_user_id)
VALUES
 ('00000000-0000-4000-9000-000000000301',
  '00000000-0000-4000-9000-000000000201','trabalhador-de-teste-a'),
 ('00000000-0000-4000-9000-000000000302',
  '00000000-0000-4000-9000-000000000201','trabalhador-de-teste-b');

SELECT app_private.accept_application(
 '00000000-0000-4000-9000-000000000301',
 'moderador-de-teste','Trabalhador escolhido após revisão de candidatura') AS accepted_engagement;

DO $test$
DECLARE blocked boolean := false;
BEGIN
  BEGIN
    PERFORM app_private.accept_application(
      '00000000-0000-4000-9000-000000000302',
      'moderador-de-teste','Segunda contratação deve ser barrada por lotação');
  EXCEPTION WHEN raise_exception THEN
    blocked := SQLERRM LIKE '%Vaga não está mais disponível%';
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'ERRO: segunda seleção excedeu lotação'; END IF;
END;
$test$;

SELECT
  (SELECT verification_state FROM public.companies
   WHERE id='00000000-0000-4000-9000-000000000101') AS company_a,
  (SELECT verification_state FROM public.companies
   WHERE id='00000000-0000-4000-9000-000000000102') AS company_b,
  (SELECT status FROM public.job_postings
   WHERE id='00000000-0000-4000-9000-000000000201') AS job_status,
  (SELECT filled_slots FROM public.job_postings
   WHERE id='00000000-0000-4000-9000-000000000201') AS filled_slots,
  (SELECT count(*) FROM public.engagements) AS confirmed_engagements,
  (SELECT count(*) FROM app_private.audit_events) AS audits,
  has_schema_privilege('authenticated','app_private','USAGE') AS auth_schema_access,
  has_function_privilege('authenticated',
    'app_private.accept_application(uuid,text,text)','EXECUTE') AS auth_can_accept;

ROLLBACK TO SAVEPOINT frela_moderation_test;

SELECT
  (SELECT count(*) FROM public.companies) AS companies_remaining,
  (SELECT count(*) FROM public.individual_hirers) AS pf_remaining,
  (SELECT count(*) FROM public.job_postings) AS jobs_remaining,
  (SELECT count(*) FROM public.applications) AS applications_remaining,
  (SELECT count(*) FROM public.engagements) AS engagements_remaining,
  (SELECT count(*) FROM app_private.audit_events) AS audits_remaining;
