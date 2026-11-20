-- Verificações estruturais do ambiente Neon — executar APÓS 0001 e 0002.
-- Este script NÃO substitui os testes ponta a ponta via Neon Data API.
DO $audit$
DECLARE target text;
BEGIN
  IF to_regprocedure('auth.user_id()') IS NULL THEN
    RAISE EXCEPTION 'Função auth.user_id() ausente: habilitar Neon Auth/Data API';
  END IF;

  FOREACH target IN ARRAY ARRAY[
    'worker_profiles','companies','job_postings',
    'job_private_locations','applications','engagements','reviews'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_class t
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname='public' AND t.relname=target
        AND t.relkind='r' AND t.relrowsecurity
    ) THEN
      RAISE EXCEPTION 'RLS não habilitada: public.%', target;
    END IF;
  END LOOP;

  IF has_table_privilege('anonymous', 'public.worker_profiles', 'SELECT')
    OR has_table_privilege('anonymous', 'public.companies', 'SELECT')
    OR has_table_privilege('anonymous', 'public.applications', 'SELECT')
    OR has_table_privilege('anonymous', 'public.engagements', 'SELECT')
    OR has_table_privilege('anonymous', 'public.reviews', 'SELECT')
    OR has_table_privilege('anonymous', 'public.job_private_locations', 'SELECT')
  THEN
    RAISE EXCEPTION 'Um papel anônimo recebeu acesso direto a dados privados';
  END IF;

  IF NOT has_table_privilege('anonymous', 'public.job_postings', 'SELECT') THEN
    RAISE EXCEPTION 'Leitura anônima de vagas não configurada';
  END IF;

  IF has_table_privilege('authenticated', 'public.engagements', 'INSERT')
    OR has_table_privilege('authenticated', 'public.engagements', 'UPDATE')
    OR has_table_privilege('authenticated', 'public.companies', 'UPDATE')
    OR has_table_privilege('authenticated', 'public.job_postings', 'UPDATE')
    OR has_table_privilege('authenticated', 'public.reviews', 'UPDATE')
    OR has_table_privilege('authenticated', 'public.reviews', 'DELETE')
  THEN
    RAISE EXCEPTION 'Papel autenticado possui privilégio administrativo indevido';
  END IF;

  IF (SELECT count(*) FROM pg_policies
      WHERE schemaname='public' AND tablename='reviews') <> 2
  THEN
    RAISE EXCEPTION 'Políticas de avaliações inesperadas';
  END IF;

  RAISE NOTICE 'Verificações estruturais RLS concluídas. Testar tokens reais separadamente.';
END
$audit$;

SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname='public'
ORDER BY tablename, policyname;
