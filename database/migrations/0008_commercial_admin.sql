-- Frela do Dia | 0008 — gestão comercial interna e catálogo de preços
-- Aplica-se depois da 0007, primeiro em branch isolada e depois em development-rls.
-- Ofertas são preços PROPOSTOS, privados, sem checkout ou publicação automática.
BEGIN;

CREATE TABLE app_private.commercial_offers (
  code text PRIMARY KEY CHECK (code ~ '^[a-z][a-z0-9_]{2,49}$'),
  label text NOT NULL CHECK (char_length(btrim(label)) BETWEEN 3 AND 100),
  description text NOT NULL DEFAULT '',
  price_cents integer NOT NULL CHECK (price_cents BETWEEN 0 AND 10000000),
  charge_type text NOT NULL CHECK (charge_type IN ('single','monthly')),
  duration_days integer CHECK (duration_days BETWEEN 1 AND 366),
  included_quantity integer NOT NULL DEFAULT 1 CHECK (included_quantity BETWEEN 1 AND 100),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','retired')),
  revision integer NOT NULL DEFAULT 1 CHECK (revision>=1),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE app_private.commercial_offers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.commercial_offers FROM PUBLIC,anonymous,authenticated;

-- Preços que constam do plano aprovado como HIPÓTESES, não cobrança ativa.
INSERT INTO app_private.commercial_offers
(code,label,description,price_cents,charge_type,duration_days,included_quantity)
VALUES
('fixed_job','Emprego fixo','Uma vaga fixa por até 30 dias',1990,'single',30,1),
('job_boost','Destaque de vaga','Um destaque identificado por 7 dias',1490,'single',7,1),
('local_notice','Aviso comercial','Oferta, novidade ou mudança de horário por 7 dias',990,'single',7,1),
('local_business','Plano Comércio Local','Até 4 avisos comerciais por 30 dias',2990,'monthly',30,4),
('company_plan','Plano Empresas','Até 3 vagas fixas por 30 dias',4990,'monthly',30,3),
('premium_cv','Currículo premium','Um modelo de currículo opcional',799,'single',NULL,1);

CREATE TABLE app_private.commercial_price_history (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 offer_code text NOT NULL REFERENCES app_private.commercial_offers(code),
 operator_user_id text NOT NULL,
 old_price_cents integer NOT NULL,
 new_price_cents integer NOT NULL,
 old_revision integer NOT NULL,
 new_revision integer NOT NULL,
 reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 10 AND 500),
 changed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE app_private.commercial_price_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.commercial_price_history FROM PUBLIC,anonymous,authenticated;

-- Lançamentos financeiros só poderão vir de integração server-side validada.
-- Não oferecer endpoint administrativo para criar lançamentos ou marcar pagamento.
CREATE TABLE app_private.billing_receipts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 payment_provider text NOT NULL CHECK (char_length(payment_provider) BETWEEN 2 AND 70),
 provider_payment_id text NOT NULL CHECK (char_length(provider_payment_id) BETWEEN 4 AND 200),
 payer_user_id text NOT NULL,
 payer_display_name text NOT NULL CHECK (char_length(btrim(payer_display_name)) BETWEEN 2 AND 120),
 payer_kind text NOT NULL CHECK (payer_kind IN ('company','individual_hirer','worker')),
 offer_code text NOT NULL REFERENCES app_private.commercial_offers(code),
 amount_cents integer NOT NULL CHECK (amount_cents BETWEEN 0 AND 10000000),
 currency text NOT NULL DEFAULT 'BRL' CHECK (currency='BRL'),
 state text NOT NULL CHECK (state IN ('pending','paid','refunded','chargeback')),
 paid_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(payment_provider,provider_payment_id),
 CONSTRAINT paid_receipts_have_paid_at CHECK (state <> 'paid' OR paid_at IS NOT NULL)
);
CREATE INDEX billing_receipts_paid_idx ON app_private.billing_receipts(paid_at DESC) WHERE state='paid';
ALTER TABLE app_private.billing_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.billing_receipts FROM PUBLIC,anonymous,authenticated;

-- Compatível com a allowlist privada existente. Jamais usa email informado
-- pelo navegador para autorização; a identidade vem do JWT validado pelo Neon.
CREATE FUNCTION public.frela_admin_commercial()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $body$
DECLARE actor text;
BEGIN
 actor:=public.frela_auth_user_id();
 IF actor IS NULL OR NOT EXISTS (
   SELECT 1 FROM app_private.admin_operators op
   WHERE op.user_id=actor AND op.active
 ) THEN
   RAISE EXCEPTION 'Acesso administrativo negado' USING ERRCODE='42501';
 END IF;
 RETURN jsonb_build_object(
  'overview',jsonb_build_object(
   'registeredCompanies',(SELECT count(*) FROM public.companies),
   'verifiedCompanies',(SELECT count(*) FROM public.companies WHERE verification_state='verified'),
   'registeredIndividuals',(SELECT count(*) FROM public.individual_hirers),
   'registeredWorkers',(SELECT count(*) FROM public.worker_profiles),
   'publishedJobs',(SELECT count(*) FROM public.job_postings WHERE status='published' AND filled_slots<slots
      AND coalesce(application_deadline,starts_at)>now()),
   'pendingJobs',(SELECT count(*) FROM public.job_postings WHERE status='pending'),
   'applications',(SELECT count(*) FROM public.applications),
   'payingCustomers',(SELECT count(DISTINCT payer_user_id) FROM app_private.billing_receipts WHERE state='paid'),
   'paidReceipts',(SELECT count(*) FROM app_private.billing_receipts WHERE state='paid'),
   'confirmedRevenueCents',(SELECT coalesce(sum(amount_cents),0) FROM app_private.billing_receipts WHERE state='paid'),
   'paymentGatewayIntegrated',false
  ),
  'offers',coalesce((
     SELECT jsonb_agg(to_jsonb(o) ORDER BY o.code)
     FROM (SELECT code,label,description,price_cents,charge_type,duration_days,included_quantity,
                  status,revision,updated_at
           FROM app_private.commercial_offers ORDER BY code) o
  ),'[]'::jsonb),
  'payingClients',coalesce((
     SELECT jsonb_agg(to_jsonb(c) ORDER BY c.last_paid_at DESC)
     FROM (SELECT payer_user_id,payer_kind,max(payer_display_name) AS display_name,
                 count(*)::integer AS paid_orders,sum(amount_cents)::bigint AS total_paid_cents,
                 max(paid_at) AS last_paid_at
           FROM app_private.billing_receipts
           WHERE state='paid'
           GROUP BY payer_user_id,payer_kind ORDER BY max(paid_at) DESC LIMIT 50) c
  ),'[]'::jsonb),
  'recentPayments',coalesce((
     SELECT jsonb_agg(to_jsonb(r) ORDER BY r.paid_at DESC)
     FROM (SELECT id,payer_display_name,offer_code,amount_cents,paid_at
           FROM app_private.billing_receipts WHERE state='paid'
           ORDER BY paid_at DESC LIMIT 50) r
  ),'[]'::jsonb),
  'advertisers',coalesce((
    SELECT jsonb_agg(to_jsonb(a) ORDER BY a.created_at DESC)
    FROM (SELECT id,'company'::text AS kind,display_name,city,verification_state,created_at
          FROM public.companies
          UNION ALL
          SELECT id,'individual_hirer'::text AS kind,display_name,city,verification_state,created_at
          FROM public.individual_hirers
          ORDER BY created_at DESC LIMIT 60) a
  ),'[]'::jsonb),
  'priceHistory',coalesce((
    SELECT jsonb_agg(to_jsonb(h) ORDER BY h.changed_at DESC)
    FROM (SELECT offer_code,old_price_cents,new_price_cents,reason,changed_at
          FROM app_private.commercial_price_history
          ORDER BY changed_at DESC LIMIT 30) h
  ),'[]'::jsonb)
 );
END;
$body$;

CREATE FUNCTION public.frela_admin_change_price(
 p_code text,p_price_cents integer,p_expected_revision integer,p_reason text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $body$
DECLARE actor text; current_offer app_private.commercial_offers%ROWTYPE;
BEGIN
 actor:=public.frela_auth_user_id();
 IF actor IS NULL OR NOT EXISTS (
   SELECT 1 FROM app_private.admin_operators
   WHERE user_id=actor AND active
 ) THEN
   RAISE EXCEPTION 'Acesso administrativo negado' USING ERRCODE='42501';
 END IF;
 IF p_code IS NULL OR p_code !~ '^[a-z][a-z0-9_]{2,49}$'
    OR p_price_cents IS NULL OR p_price_cents NOT BETWEEN 0 AND 10000000
    OR p_expected_revision IS NULL OR p_expected_revision<1
    OR char_length(btrim(coalesce(p_reason,''))) NOT BETWEEN 10 AND 500 THEN
   RAISE EXCEPTION 'Parâmetros comerciais inválidos';
 END IF;
 SELECT * INTO current_offer FROM app_private.commercial_offers
 WHERE code=p_code AND status='draft' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Oferta não encontrada ou indisponível'; END IF;
 IF current_offer.revision <> p_expected_revision THEN
   RAISE EXCEPTION 'Preço alterado por outra sessão; recarregue a página';
 END IF;
 IF current_offer.price_cents = p_price_cents THEN
   RAISE EXCEPTION 'O novo valor deve ser diferente do anterior';
 END IF;
 UPDATE app_private.commercial_offers
 SET price_cents=p_price_cents,revision=revision+1,updated_at=now()
 WHERE code=p_code;
 INSERT INTO app_private.commercial_price_history
 (offer_code,operator_user_id,old_price_cents,new_price_cents,old_revision,new_revision,reason)
 VALUES (p_code,actor,current_offer.price_cents,p_price_cents,
 current_offer.revision,current_offer.revision+1,p_reason);
 RETURN jsonb_build_object(
 'ok',true,'code',p_code,'price_cents',p_price_cents,
 'revision',current_offer.revision+1,'publicCheckoutEnabled',false);
END;
$body$;

REVOKE ALL ON FUNCTION public.frela_admin_commercial() FROM PUBLIC,anonymous,authenticated;
REVOKE ALL ON FUNCTION public.frela_admin_change_price(text,integer,integer,text) FROM PUBLIC,anonymous,authenticated;
GRANT EXECUTE ON FUNCTION public.frela_admin_commercial() TO authenticated;
GRANT EXECUTE ON FUNCTION public.frela_admin_change_price(text,integer,integer,text) TO authenticated;

COMMIT;
