import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';

const html = readFileSync(new URL('../admin/index.html', import.meta.url),'utf8');
const app = readFileSync(new URL('../admin/app.js', import.meta.url),'utf8');
const api = readFileSync(new URL('../backend/dev-readonly-worker.js', import.meta.url),'utf8');
const main = readFileSync(new URL('../backend/public-site-worker.js', import.meta.url),'utf8');
const sql = readFileSync(new URL('../database/migrations/0007_admin_dashboard_access.sql', import.meta.url),'utf8');

for(const id of ['loginPanel','loginForm','email','dashboard','decisionPanel','decisionForm','justification','countCompanies','countIndividuals','countJobs','items','status','logoutInLogin','refresh','logout']){
 assert.ok(html.includes('id="'+id+'"'), 'Campo administrativo ausente: '+id);
}
assert.match(html, /noindex,nofollow/);
assert.match(html, /ACESSO RESTRITO/);
assert.match(app, /auth\.signIn\.magicLink/);
assert.match(app, /callbackURL/);
assert.doesNotMatch(html, /type="password"/);
assert.match(html, /Enviar link seguro de acesso/);
assert.match(app, /auth\.getSession/);
assert.match(app, /await auth\.token/);
assert.match(app, /\/v1\/admin\/queue/);
assert.match(app, /\/v1\/admin\/decision/);
assert.match(app, /auth\.signOut/);
assert.doesNotMatch(app, /localStorage\.setItem\(|sessionStorage\.setItem\(/);
assert.doesNotMatch(app, /(?:DATABASE_URL|PGPASSWORD|NEON_API_KEY)/);
assert.match(main, /'\/painel\/':'admin\/index.html'/);
assert.match(main, /'\/painel\/app.js':'admin\/app.js'/);
assert.match(api, /'frela_admin_queue'/);
assert.match(api, /'frela_admin_decide'/);
assert.match(sql, /CREATE TABLE app_private\.admin_operators/);
assert.match(sql, /active boolean NOT NULL DEFAULT false/);
assert.match(sql, /SECURITY DEFINER SET search_path=pg_catalog/);
assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.frela_admin_queue\(\) TO authenticated/);
assert.match(sql, /IF actor IS NULL OR NOT EXISTS/);
assert.doesNotMatch(sql, /INSERT INTO app_private\.admin_operators/);
assert.doesNotMatch(main, /postgresql:\/\//);
console.log('OK: rota pública sem credenciais, login restrito e decisões protegidas no Neon.');
