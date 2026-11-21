-- Verificações estruturais do ambiente Neon — executar APÓS 0001, 0002 e 0003.
-- Este script NÃO substitui os testes ponta a ponta via Neon Data API.
DO $audit$
DECLARE target text;
BEGIN
  IF to_regprocedure('auth.user_id()') IS NULL THEN
    RAISE EXCEPTION 'Função auth.user_id() ausente: habilitar Neon Auth/Data API';
  END IF;

  FOREACH target IN ARRAY ARRAY[
    'worker_profiles','companies','job_postings',
    'job_private_locations','applications','engagements','individual_hirers'
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
    OR has_table_privilege('anonymous', 'public.job_private_locations', 'SELECT')
    OR has_table_privilege('anonymous', 'public.individual_hirers', 'SELECT')
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
    OR has_table_privilege('authenticated', 'public.individual_hirers', 'UPDATE')
  THEN
    RAISE EXCEPTION 'Papel autenticado possui privilégio administrativo indevido';
  END IF;

  IF NOT has_function_privilege('authenticated','public.frela_auth_user_id()','EXECUTE')
     OR has_function_privilege('anonymous','public.frela_auth_user_id()','EXECUTE')
  THEN
    RAISE EXCEPTION 'Ponte da identidade não restrita a usuários autenticados';
  END IF;

  IF (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public'
      AND (COALESCE(qual,'') LIKE '%auth.user_id()%'
           OR COALESCE(with_check,'') LIKE '%auth.user_id()%')) <> 0
  THEN
    RAISE EXCEPTION 'Políticas RLS ainda dependem diretamente do schema auth';
  END IF;

  IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='individual_hirers') <> 2 THEN
    RAISE EXCEPTION 'Políticas de PF ausentes ou inesperadas';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='job_postings_exactly_one_hirer'
      AND conrelid='public.job_postings'::regclass
  ) THEN
    RAISE EXCEPTION 'Restrição de apenas um anunciante por vaga ausente';
  END IF;

  RAISE NOTICE 'Verificações estruturais RLS concluídas. Testar tokens reais separadamente.';
END
$audit$;

SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname='public'
ORDER BY tablename, policyname;
