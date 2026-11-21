-- Frela do Dia | 0007: painel administrativo com autorização no banco
-- Apenas após 0006. O site público não recebe privilégios pelo simples login.
-- Administração só funcionará para usuário explicitamente cadastrado por DBA
-- em app_private.admin_operators, após confirmação da identidade.
BEGIN;

CREATE TABLE app_private.admin_operators (
  user_id text PRIMARY KEY CHECK (char_length(btrim(user_id)) BETWEEN 8 AND 128),
  active boolean NOT NULL DEFAULT false,
  granted_at timestamptz NOT NULL DEFAULT now(),
  grant_reason text NOT NULL CHECK (char_length(btrim(grant_reason)) BETWEEN 10 AND 500)
);
ALTER TABLE app_private.admin_operators ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.admin_operators FROM PUBLIC,anonymous,authenticated;

CREATE FUNCTION public.frela_admin_queue()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE actor text;
BEGIN
 actor := public.frela_auth_user_id();
 IF actor IS NULL OR NOT EXISTS (
  SELECT 1 FROM app_private.admin_operators
  WHERE user_id=actor AND active=true
 ) THEN
  RAISE EXCEPTION 'Acesso administrativo negado' USING ERRCODE='42501';
 END IF;
 RETURN jsonb_build_object(
 'companies',COALESCE((
  SELECT jsonb_agg(to_jsonb(x)) FROM (
   SELECT id,display_name,legal_name,city,created_at
   FROM public.companies
   WHERE verification_state='pending'
   ORDER BY created_at ASC LIMIT 50
  ) x
 ),'[]'::jsonb),
 'individuals',COALESCE((
  SELECT jsonb_agg(to_jsonb(x)) FROM (
   SELECT id,display_name,city,created_at
   FROM public.individual_hirers
   WHERE verification_state='pending'
   ORDER BY created_at ASC LIMIT 50
  ) x
 ),'[]'::jsonb),
 'jobs',COALESCE((
  SELECT jsonb_agg(to_jsonb(x)) FROM (
   SELECT id,title,company_display_name,city,category,opportunity_type,
          pay_cents,pay_period,starts_at,application_deadline,created_at,
          CASE WHEN company_id IS NOT NULL THEN 'company' ELSE 'individual_hirer' END AS owner_kind
   FROM public.job_postings
   WHERE status='pending'
   ORDER BY created_at ASC LIMIT 50
  ) x
 ),'[]'::jsonb),
 'limits',jsonb_build_object('max_per_section',50),
 'operator_id',actor
 );
END;
$fn$;

CREATE FUNCTION public.frela_admin_decide(
 p_kind text,
 p_id uuid,
 p_decision text,
 p_justification text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE actor text;
BEGIN
 actor := public.frela_auth_user_id();
 IF actor IS NULL OR NOT EXISTS (
  SELECT 1 FROM app_private.admin_operators
  WHERE user_id=actor AND active=true
 ) THEN
  RAISE EXCEPTION 'Acesso administrativo negado' USING ERRCODE='42501';
 END IF;
 IF p_id IS NULL OR char_length(btrim(coalesce(p_justification,''))) NOT BETWEEN 10 AND 1200 THEN
  RAISE EXCEPTION 'Justificativa de 10 a 1200 caracteres obrigatória';
 END IF;

 IF p_kind IN ('company','individual_hirer') AND p_decision IN ('verified','rejected','suspended') THEN
  PERFORM app_private.review_hirer(p_kind,p_id,p_decision,actor,p_justification);
 ELSIF p_kind='job_posting' AND p_decision IN ('published','rejected') THEN
  PERFORM app_private.review_job(p_id,p_decision,actor,p_justification);
 ELSE
  RAISE EXCEPTION 'Tipo ou decisão administrativa inválida';
 END IF;
 RETURN jsonb_build_object('ok',true,'kind',p_kind,'id',p_id,'decision',p_decision);
END;
$fn$;

-- Exposição do RPC é limitada ao papel authenticated e à allowlist interna;
-- NUNCA conceder acesso à tabela de operadores.
REVOKE ALL ON FUNCTION public.frela_admin_queue() FROM PUBLIC,anonymous,authenticated;
REVOKE ALL ON FUNCTION public.frela_admin_decide(text,uuid,text,text) FROM PUBLIC,anonymous,authenticated;
GRANT EXECUTE ON FUNCTION public.frela_admin_queue() TO authenticated;
GRANT EXECUTE ON FUNCTION public.frela_admin_decide(text,uuid,text,text) TO authenticated;
COMMIT;
