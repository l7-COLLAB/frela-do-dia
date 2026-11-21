-- Executar somente na branch authorization-tests; todos os dados de teste
-- e a função de identidade fictícia são revertidos no mesmo transaction scope.
SAVEPOINT frela_commercial_test;
CREATE OR REPLACE FUNCTION public.frela_auth_user_id()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog
AS $fn$ SELECT nullif(current_setting('frela.test_business_actor',true),'') $fn$;
INSERT INTO app_private.admin_operators(user_id,active,grant_reason)
VALUES ('fixture-admin-finance',true,'Operador fictício para teste financeiro isolado')
ON CONFLICT(user_id) DO UPDATE SET active=true;
SET LOCAL ROLE authenticated;
SELECT set_config('frela.test_business_actor','fixture-visitor',true);
DO $test$
DECLARE blocked boolean:=false;
BEGIN
 BEGIN PERFORM public.frela_admin_commercial();
 EXCEPTION WHEN insufficient_privilege THEN blocked:=true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'Visitante autenticado viu dados comerciais'; END IF;
END
$test$;
SELECT set_config('frela.test_business_actor','fixture-admin-finance',true);
SELECT jsonb_array_length(public.frela_admin_commercial()->'offers') AS offer_count,
 (public.frela_admin_commercial()->'overview'->>'payingCustomers')::int AS paying,
 (public.frela_admin_commercial()->'overview'->>'confirmedRevenueCents')::int AS revenue,
 (public.frela_admin_commercial()->'overview'->>'paymentGatewayIntegrated')::boolean AS gateway_active;
SELECT public.frela_admin_change_price('local_business',3190,1,
  'Preço fictício de teste para validar atualização de catálogo');
SELECT (public.frela_admin_commercial()->'offers') @> '[{"code":"local_business","price_cents":3190,"revision":2}]'::jsonb AS price_changed,
 jsonb_array_length(public.frela_admin_commercial()->'priceHistory') AS history_count;
DO $test$
DECLARE blocked boolean:=false;
BEGIN
 BEGIN
  PERFORM public.frela_admin_change_price('local_business',3490,1,
   'Tentativa fictícia com revisão desatualizada');
 EXCEPTION WHEN raise_exception THEN blocked:=SQLERRM LIKE 'Preço alterado%';
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'Edição concorrente não foi barrada'; END IF;
END
$test$;
RESET ROLE;
ROLLBACK TO SAVEPOINT frela_commercial_test;
SELECT (SELECT count(*) FROM app_private.admin_operators WHERE user_id='fixture-admin-finance') AS fake_operators,
 (SELECT count(*) FROM app_private.commercial_price_history) AS price_edits_remaining,
 (SELECT price_cents FROM app_private.commercial_offers WHERE code='local_business') AS original_price,
 pg_get_functiondef('public.frela_auth_user_id()'::regprocedure) LIKE '%auth.user_id()%' AS original_identity_restored;