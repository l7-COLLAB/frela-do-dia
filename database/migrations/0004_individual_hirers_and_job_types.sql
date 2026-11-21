-- Frela do Dia | 0004: suporte a anunciantes PF e tipos de oportunidade
-- Aplicar SOMENTE após 0001, 0002 e 0003; início: branch de testes.
-- Evolução aditiva: preserva empresas, contratações e anúncios existentes.
BEGIN;

CREATE TABLE public.individual_hirers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_user_id text NOT NULL UNIQUE DEFAULT public.frela_auth_user_id(),
 display_name text NOT NULL CHECK (char_length(btrim(display_name)) BETWEEN 2 AND 90),
 city text NOT NULL CHECK (char_length(btrim(city)) BETWEEN 2 AND 100),
 contact_email_private text CHECK (char_length(contact_email_private) <= 254),
 contact_phone_private text CHECK (char_length(contact_phone_private) <= 30),
 verification_state text NOT NULL DEFAULT 'pending'
   CHECK (verification_state IN ('pending','verified','rejected','suspended')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS e ausência de privilégios ANTES do commit inicial da nova tabela.
ALTER TABLE public.individual_hirers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.individual_hirers FROM PUBLIC, anonymous, authenticated;

-- Cada anúncio pertence a exatamente UM contratante: PJ ou PF.
ALTER TABLE public.job_postings ALTER COLUMN company_id DROP NOT NULL;
ALTER TABLE public.job_postings
 ADD COLUMN individual_hirer_id uuid REFERENCES public.individual_hirers(id);
ALTER TABLE public.job_postings
 ADD CONSTRAINT job_postings_exactly_one_hirer
 CHECK ((company_id IS NOT NULL) <> (individual_hirer_id IS NOT NULL));

-- Modalidades e regras de remuneração: o campo ends_at descreve o período
-- inicialmente combinado; application_deadline indica fim das candidaturas.
ALTER TABLE public.job_postings
 ADD COLUMN opportunity_type text NOT NULL DEFAULT 'oneoff'
 CHECK (opportunity_type IN ('oneoff','temporary','permanent'));
ALTER TABLE public.job_postings
 ADD COLUMN employment_regime text CHECK (
   employment_regime IS NULL OR employment_regime IN
   ('clt','internship','formal_temporary','other')
 );
ALTER TABLE public.job_postings
 ADD COLUMN pay_period text NOT NULL DEFAULT 'per_job'
 CHECK (pay_period IN ('per_job','monthly'));
ALTER TABLE public.job_postings
 ADD COLUMN application_deadline timestamptz;
ALTER TABLE public.job_postings
 ADD COLUMN filled_slots integer NOT NULL DEFAULT 0
 CHECK (filled_slots >= 0);
ALTER TABLE public.job_postings
 ADD CONSTRAINT job_postings_filled_slots_limit
 CHECK (filled_slots <= slots);
ALTER TABLE public.job_postings
 ADD CONSTRAINT job_postings_pay_period_matches_type
 CHECK (
   (opportunity_type = 'permanent' AND pay_period = 'monthly')
   OR
   (opportunity_type <> 'permanent' AND pay_period = 'per_job')
 );
ALTER TABLE public.job_postings
 ADD CONSTRAINT job_postings_employment_regime_only_permanent
 CHECK (employment_regime IS NULL OR opportunity_type = 'permanent');
ALTER TABLE public.job_postings
 ADD CONSTRAINT job_postings_id_individual_hirer_unique UNIQUE (id, individual_hirer_id);
CREATE INDEX job_postings_individual_hirer_idx ON public.job_postings (individual_hirer_id);
CREATE INDEX job_postings_type_status_idx ON public.job_postings(opportunity_type,status,application_deadline);

-- Contratações individuais referem-se ao mesmo contratante definido na vaga.
-- Uma contratação também pertence exatamente a uma PJ ou PF.
ALTER TABLE public.engagements ALTER COLUMN company_id DROP NOT NULL;
ALTER TABLE public.engagements
 ADD COLUMN individual_hirer_id uuid REFERENCES public.individual_hirers(id);
ALTER TABLE public.engagements
 ADD CONSTRAINT engagements_exactly_one_hirer
 CHECK ((company_id IS NOT NULL) <> (individual_hirer_id IS NOT NULL));
ALTER TABLE public.engagements
 ADD CONSTRAINT engagements_job_individual_fk
 FOREIGN KEY (job_id,individual_hirer_id)
 REFERENCES public.job_postings(id,individual_hirer_id);
CREATE INDEX engagements_individual_hirer_idx ON public.engagements(individual_hirer_id);

-- Nenhuma permissão ampla é criada aqui. A 0005 adiciona políticas restritas.
COMMIT;
