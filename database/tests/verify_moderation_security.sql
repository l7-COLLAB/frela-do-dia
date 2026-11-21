-- Auditoria de privacidade do módulo administrativo.
-- Executar na branch development-rls APÓS 0006.
DO $audit$
BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_namespace WHERE nspname='app_private'
 ) THEN RAISE EXCEPTION 'Schema privado não foi criado'; END IF;

 IF has_schema_privilege('anonymous','app_private','USAGE')
    OR has_schema_privilege('authenticated','app_private','USAGE') THEN
   RAISE EXCEPTION 'Schema administrativo exposto a usuários comuns';
 END IF;

 IF NOT EXISTS (
   SELECT 1 FROM pg_class
   WHERE oid='app_private.audit_events'::regclass AND relrowsecurity
 ) THEN RAISE EXCEPTION 'Tabela de auditoria sem RLS'; END IF;

 IF has_table_privilege('anonymous','app_private.audit_events','SELECT')
    OR has_table_privilege('authenticated','app_private.audit_events','SELECT')
    OR has_table_privilege('authenticated','app_private.audit_events','INSERT') THEN
   RAISE EXCEPTION 'Auditoria visível ou alterável por clientes';
 END IF;

 IF has_function_privilege('authenticated',
       'app_private.review_hirer(text,uuid,text,text,text)','EXECUTE')
    OR has_function_privilege('authenticated',
       'app_private.review_job(uuid,text,text,text)','EXECUTE')
    OR has_function_privilege('authenticated',
       'app_private.accept_application(uuid,text,text)','EXECUTE')
    OR has_function_privilege('anonymous',
       'app_private.review_hirer(text,uuid,text,text,text)','EXECUTE')
 THEN
   RAISE EXCEPTION 'Função administrativa executável por cliente';
 END IF;

 IF EXISTS (
   SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='app_private'
      AND p.proname IN ('review_hirer','review_job','accept_application')
      AND (p.prosecdef OR NOT ('search_path=pg_catalog'=ANY(p.proconfig)))
 ) THEN RAISE EXCEPTION 'Função administrativa com modo ou busca insegura'; END IF;

 RAISE NOTICE 'PASS: operações privadas, trilha de auditoria e funções invoker restritas';
END
$audit$;
