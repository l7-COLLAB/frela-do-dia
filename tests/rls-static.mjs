import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';

const initial = readFileSync(new URL('../database/migrations/0001_initial_schema.sql', import.meta.url),'utf8');
const policies = readFileSync(new URL('../database/migrations/0002_rls_policies.sql', import.meta.url),'utf8');
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
console.log('OK: seis tabelas protegidas, permissões básicas verificadas estaticamente. Testes com usuários reais ainda são obrigatórios.');
