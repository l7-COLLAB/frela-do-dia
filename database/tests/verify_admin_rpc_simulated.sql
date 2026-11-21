SAVEPOINT frela_admin_test;
CREATE OR REPLACE FUNCTION public.frela_auth_user_id()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog
AS $fn$ SELECT NULLIF(current_setting('frela.admin_test_identity',true),'') $fn$;
INSERT INTO app_private.admin_operators(user_id,active,grant_reason)
VALUES('fixture-admin-verified',true,'Operador administrativo criado exclusivamente no teste');
INSERT INTO public.companies(id,owner_user_id,legal_name,display_name,city)
VALUES('00000000-0000-4000-8000-000000000991','fixture-owner','Exemplo de Empresa Ltda','Empresa de Teste','Ijuí');
SET LOCAL ROLE authenticated;
SELECT set_config('frela.admin_test_identity','fixture-non-admin',true) AS simulated_identity;
DO $block$
DECLARE denied boolean := false;
BEGIN
 BEGIN PERFORM public.frela_admin_queue();
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'Conta não administrativa recebeu acesso'; END IF;
END
$block$;
SELECT set_config('frela.admin_test_identity','fixture-admin-verified',true) AS simulated_identity;
SELECT (public.frela_admin_queue()->'companies'->0->>'display_name') AS pending_company_name;
SELECT public.frela_admin_decide('company','00000000-0000-4000-8000-000000000991','verified','Verificação fictícia concluída para teste');
RESET ROLE;
SELECT (SELECT verification_state FROM public.companies WHERE id='00000000-0000-4000-8000-000000000991') AS decided_state,
 (SELECT COUNT(*) FROM app_private.audit_events) AS audit_events;
ROLLBACK TO SAVEPOINT frela_admin_test;
SELECT (SELECT COUNT(*) FROM app_private.admin_operators) AS admin_users_remaining,
 (SELECT COUNT(*) FROM public.companies) AS companies_remaining,
 (SELECT COUNT(*) FROM app_private.audit_events) AS audits_remaining,
 pg_get_functiondef('public.frela_auth_user_id()'::regprocedure) LIKE '%auth.user_id()%' AS identity_bridge_restored;