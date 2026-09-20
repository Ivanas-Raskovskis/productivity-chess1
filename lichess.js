// ---------- LICHESS OAUTH (PKCE) ----------
const LICHESS_CLIENT_ID = 'productivity-chess-ivanas-raskovskis'; // <-- ČIA įrašyk savo Client ID iš Lichess
const LICHESS_REDIRECT_URI = 'https://ivanas-raskovskis.github.io/productivity-chess1/';
const LICHESS_SCOPE = 'board:play';

function base64UrlEncode(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function generateRandomString(length) {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return base64UrlEncode(array.buffer);
}

async function sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return await crypto.subtle.digest('SHA-256', data);
}

async function loginWithLichess() {
  const codeVerifier = generateRandomString(64);
  const codeChallenge = base64UrlEncode(await sha256(codeVerifier));
  const state = generateRandomString(16);

  sessionStorage.setItem('lichess_code_verifier', codeVerifier);
  sessionStorage.setItem('lichess_state', state);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: LICHESS_CLIENT_ID,
    redirect_uri: LICHESS_REDIRECT_URI,
    scope: LICHESS_SCOPE,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
    state: state
  });

  window.location.href = 'https://lichess.org/oauth?' + params.toString();
}

async function exchangeCodeForToken(code) {
  const codeVerifier = sessionStorage.getItem('lichess_code_verifier');

  const response = await fetch('https://lichess.org/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      code_verifier: codeVerifier,
      redirect_uri: LICHESS_REDIRECT_URI,
      client_id: LICHESS_CLIENT_ID
    })
  });

  const data = await response.json();

  if (data.access_token) {
    localStorage.setItem('lichess_token', data.access_token);
    return data.access_token;
  }

  console.error('Lichess token error:', data);
  return null;
}

async function fetchLichessAccount(token) {
  const response = await fetch('https://lichess.org/api/account', {
    headers: { Authorization: 'Bearer ' + token }
  });

  if (!response.ok) return null;
  return await response.json();
}

function renderLichessStatus(account) {
  const statusEl = document.getElementById('lichess-status');

  if (!account) {
    statusEl.innerHTML = '<button id="lichess-login-btn" onclick="loginWithLichess()">Prisijungti su Lichess</button>';
    return;
  }

  localStorage.setItem('lichess_username', account.username);

  const blitz = account.perfs && account.perfs.blitz ? account.perfs.blitz.rating : '—';
  const rapid = account.perfs && account.perfs.rapid ? account.perfs.rapid.rating : '—';
  const bullet = account.perfs && account.perfs.bullet ? account.perfs.bullet.rating : '—';

  statusEl.innerHTML =
    '<div class="lichess-card">' +
      '<div class="lichess-user">✅ Prisijungęs kaip <strong>' + account.username + '</strong></div>' +
      '<div class="lichess-ratings">' +
        '<span>Bullet: ' + bullet + '</span>' +
        '<span>Blitz: ' + blitz + '</span>' +
        '<span>Rapid: ' + rapid + '</span>' +
      '</div>' +
      '<button onclick="startSeek()">🎮 Ieškoti reitinguotos partijos (10+0)</button>' +
      '<button onclick="logoutLichess()">Atsijungti</button>' +
    '</div>';
}

function logoutLichess() {
  localStorage.removeItem('lichess_token');
  renderLichessStatus(null);
}

async function initLichess() {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const state = urlParams.get('state');
  const savedState = sessionStorage.getItem('lichess_state');

  if (code && state && state === savedState) {
    const token = await exchangeCodeForToken(code);
    window.history.replaceState({}, document.title, window.location.pathname);

    if (token) {
      const account = await fetchLichessAccount(token);
      renderLichessStatus(account);
      return;
    }
  }

  const existingToken = localStorage.getItem('lichess_token');
  if (existingToken) {
    const account = await fetchLichessAccount(existingToken);
    if (account) {
      renderLichessStatus(account);
      return;
    } else {
      localStorage.removeItem('lichess_token');
    }
  }

  renderLichessStatus(null);
}

initLichess();
