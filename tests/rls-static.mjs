import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';

const initial = readFileSync(new URL('../database/migrations/0001_initial_schema.sql', import.meta.url),'utf8');
const policies = readFileSync(new URL('../database/migrations/0002_rls_policies.sql', import.meta.url),'utf8');
const identityBridge = readFileSync(new URL('../database/migrations/0003_neon_auth_rls_bridge.sql', import.meta.url),'utf8');
const hirersMigration = readFileSync(new URL('../database/migrations/0004_individual_hirers_and_job_types.sql', import.meta.url),'utf8');
const hirersPolicies = readFileSync(new URL('../database/migrations/0005_individual_hirer_rls.sql', import.meta.url),'utf8');
const moderation = readFileSync(new URL('../database/migrations/0006_private_moderation_and_hiring.sql', import.meta.url),'utf8');
const moderationAudit = readFileSync(new URL('../database/tests/verify_moderation_security.sql', import.meta.url),'utf8');
const verify = readFileSync(new URL('../database/tests/verify_access.sql', import.meta.url),'utf8');

const tables = ['worker_profiles','companies','job_postings','job_private_locations','applications','engagements'];

for (const name of tables) {
  assert.match(initial, new RegExp('CREATE TABLE public\\.'+name+'\\s*\\(', 'i'), 'Tabela ausente: '+name);
  assert.match(initial, new RegExp('ALTER TABLE public\\.'+name+' ENABLE ROW LEVEL SECURITY;', 'i'), 'RLS deve ser habilitada no mesmo commit que cria '+name);
  assert.match(policies, new RegExp('ALTER TABLE public\\.'+name+' ENABLE ROW LEVEL SECURITY;', 'i'), 'RLS ausente nas políticas: '+name);
}

assert.ok(initial.indexOf('REVOKE ALL ON TABLE')<initial.lastIndexOf('COMMIT;'),'Revogação deve ocorrer na transação inicial');
assert.match(policies,/CREATE POLICY job_postings_public_list[\s\S]+?status = 'published' AND ends_at > now\(\)/);
assert.match(policies,/CREATE POLICY companies_owner_request[\s\S]+?verification_state = 'pending'/);
assert.match(policies,/CREATE POLICY job_postings_company_submit[\s\S]+?status = 'pending'[\s\S]+?verification_state = 'verified'/);
assert.match(policies,/e\.job_id = public\.job_private_locations\.job_id/);
assert.doesNotMatch(initial,/CREATE TABLE public\.reviews/);
assert.doesNotMatch(policies,/CREATE POLICY reviews_/);
assert.doesNotMatch(policies,/e\.job_id = job_id/,'Evitar correlação ambígua que expõe endereços de outras vagas');
assert.match(policies,/GRANT SELECT ON public\.job_postings TO anonymous, authenticated/);
assert.doesNotMatch(policies,/GRANT (?:ALL|UPDATE|DELETE) ON public\.(?:job_postings|engagements|companies) TO authenticated/);
assert.match(verify,/has_table_privilege\('anonymous', 'public\.worker_profiles', 'SELECT'\)/);
assert.match(identityBridge,/SECURITY DEFINER SET search_path = pg_catalog/);
assert.match(identityBridge,/REVOKE ALL ON FUNCTION public\.frela_auth_user_id\(\) FROM PUBLIC/);
assert.match(identityBridge,/GRANT EXECUTE ON FUNCTION public\.frela_auth_user_id\(\) TO authenticated/);
assert.match(identityBridge,/ALTER TABLE public\.worker_profiles ALTER COLUMN user_id SET DEFAULT public\.frela_auth_user_id\(\)/);
assert.match(identityBridge,/ALTER POLICY applications_participants_select/);
assert.match(identityBridge,/ALTER POLICY engagements_participants_select/);
assert.doesNotMatch(identityBridge,/DROP TABLE|DROP POLICY|TRUNCATE/i, 'Migração de compatibilidade não pode apagar dados');
assert.match(verify,/has_function_privilege\('authenticated','public\.frela_auth_user_id\(\)','EXECUTE'\)/);

assert.match(hirersMigration, /CREATE TABLE public\.individual_hirers/);
assert.match(hirersMigration, /ALTER TABLE public\.individual_hirers ENABLE ROW LEVEL SECURITY/);
assert.match(hirersMigration, /REVOKE ALL ON TABLE public\.individual_hirers FROM PUBLIC, anonymous, authenticated/);
assert.match(hirersMigration, /job_postings_exactly_one_hirer/);
assert.match(hirersMigration, /engagements_exactly_one_hirer/);
assert.match(hirersMigration, /job_postings_filled_slots_limit/);
assert.match(hirersMigration, /job_postings_pay_period_matches_type/);
assert.match(hirersMigration, /engagements_job_individual_fk/);
assert.match(hirersPolicies, /CREATE POLICY individual_hirers_self_select/);
assert.match(hirersPolicies, /CREATE POLICY individual_hirers_self_insert/);
assert.match(hirersPolicies, /ALTER POLICY job_postings_company_submit/);
assert.match(hirersPolicies, /AND h\.verification_state = 'verified'/);
assert.match(hirersPolicies, /AND c\.verification_state = 'verified'/);
assert.match(hirersPolicies, /filled_slots < slots/);
assert.doesNotMatch(hirersPolicies, /GRANT (?:ALL|UPDATE|DELETE) ON public\.individual_hirers TO authenticated/);
assert.doesNotMatch(hirersMigration, /\b(?:TRUNCATE|DELETE FROM|DROP TABLE)\b/i);

assert.match(moderation, /CREATE SCHEMA IF NOT EXISTS app_private/);
assert.match(moderation, /REVOKE ALL ON SCHEMA app_private FROM PUBLIC, anonymous, authenticated/);
assert.match(moderation, /ALTER TABLE app_private\.audit_events ENABLE ROW LEVEL SECURITY/);
assert.match(moderation, /CREATE FUNCTION app_private\.review_hirer/);
assert.match(moderation, /CREATE FUNCTION app_private\.review_job/);
assert.match(moderation, /CREATE FUNCTION app_private\.accept_application/);
assert.match(moderation, /SECURITY INVOKER SET search_path = pg_catalog/);
assert.match(moderation, /IF p_decision = 'suspended' THEN[\s\S]*?UPDATE public\.job_postings/);
assert.match(moderation, /FROM public\.job_postings WHERE id=a\.job_id FOR UPDATE/);
assert.match(moderation, /CASE WHEN filled_slots\+1>=slots THEN 'closed'/);
assert.match(moderation, /REVOKE EXECUTE ON FUNCTION\s+app_private\.review_hirer/);
assert.match(moderation, /REVOKE EXECUTE ON FUNCTION\s+app_private\.accept_application/);
assert.doesNotMatch(moderation, /GRANT EXECUTE.*(?:authenticated|anonymous)/);
assert.match(moderationAudit, /has_function_privilege\('authenticated'/);
console.log('OK: sete tabelas RLS e moderação privada de anunciantes, anúncios e seleção com limites. Testes JWT reais pendentes.');


