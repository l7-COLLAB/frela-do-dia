-- Frela do Dia | testes transacionais de integridade da migração 0004
-- Teste na branch development-rls; todos os registros sintéticos são revertidos.
-- Não substitui teste de tokens JWT reais nem autorização multiusuário.
DO $test$
DECLARE
 p1 uuid; p2 uuid; c1 uuid; j1 uuid; j2 uuid;
 ts timestamptz := now() + interval '3 days';
 caught boolean;
BEGIN
 BEGIN
  INSERT INTO public.individual_hirers
   (owner_user_id,display_name,city,verification_state)
  VALUES ('fixture-pf-a','Pessoa Exemplo A','Ijuí','verified') RETURNING id INTO p1;

  INSERT INTO public.individual_hirers
   (owner_user_id,display_name,city,verification_state)
  VALUES ('fixture-pf-b','Pessoa Exemplo B','Ijuí','verified') RETURNING id INTO p2;

  INSERT INTO public.companies
   (owner_user_id,legal_name,display_name,city,verification_state)
  VALUES ('fixture-company-a','Empresa Fictícia Ltda','Empresa Exemplo','Ijuí','verified')
  RETURNING id INTO c1;

  INSERT INTO public.job_postings
   (individual_hirer_id,title,company_display_name,city,category,tasks,
    starts_at,ends_at,pay_cents,payment_terms,slots,opportunity_type,pay_period,application_deadline)
  VALUES (p1,'Ajudante para mudança','Pessoa Exemplo A','Ijuí','Logística',
    'Ajudar a descarregar caixas e objetos leves.',ts,ts+interval '4 hours',
    12000,'Pix ao concluir',2,'oneoff','per_job',ts-interval '1 day')
  RETURNING id INTO j1;

  INSERT INTO public.job_postings
   (company_id,title,company_display_name,city,category,tasks,
    starts_at,ends_at,pay_cents,payment_terms,slots,opportunity_type,pay_period,
    employment_regime,application_deadline)
  VALUES (c1,'Auxiliar de escritório','Empresa Exemplo','Ijuí','Comércio',
    'Atendimento e tarefas administrativas iniciais.',ts,ts+interval '8 hours',
    195000,'Salário mensal conforme contrato',1,'permanent','monthly','clt',
    ts-interval '1 day') RETURNING id INTO j2;

  INSERT INTO public.applications(job_id,applicant_user_id)
  VALUES (j1,'fixture-worker-a');

  INSERT INTO public.engagements(job_id,individual_hirer_id,worker_user_id)
  VALUES (j1,p1,'fixture-worker-a');

  IF (SELECT count(*) FROM public.job_postings WHERE id IN (j1,j2)) <> 2 THEN
    RAISE EXCEPTION 'Falha na criação das oportunidades válidas';
  END IF;

  -- Não é permitido registrar o mesmo anúncio com empresa E pessoa física.
  caught := false;
  BEGIN
   INSERT INTO public.job_postings
    (company_id,individual_hirer_id,title,company_display_name,city,category,tasks,
     starts_at,ends_at,pay_cents,payment_terms,slots,opportunity_type,pay_period)
   VALUES (c1,p1,'Associação inválida','Empresa Exemplo','Ijuí','Logística',
    'Teste de contratantes simultâneos.',ts,ts+interval '4 hours',10000,'Pix no dia',
    1,'oneoff','per_job');
  EXCEPTION WHEN check_violation THEN caught := true;
  END;
  IF NOT caught THEN RAISE EXCEPTION 'Foi permitido anunciar com dois contratantes'; END IF;

  -- Emprego fixo não pode apresentar salário mensal como valor por diária.
  caught := false;
  BEGIN
   INSERT INTO public.job_postings
    (company_id,title,company_display_name,city,category,tasks,
     starts_at,ends_at,pay_cents,payment_terms,slots,opportunity_type,pay_period)
   VALUES (c1,'Remuneração inválida','Empresa Exemplo','Ijuí','Comércio',
    'Validar regime salarial não aceito.',ts,ts+interval '8 hours',190000,
    'Mensal',1,'permanent','per_job');
  EXCEPTION WHEN check_violation THEN caught := true;
  END;
  IF NOT caught THEN RAISE EXCEPTION 'Foi permitido salário fixo com pagamento por serviço'; END IF;

  -- Posições preenchidas não podem ultrapassar a lotação.
  caught := false;
  BEGIN
   UPDATE public.job_postings SET filled_slots = 3 WHERE id = j1;
  EXCEPTION WHEN check_violation THEN caught := true;
  END;
  IF NOT caught THEN RAISE EXCEPTION 'Foi permitido preencher mais vagas que o anunciado'; END IF;

  -- Contratação não pode apontar para PF diferente da titular da vaga.
  caught := false;
  BEGIN
   INSERT INTO public.engagements(job_id,individual_hirer_id,worker_user_id)
   VALUES (j1,p2,'fixture-worker-a');
  EXCEPTION WHEN foreign_key_violation THEN caught := true;
  END;
  IF NOT caught THEN RAISE EXCEPTION 'Contratação ficou vinculada à PF errada'; END IF;

  -- Todos os registros inseridos acima ficam contidos na subtransação.
  RAISE EXCEPTION 'FRELA_TEST_ROLLBACK_OK';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM <> 'FRELA_TEST_ROLLBACK_OK' THEN RAISE; END IF;
 END;
END;
$test$;
