-- Testes NEGATIVOS de acesso com role PostgreSQL, mas sem token JWT.
-- Rodar apenas em development-rls, sem armazenar dados e sem modificar roles.
-- Estes testes não substituem testes com sessões reais emitidas pelo Neon Auth.
DO $audit$
DECLARE denied boolean;
BEGIN
 IF public.frela_auth_user_id() IS NOT NULL THEN
   RAISE EXCEPTION 'Teste necessita de sessão SEM identidade JWT';
 END IF;

 denied := false;
 BEGIN
  INSERT INTO public.individual_hirers
   (owner_user_id,display_name,city,verification_state)
  VALUES('forged-user','Exemplo indevido','Ijuí','verified');
 EXCEPTION WHEN insufficient_privilege THEN denied := true;
 END;
 IF NOT denied THEN
   RAISE EXCEPTION 'Falha: role autenticada sem JWT conseguiu cadastrar PF verificada';
 END IF;

 denied := false;
 BEGIN
  INSERT INTO public.worker_profiles(user_id,display_name,city)
  VALUES('forged-worker','Pessoa indevida','Ijuí');
 EXCEPTION WHEN insufficient_privilege THEN denied := true;
 END;
 IF NOT denied THEN
   RAISE EXCEPTION 'Falha: role autenticada sem JWT conseguiu criar perfil alheio';
 END IF;

 denied := false;
 BEGIN
  INSERT INTO public.companies(owner_user_id,legal_name,display_name,city,verification_state)
  VALUES('forged-owner','Empresa Fake','Empresa Fake','Ijuí','verified');
 EXCEPTION WHEN insufficient_privilege THEN denied := true;
 END;
 IF NOT denied THEN
   RAISE EXCEPTION 'Falha: role autenticada sem JWT conseguiu se autoverificar';
 END IF;

 IF (SELECT count(*) FROM public.worker_profiles) <> 0
   OR (SELECT count(*) FROM public.individual_hirers) <> 0
 THEN
   RAISE EXCEPTION 'Falha: role sem identidade encontrou registros privados';
 END IF;

 RAISE NOTICE 'Role authenticated sem JWT: acesso indevido bloqueado';
END;
$audit$;