-- Transação isolada: identidades fictícias A e B e rollback obrigatório.
SAVEPOINT frela_onboarding_check;
CREATE OR REPLACE FUNCTION public.frela_auth_user_id()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog
AS $fn$ SELECT nullif(current_setting('frela.onboarding_fixture_id',true),'') $fn$;

SET LOCAL ROLE authenticated;
SELECT set_config('frela.onboarding_fixture_id','fixture-worker-aaa-2026',true);
SELECT public.frela_account_save_worker(
 'Trabalhador Teste A','Ijuí','Auxiliar de eventos','Diárias e finais de semana');
SELECT public.frela_account_register_individual('Contratante Teste A','Ijuí');
SELECT public.frela_account_register_company('Empresa Fictícia A Ltda','Empresa Teste A','Ijuí');
SELECT public.frela_account_save_worker(
 'Trabalhador Teste A Editado','Panambi','Ajuda em eventos','Sábados');

SELECT set_config('frela.onboarding_fixture_id','fixture-worker-bbb-2026',true);
SELECT public.frela_account_save_worker('Trabalhador Teste B','Cruz Alta',NULL,NULL);
SELECT public.frela_account_register_individual('Contratante Teste B','Cruz Alta');
SELECT public.frela_account_register_company('Empresa Fictícia B Ltda','Empresa Teste B','Cruz Alta');

DO $check$
DECLARE self jsonb; failed boolean:=false;
BEGIN
 SELECT public.frela_account_self() INTO self;
 IF self->'worker'->>'display_name' <> 'Trabalhador Teste B'
   OR self->'company'->>'display_name' <> 'Empresa Teste B'
   OR self->'individual'->>'display_name' <> 'Contratante Teste B'
 THEN RAISE EXCEPTION 'Conta B não recebeu apenas seus próprios cadastros'; END IF;
 IF (SELECT count(*) FROM public.worker_profiles)<>1
   OR (SELECT count(*) FROM public.companies)<>1
   OR (SELECT count(*) FROM public.individual_hirers)<>1
 THEN RAISE EXCEPTION 'RLS permitiu visualizar conta A'; END IF;
 BEGIN
  UPDATE public.worker_profiles SET city='Cidade indevida'
  WHERE user_id='fixture-worker-aaa-2026';
 EXCEPTION WHEN insufficient_privilege THEN failed:=true;
 END;
 IF EXISTS(
  SELECT 1 FROM public.worker_profiles
  WHERE user_id='fixture-worker-aaa-2026' AND city='Cidade indevida'
 ) THEN RAISE EXCEPTION 'Conta B conseguiu alterar perfil alheio'; END IF;
END
$check$;

SELECT set_config('frela.onboarding_fixture_id','fixture-worker-aaa-2026',true);
SELECT public.frela_account_self() AS own_profile;
DO $check$
DECLARE blocked boolean:=false;
BEGIN
 BEGIN
  PERFORM public.frela_account_register_individual('Segundo Teste','Ijuí');
 EXCEPTION WHEN unique_violation THEN blocked:=true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'PF duplicada indevidamente'; END IF;
 blocked:=false;
 BEGIN
  PERFORM public.frela_account_register_company('Duplicada Ltda','Segunda Empresa Teste','Ijuí');
 EXCEPTION WHEN unique_violation THEN blocked:=true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'Empresa duplicada indevidamente'; END IF;
END $check$;

RESET ROLE;
ROLLBACK TO SAVEPOINT frela_onboarding_check;
SELECT
 (SELECT count(*) FROM public.worker_profiles) AS workers_remaining,
 (SELECT count(*) FROM public.companies) AS companies_remaining,
 (SELECT count(*) FROM public.individual_hirers) AS individuals_remaining,
 pg_get_functiondef('public.frela_auth_user_id()'::regprocedure) LIKE '%auth.user_id()%' AS auth_bridge_restored;