-- Frela do Dia | 0006 — operações administrativas auditadas (somente desenvolvimento)
-- Depois de 0001–0005. Não habilita acesso de clientes a operações administrativas.
-- Nenhuma conta, vaga ou contratação real deve ser modificada sem revisão do operador.
BEGIN;

CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC, anonymous, authenticated;

CREATE TABLE app_private.audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  operator_id text NOT NULL CHECK (char_length(btrim(operator_id)) BETWEEN 3 AND 128),
  event_kind text NOT NULL CHECK (event_kind IN (
    'hirer_verified','hirer_rejected','hirer_suspended',
    'job_published','job_rejected','application_accepted'
  )),
  subject_kind text NOT NULL CHECK (subject_kind IN (
    'company','individual_hirer','job_posting','application'
  )),
  subject_id uuid NOT NULL,
  old_state text,
  new_state text NOT NULL,
  justification text NOT NULL CHECK (char_length(btrim(justification)) BETWEEN 10 AND 1200),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE app_private.audit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE app_private.audit_events FROM PUBLIC, anonymous, authenticated;

-- Invoker: o backend deverá usar uma conexão administrativa guardada em segredo
-- e validar identidade do operador. Não existe API administrativa pública.
CREATE FUNCTION app_private.review_hirer(
  p_kind text, p_hirer_id uuid, p_decision text,
  p_operator_id text, p_justification text
) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $fn$
DECLARE v_current text;
BEGIN
  IF p_kind NOT IN ('company','individual_hirer')
    OR p_decision NOT IN ('verified','rejected','suspended')
    OR char_length(btrim(coalesce(p_operator_id,''))) < 3
    OR char_length(btrim(coalesce(p_justification,''))) NOT BETWEEN 10 AND 1200 THEN
    RAISE EXCEPTION 'Parâmetros administrativos inválidos';
  END IF;

  IF p_kind = 'company' THEN
    SELECT verification_state INTO v_current FROM public.companies
    WHERE id = p_hirer_id FOR UPDATE;
  ELSE
    SELECT verification_state INTO v_current FROM public.individual_hirers
    WHERE id = p_hirer_id FOR UPDATE;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contratante não encontrado'; END IF;

  IF NOT (
      (v_current = 'pending' AND p_decision IN ('verified','rejected'))
      OR (v_current = 'verified' AND p_decision = 'suspended')
    ) THEN
    RAISE EXCEPTION 'Transição de verificação não permitida: % -> %',v_current,p_decision;
  END IF;

  IF p_kind = 'company' THEN
    UPDATE public.companies
       SET verification_state = p_decision, updated_at = now()
     WHERE id = p_hirer_id;
  ELSE
    UPDATE public.individual_hirers
       SET verification_state = p_decision, updated_at = now()
     WHERE id = p_hirer_id;
  END IF;

  INSERT INTO app_private.audit_events(
    operator_id,event_kind,subject_kind,subject_id,old_state,new_state,justification
  ) VALUES (
    p_operator_id,
    CASE p_decision WHEN 'verified' THEN 'hirer_verified'
      WHEN 'rejected' THEN 'hirer_rejected' ELSE 'hirer_suspended' END,
    p_kind,p_hirer_id,v_current,p_decision,p_justification
  );
END;
$fn$;

CREATE FUNCTION app_private.review_job(
  p_job_id uuid, p_decision text, p_operator_id text, p_justification text
) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $fn$
DECLARE j public.job_postings%ROWTYPE; v_verified boolean;
BEGIN
  IF p_decision NOT IN ('published','rejected')
    OR char_length(btrim(coalesce(p_operator_id,''))) < 3
    OR char_length(btrim(coalesce(p_justification,''))) NOT BETWEEN 10 AND 1200 THEN
    RAISE EXCEPTION 'Parâmetros administrativos inválidos';
  END IF;

  SELECT * INTO j FROM public.job_postings WHERE id=p_job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Vaga não encontrada'; END IF;
  IF j.status <> 'pending' THEN
    RAISE EXCEPTION 'Somente vagas pendentes podem ser moderadas';
  END IF;

  IF p_decision = 'published' THEN
    IF COALESCE(j.application_deadline,j.starts_at) <= now()
      OR j.filled_slots <> 0 THEN
      RAISE EXCEPTION 'Vaga expirada ou preenchida não pode ser publicada';
    END IF;
    SELECT EXISTS (
       SELECT 1 FROM public.companies c
       WHERE c.id=j.company_id AND c.verification_state='verified'
         AND c.display_name=j.company_display_name
       UNION ALL
       SELECT 1 FROM public.individual_hirers h
       WHERE h.id=j.individual_hirer_id AND h.verification_state='verified'
         AND h.display_name=j.company_display_name
    ) INTO v_verified;
    IF NOT v_verified THEN
      RAISE EXCEPTION 'Verificação do contratante obrigatória para publicação';
    END IF;
  END IF;

  UPDATE public.job_postings
     SET status=p_decision,
         published_at=CASE WHEN p_decision='published' THEN now() ELSE NULL END,
         updated_at=now()
   WHERE id=p_job_id;

  INSERT INTO app_private.audit_events(
    operator_id,event_kind,subject_kind,subject_id,old_state,new_state,justification
  ) VALUES (
    p_operator_id,
    CASE WHEN p_decision='published' THEN 'job_published' ELSE 'job_rejected' END,
    'job_posting',p_job_id,j.status,p_decision,p_justification
  );
END;
$fn$;

-- Operação atômica, sob lock da vaga, para impedir preencher além da lotação.
-- 'closed' + filled_slots = slots significa 'Preenchida' sem alterar o
-- CHECK histórico de estados das vagas.
CREATE FUNCTION app_private.accept_application(
  p_application_id uuid, p_operator_id text, p_justification text
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $fn$
DECLARE a public.applications%ROWTYPE;
        j public.job_postings%ROWTYPE;
        v_engagement_id uuid;
BEGIN
  IF char_length(btrim(coalesce(p_operator_id,''))) < 3
    OR char_length(btrim(coalesce(p_justification,''))) NOT BETWEEN 10 AND 1200 THEN
    RAISE EXCEPTION 'Identificação e justificativa do operador são obrigatórias';
  END IF;

  SELECT * INTO a FROM public.applications
   WHERE id=p_application_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Candidatura não encontrada'; END IF;
  IF a.status NOT IN ('submitted','shortlisted') THEN
    RAISE EXCEPTION 'Candidatura não está disponível para seleção';
  END IF;

  SELECT * INTO j FROM public.job_postings WHERE id=a.job_id FOR UPDATE;
  IF j.status <> 'published'
    OR j.filled_slots >= j.slots
    OR COALESCE(j.application_deadline,j.starts_at) <= now() THEN
    RAISE EXCEPTION 'Vaga não está mais disponível';
  END IF;

  INSERT INTO public.engagements(job_id,company_id,individual_hirer_id,worker_user_id)
   VALUES (j.id,j.company_id,j.individual_hirer_id,a.applicant_user_id)
   RETURNING id INTO v_engagement_id;

  UPDATE public.applications SET status='accepted' WHERE id=p_application_id;

  UPDATE public.job_postings
     SET filled_slots=filled_slots+1,
         status=CASE WHEN filled_slots+1>=slots THEN 'closed' ELSE status END,
         updated_at=now()
   WHERE id=j.id;

  INSERT INTO app_private.audit_events(
    operator_id,event_kind,subject_kind,subject_id,old_state,new_state,justification
  ) VALUES (p_operator_id,'application_accepted','application',
            p_application_id,a.status,'accepted',p_justification);

  RETURN v_engagement_id;
END;
$fn$;

-- Funções só podem ser executadas por uma conexão privilegiada no servidor.
-- Nunca conceder EXECUTE a anonymous/authenticated nem expor app_private na Data API.
REVOKE EXECUTE ON FUNCTION
  app_private.review_hirer(text,uuid,text,text,text)
FROM PUBLIC, anonymous, authenticated;
REVOKE EXECUTE ON FUNCTION
  app_private.review_job(uuid,text,text,text)
FROM PUBLIC, anonymous, authenticated;
REVOKE EXECUTE ON FUNCTION
  app_private.accept_application(uuid,text,text)
FROM PUBLIC, anonymous, authenticated;
COMMIT;
