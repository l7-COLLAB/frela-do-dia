-- Frela do Dia | 0001: modelo inicial
-- ALVO: Neon PostgreSQL com Neon Auth + Data API habilitados.
-- Esta migração não substitui a autenticação nem é aplicada automaticamente.
-- Execução exclusiva via editor SQL/role administrativa do projeto Neon.
BEGIN;

CREATE TABLE public.worker_profiles (
  user_id text PRIMARY KEY DEFAULT (auth.user_id()),
  display_name text NOT NULL CHECK (char_length(btrim(display_name)) BETWEEN 2 AND 100),
  city text NOT NULL CHECK (char_length(btrim(city)) BETWEEN 2 AND 100),
  bio text CHECK (char_length(bio) <= 800),
  skills text[] NOT NULL DEFAULT '{}'::text[],
  availability text CHECK (char_length(availability) <= 250),
  phone_private text CHECK (char_length(phone_private) <= 30),
  resume_object_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id text NOT NULL DEFAULT (auth.user_id()),
  legal_name text NOT NULL CHECK (char_length(btrim(legal_name)) BETWEEN 2 AND 180),
  display_name text NOT NULL CHECK (char_length(btrim(display_name)) BETWEEN 2 AND 120),
  city text NOT NULL CHECK (char_length(btrim(city)) BETWEEN 2 AND 100),
  contact_email_private text,
  contact_phone_private text,
  verification_state text NOT NULL DEFAULT 'pending'
    CHECK (verification_state IN ('pending','verified','rejected','suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX companies_owner_idx ON public.companies(owner_user_id);

CREATE TABLE public.job_postings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 5 AND 140),
  company_display_name text NOT NULL CHECK (char_length(btrim(company_display_name)) BETWEEN 2 AND 120),
  city text NOT NULL CHECK (char_length(btrim(city)) BETWEEN 2 AND 100),
  district text CHECK (char_length(district) <= 100),
  category text NOT NULL CHECK (char_length(btrim(category)) BETWEEN 2 AND 80),
  tasks text NOT NULL CHECK (char_length(btrim(tasks)) BETWEEN 10 AND 5000),
  requirements text CHECK (char_length(requirements) <= 2500),
  appearance_safety_rules text CHECK (char_length(appearance_safety_rules) <= 1200),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  break_minutes integer NOT NULL DEFAULT 0 CHECK (break_minutes BETWEEN 0 AND 480),
  pay_cents integer NOT NULL CHECK (pay_cents > 0),
  payment_terms text NOT NULL CHECK (char_length(btrim(payment_terms)) BETWEEN 3 AND 500),
  slots integer NOT NULL DEFAULT 1 CHECK (slots BETWEEN 1 AND 200),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','published','closed','rejected','cancelled')),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  CONSTRAINT job_postings_id_company_unique UNIQUE(id, company_id)
);
CREATE INDEX job_postings_status_starts_idx ON public.job_postings(status,starts_at);
CREATE INDEX job_postings_company_idx ON public.job_postings(company_id);

-- Endereços exatos não devem ser armazenados na tabela pública de vagas.
CREATE TABLE public.job_private_locations (
  job_id uuid PRIMARY KEY REFERENCES public.job_postings(id) ON DELETE CASCADE,
  full_address text NOT NULL CHECK (char_length(btrim(full_address)) BETWEEN 5 AND 500),
  arrival_instructions text CHECK (char_length(arrival_instructions) <= 2000)
);

CREATE TABLE public.applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.job_postings(id),
  applicant_user_id text NOT NULL DEFAULT (auth.user_id()),
  message_private text CHECK (char_length(message_private) <= 1800),
  status text NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted','shortlisted','accepted','rejected','withdrawn')),
  applied_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT applications_one_per_job UNIQUE(job_id, applicant_user_id)
);
CREATE INDEX applications_user_idx ON public.applications(applicant_user_id);

-- O registro de contratação é emitido/modificado SOMENTE pelo backend confiável.
CREATE TABLE public.engagements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL,
  company_id uuid NOT NULL,
  worker_user_id text NOT NULL,
  status text NOT NULL DEFAULT 'accepted'
    CHECK (status IN ('accepted','completed','cancelled','disputed')),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT engagements_job_company_fk FOREIGN KEY(job_id,company_id)
    REFERENCES public.job_postings(id,company_id),
  CONSTRAINT engagements_from_application_fk FOREIGN KEY(job_id,worker_user_id)
    REFERENCES public.applications(job_id,applicant_user_id),
  CONSTRAINT engagements_one_per_job_worker UNIQUE(job_id,worker_user_id),
  CHECK (status <> 'completed' OR completed_at IS NOT NULL)
);
CREATE INDEX engagements_worker_idx ON public.engagements(worker_user_id);
CREATE INDEX engagements_company_idx ON public.engagements(company_id);

-- Avaliações não são públicas neste MVP. Aprovação e disputa são processos administrativos.
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id uuid NOT NULL REFERENCES public.engagements(id),
  author_user_id text NOT NULL DEFAULT (auth.user_id()),
  author_side text NOT NULL CHECK(author_side IN ('worker','company')),
  overall_score smallint NOT NULL CHECK(overall_score BETWEEN 1 AND 5),
  criteria jsonb NOT NULL CHECK(jsonb_typeof(criteria) = 'object'),
  comment text CHECK(char_length(comment) <= 1000),
  moderation_state text NOT NULL DEFAULT 'pending'
    CHECK(moderation_state IN ('pending','approved','hidden','contested')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reviews_one_per_side UNIQUE(engagement_id,author_side)
);
CREATE INDEX reviews_author_idx ON public.reviews(author_user_id);


-- Proteção de base aplicada ANTES do primeiro COMMIT, evitando janela
-- de exposição mesmo se 0002 ainda não tiver sido executada.
ALTER TABLE public.worker_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_postings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_private_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.worker_profiles, public.companies, public.job_postings,
  public.job_private_locations, public.applications,
  public.engagements, public.reviews
FROM PUBLIC, anonymous, authenticated;

COMMIT;
