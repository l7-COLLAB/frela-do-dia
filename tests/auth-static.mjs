import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';

const code = readFileSync(new URL('../auth-preview/src/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../auth-preview/index.html', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../auth-preview/package.json', import.meta.url), 'utf8'));
assert.ok(pkg.dependencies['@neon/auth'], 'É obrigatório usar o SDK oficial Neon Auth');
assert.match(code, /createAuthClient\(authUrl\)/);
assert.match(code, /await auth\.getSession\(\)/);
assert.match(code, /await auth\.signIn\.email\(/);
assert.match(code, /await auth\.token\(\)/);
assert.match(code, /await auth\.signOut\(\)/);
assert.match(code, /row\.user_id === activeUser\.id/, 'Conferência defensiva de identidade ausente');
assert.doesNotMatch(code, /localStorage\.setItem\(|sessionStorage\.setItem\(/);
assert.doesNotMatch(code, /(?:DATABASE_URL|PGPASSWORD|NEON_API_KEY)/, 'Nunca acessar credenciais privadas do frontend');
assert.doesNotMatch(html, /type="submit"[^>]*>Criar conta/i, 'Cadastro público não habilitado');
assert.match(html, /AMBIENTE DE HOMOLOGAÇÃO/);
console.log('OK: login Neon Auth de homologação tem sessão, logout, leitura protegida e nenhum segredo conhecido.');
