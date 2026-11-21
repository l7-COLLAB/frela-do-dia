-- Frela do Dia | 0009 — onboarding de perfis com Neon Auth, RLS e API
-- Somente desenvolvimento: criar conta e login são controlados pelo Neon Auth.
-- Estas RPCs recebem o usuário autenticado da sessão, NUNCA do corpo HTTP.
BEGIN;

-- Uma conta de contratante pode registrar uma empresa no MVP inicial.
-- Se futuramente forem necessárias várias, revisar produto e permissões.
CREATE UNIQUE INDEX companies_single_account_idx ON public.companies(owner_user_id);

CREATE FUNCTION public.frela_account_self()
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$
DECLARE actor text;
BEGIN
 actor := public.frela_auth_user_id();
 IF actor IS NULL OR length(actor) < 8 THEN
  RAISE EXCEPTION 'Sessão não autenticada' USING ERRCODE='42501';
 END IF;
 RETURN jsonb_build_object(
  'worker',(SELECT to_jsonb(p) FROM (
    SELECT display_name,city,bio,availability,updated_at
    FROM public.worker_profiles WHERE user_id=actor
  ) p),
  'individual',(SELECT to_jsonb(h) FROM (
    SELECT id,display_name,city,verification_state,created_at
    FROM public.individual_hirers WHERE owner_user_id=actor
  ) h),
  'company',(SELECT to_jsonb(c) FROM (
    SELECT id,display_name,legal_name,city,verification_state,created_at
    FROM public.companies WHERE owner_user_id=actor
  ) c)
 );
END;
$fn$;

CREATE FUNCTION public.frela_account_save_worker(
 p_display_name text,p_city text,p_bio text DEFAULT NULL,p_availability text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$
DECLARE actor text; result public.worker_profiles%ROWTYPE;
BEGIN
 actor := public.frela_auth_user_id();
 IF actor IS NULL OR length(actor)<8 THEN
  RAISE EXCEPTION 'Sessão não autenticada' USING ERRCODE='42501';
 END IF;
 IF char_length(btrim(coalesce(p_display_name,''))) NOT BETWEEN 2 AND 100
    OR char_length(btrim(coalesce(p_city,''))) NOT BETWEEN 2 AND 100
    OR char_length(coalesce(p_bio,'')) > 800
    OR char_length(coalesce(p_availability,'')) > 250 THEN
   RAISE EXCEPTION 'Campos do perfil inválidos';
 END IF;
 INSERT INTO public.worker_profiles(user_id,display_name,city,bio,availability)
 VALUES (actor,btrim(p_display_name),btrim(p_city),
    nullif(btrim(p_bio),''),nullif(btrim(p_availability),''))
 ON CONFLICT (user_id) DO UPDATE SET
   display_name=EXCLUDED.display_name,
   city=EXCLUDED.city,
   bio=EXCLUDED.bio,
   availability=EXCLUDED.availability,
   updated_at=now()
 RETURNING * INTO result;
 RETURN jsonb_build_object('saved',true,'profile','worker',
   'display_name',result.display_name,'city',result.city);
END;
$fn$;

CREATE FUNCTION public.frela_account_register_individual(
 p_display_name text,p_city text
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$
DECLARE actor text; result public.individual_hirers%ROWTYPE;
BEGIN
 actor:=public.frela_auth_user_id();
 IF actor IS NULL OR length(actor)<8 THEN
  RAISE EXCEPTION 'Sessão não autenticada' USING ERRCODE='42501';
 END IF;
 IF char_length(btrim(coalesce(p_display_name,''))) NOT BETWEEN 2 AND 90
    OR char_length(btrim(coalesce(p_city,''))) NOT BETWEEN 2 AND 100 THEN
   RAISE EXCEPTION 'Dados do contratante inválidos';
 END IF;
 INSERT INTO public.individual_hirers(owner_user_id,display_name,city)
 VALUES (actor,btrim(p_display_name),btrim(p_city))
 RETURNING * INTO result;
 RETURN jsonb_build_object('saved',true,'profile','individual',
  'id',result.id,'verification_state',result.verification_state);
END;
$fn$;

CREATE FUNCTION public.frela_account_register_company(
 p_legal_name text,p_display_name text,p_city text
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$
DECLARE actor text; result public.companies%ROWTYPE;
BEGIN
 actor:=public.frela_auth_user_id();
 IF actor IS NULL OR length(actor)<8 THEN
  RAISE EXCEPTION 'Sessão não autenticada' USING ERRCODE='42501';
 END IF;
 IF char_length(btrim(coalesce(p_legal_name,''))) NOT BETWEEN 2 AND 180
    OR char_length(btrim(coalesce(p_display_name,''))) NOT BETWEEN 2 AND 120
    OR char_length(btrim(coalesce(p_city,''))) NOT BETWEEN 2 AND 100 THEN
   RAISE EXCEPTION 'Dados da empresa inválidos';
 END IF;
 INSERT INTO public.companies(owner_user_id,legal_name,display_name,city)
 VALUES (actor,btrim(p_legal_name),btrim(p_display_name),btrim(p_city))
 RETURNING * INTO result;
 RETURN jsonb_build_object('saved',true,'profile','company',
  'id',result.id,'verification_state',result.verification_state);
END;
$fn$;

-- Não se concede acesso a anonymous. Invoker + RLS garantem dados por titular.
REVOKE ALL ON FUNCTION public.frela_account_self() FROM PUBLIC,anonymous,authenticated;
REVOKE ALL ON FUNCTION public.frela_account_save_worker(text,text,text,text) FROM PUBLIC,anonymous,authenticated;
REVOKE ALL ON FUNCTION public.frela_account_register_individual(text,text) FROM PUBLIC,anonymous,authenticated;
REVOKE ALL ON FUNCTION public.frela_account_register_company(text,text,text) FROM PUBLIC,anonymous,authenticated;

GRANT EXECUTE ON FUNCTION public.frela_account_self() TO authenticated;
GRANT EXECUTE ON FUNCTION public.frela_account_save_worker(text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.frela_account_register_individual(text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.frela_account_register_company(text,text,text) TO authenticated;

COMMIT;
