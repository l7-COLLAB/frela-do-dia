import { createAuthClient } from '@neon/auth';

const authUrl = import.meta.env.VITE_NEON_AUTH_URL;
const apiUrl = import.meta.env.VITE_NEON_DATA_API_URL;
const $ = (id) => document.getElementById(id);
const signInForm = $('signInForm');
const sessionPanel = $('sessionPanel');
const status = $('status');
const signInButton = signInForm.querySelector('button[type="submit"]');
const checkButton = $('checkAccess');
const signOutButton = $('signOut');

let auth = null;
let activeUser = null;

function report(message, isError = false) {
  status.textContent = message;
  status.classList.toggle('error', isError);
}

function busy(value) {
  signInButton.disabled = value;
  checkButton.disabled = value;
  signOutButton.disabled = value;
}

function renderSession(user) {
  activeUser = user ?? null;
  signInForm.hidden = !!activeUser;
  sessionPanel.hidden = !activeUser;
  $('loggedUser').textContent = activeUser
    ? 'Sessão autenticada: ' + (activeUser.email || activeUser.name || 'usuário de teste')
    : '';
}

async function restoreSession() {
  busy(true);
  try {
    const { data, error } = await auth.getSession();
    if (error) throw new Error(error.message || 'Erro ao consultar a sessão.');
    renderSession(data?.user);
    report(data?.user ? 'Sessão restaurada.' : 'Nenhuma sessão ativa. Entre com uma conta de homologação.');
  } catch (error) {
    renderSession(null);
    report('Não foi possível confirmar a sessão: ' + error.message, true);
  } finally {
    busy(false);
  }
}

if (!authUrl || /SUA-BRANCH/.test(authUrl)) {
  busy(true);
  report('Configure VITE_NEON_AUTH_URL em .env.local antes de executar o preview.', true);
} else {
  // API pública oficial do Neon Auth, sem senha de banco ou chaves administrativas.
  auth = createAuthClient(authUrl);
  restoreSession();
}

signInForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!auth) return;
  busy(true);
  const email = $('email').value.trim();
  const password = $('password').value;
  try {
    const { data, error } = await auth.signIn.email({ email, password });
    if (error) throw new Error(error.message || 'Falha no login.');
    const session = await auth.getSession();
    if (session.error || !session.data?.user) {
      throw new Error('Login realizado, mas a sessão não pôde ser confirmada.');
    }
    renderSession(session.data.user);
    $('password').value = '';
    report('Acesso autenticado para homologação.');
  } catch (error) {
    report(error.message || 'Não foi possível entrar.', true);
  } finally {
    busy(false);
  }
});

checkButton.addEventListener('click', async () => {
  if (!auth || !activeUser) return;
  if (!apiUrl || /SUA-BRANCH/.test(apiUrl)) {
    report('Configure VITE_FRELA_API_URL para testar a leitura protegida de dados.', true);
    return;
  }
  busy(true);
  try {
    const { data, error } = await auth.token();
    if (error || !data?.token) throw new Error('Não foi possível obter um token de sessão válido.');
    const url = new URL(apiUrl.replace(/\/$/, '') + '/v1/me/worker');
    const response = await fetch(url, {
      headers: {
        Authorization: 'Bearer ' + data.token,
        Accept: 'application/json'
      },
      cache: 'no-store',
      credentials: 'omit'
    });
    const payload = await response.json();
    if (!response.ok) throw new Error('Consulta bloqueada: HTTP ' + response.status);
    if (!Array.isArray(payload?.items)) throw new Error('Resposta inesperada da API.');
    // Confere defensivamente os IDs recebidos; a proteção principal é a RLS do Neon.
    const own = payload.items.filter((row) => row.user_id === activeUser.id);
    if (payload.items.length !== own.length) throw new Error('RLS inconsistente: registro de outro usuário retornado.');
    report(own.length ? 'Seu próprio perfil está acessível pela RLS.' : 'Consulta autorizada pelo backend. Você ainda não tem perfil criado.');
  } catch (error) {
    report('Falha no teste de acesso: ' + (error.message || 'erro desconhecido'), true);
  } finally {
    busy(false);
  }
});

signOutButton.addEventListener('click', async () => {
  if (!auth) return;
  busy(true);
  try {
    const { error } = await auth.signOut();
    if (error) throw new Error(error.message || 'Falha ao encerrar sessão.');
    const check = await auth.getSession();
    if (check.error) throw new Error(check.error.message || 'Sessão não confirmada.');
    if (check.data?.user) throw new Error('A sessão ainda aparece ativa após a saída.');
    renderSession(null);
    report('Você saiu da conta.');
  } catch (error) {
    report(error.message || 'Não foi possível sair.', true);
  } finally {
    busy(false);
  }
});
