-- Frela do Dia | 0003 — contestação de pagamento com conciliação privada
-- EXECUÇÃO: APENAS no Neon de TESTES, depois de 0001 e 0002.
-- Requer Neon Auth/Data API; não aplicado automaticamente.
-- Presunção: relato ou falta de comprovante NÃO comprova inadimplência.
-- Publicação exige revisão administrativa e texto neutro/factual.
BEGIN;

CREATE TABLE public.payment_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id uuid NOT NULL UNIQUE REFERENCES public.engagements(id),
  worker_user_id text NOT NULL DEFAULT (auth.user_id()),
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 10 AND 2000),
  status text NOT NULL DEFAULT 'private_open' CHECK (status IN (
    'private_open','awaiting_company','under_review',
    'resolved_paid','resolved_agreement','closed_inconclusive','public_notice_approved'
  )),
  reply_due_at timestamptz,
  resolved_at timestamptz,
  opened_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payment_disputes_worker_idx ON public.payment_disputes(worker_user_id);
CREATE INDEX payment_disputes_status_idx ON public.payment_disputes(status);

CREATE TABLE public.payment_dispute_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id uuid NOT NULL REFERENCES public.payment_disputes(id),
  author_user_id text NOT NULL DEFAULT (auth.user_id()),
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payment_dispute_messages_dispute_idx
  ON public.payment_dispute_messages(dispute_id,created_at);

-- Metadados de arquivos: upload e acesso ao conteúdo SOMENTE por API confiável.
-- Nem a URL assinada nem a chave do documento aparecem nos perfis públicos.
CREATE TABLE public.payment_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id uuid NOT NULL REFERENCES public.payment_disputes(id),
  submitted_by text NOT NULL,
  storage_object_key text NOT NULL,
  evidence_type text NOT NULL CHECK (evidence_type IN (
    'payment_receipt','bank_statement','agreement','other'
  )),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Projeção explicitamente pública e separada da denúncia privada.
-- Não conter nome do trabalhador, comprovante, conta bancária ou mensagens.
-- Só um operador autorizado pode publicar, editar ou retirar um aviso.
CREATE TABLE public.payment_public_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id uuid NOT NULL UNIQUE REFERENCES public.payment_disputes(id),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  notice_type text NOT NULL CHECK (
    notice_type IN ('payment_contested','payment_unpaid_substantiated')
  ),
  summary text NOT NULL CHECK (char_length(btrim(summary)) BETWEEN 12 AND 420),
  moderation_reason text NOT NULL CHECK (char_length(btrim(moderation_reason)) BETWEEN 12 AND 1500),
  reviewed_by text NOT NULL,
  reviewed_at timestamptz NOT NULL,
  published_at timestamptz,
  withdrawn_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (published_at IS NULL OR published_at >= reviewed_at)
);
CREATE INDEX payment_public_notices_company_idx
  ON public.payment_public_notices(company_id,published_at);

-- O padrão é negar tudo. Nenhum usuário controla publicação/resultado.
ALTER TABLE public.payment_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_dispute_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_public_notices ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.payment_disputes,
  public.payment_dispute_messages,
  public.payment_evidence,
  public.payment_public_notices
FROM PUBLIC, anonymous, authenticated;

CREATE POLICY payment_disputes_private_read ON public.payment_disputes
 FOR SELECT TO authenticated
 USING (
   worker_user_id = (SELECT auth.user_id())
   OR EXISTS (
     SELECT 1 FROM public.engagements e
     JOIN public.companies c ON c.id = e.company_id
     WHERE e.id = public.payment_disputes.engagement_id
       AND c.owner_user_id = (SELECT auth.user_id())
   )
 );

CREATE POLICY payment_disputes_worker_open ON public.payment_disputes
 FOR INSERT TO authenticated
 WITH CHECK (
   worker_user_id = (SELECT auth.user_id())
   AND status = 'private_open'
   AND reply_due_at IS NULL
   AND resolved_at IS NULL
   AND EXISTS (
     SELECT 1 FROM public.engagements e
     WHERE e.id = public.payment_disputes.engagement_id
       AND e.worker_user_id = (SELECT auth.user_id())
       AND e.completed_at IS NOT NULL
       AND e.status IN ('completed','disputed')
   )
 );
GRANT SELECT, INSERT ON public.payment_disputes TO authenticated;
-- Prazo, encerramento, reabertura e moderação: backend autorizado.

CREATE POLICY payment_messages_participants_read ON public.payment_dispute_messages
 FOR SELECT TO authenticated
 USING (
   EXISTS (
     SELECT 1 FROM public.payment_disputes d
     WHERE d.id = public.payment_dispute_messages.dispute_id
   )
 );
CREATE POLICY payment_messages_participants_write ON public.payment_dispute_messages
 FOR INSERT TO authenticated
 WITH CHECK (
   author_user_id = (SELECT auth.user_id())
   AND EXISTS (
     SELECT 1 FROM public.payment_disputes d
     WHERE d.id = public.payment_dispute_messages.dispute_id
       AND d.status IN ('private_open','awaiting_company','under_review')
   )
 );
GRANT SELECT, INSERT ON public.payment_dispute_messages TO authenticated;

-- Sem acesso direto para usuários: metadados e arquivos obtidos por
-- endpoint autenticado, após verificar que a pessoa pertence à disputa.
-- A RLS do banco NÃO controla automaticamente o storage externo.

CREATE POLICY payment_public_notices_read_approved ON public.payment_public_notices
 FOR SELECT TO anonymous, authenticated
 USING (
   reviewed_at IS NOT NULL
   AND published_at IS NOT NULL
   AND published_at <= now()
   AND withdrawn_at IS NULL
 );
GRANT SELECT ON public.payment_public_notices TO anonymous, authenticated;

-- IMPORTANTE: a elegibilidade para divulgação deve ser verificada pelo
-- backend com evidências, prazo de resposta e decisão humana auditável.
-- Ausência de comprovante NÃO aciona INSERT/UPDATE nesta tabela.
COMMIT;
