/* Teste temporário: fluxo OAuth loopback para obter um id_token real do Google.
 * 1. Liga um http.server local no 8899 para apanhar o ?code=
 * 2. Troca o code pelo token set (id_token) usando o client_secret do .env
 * 3. Escreve o id_token em .oauth-test-token e sai
 */
// @codebuff delete-this-after-test
require('dotenv').config();
const http = require('http');
const fs = require('fs');
const { spawn } = require('child_process');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID_WEB;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:8899/oauth-test';
const PORT = 8899;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('GOOGLE_CLIENT_ID_WEB/GOOGLE_CLIENT_SECRET ausentes no .env');
  process.exit(1);
}

const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
authUrl.searchParams.set('client_id', CLIENT_ID);
authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('scope', 'openid email profile');
authUrl.searchParams.set('prompt', 'consent');

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);
  if (u.pathname === '/oauth-test') {
    const code = u.searchParams.get('code');
    if (!code) {
      res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>Erro</h1><p>' + u.searchParams.get('error') + '</p>');
      process.exit(1);
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1><b>Teste em curso ✅</b></h1><p>Podes voltar ao terminal. Página de teste podes fechar.</p>');
    server.close();

    // Trocar code pelo token set
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }).toString(),
    });
    const json = await tokenRes.json();
    if (!json.id_token) {
      console.error('Falhou a troca do code:', JSON.stringify(json));
      process.exit(1);
    }
    fs.writeFileSync('.oauth-test-token', json.id_token, 'utf8');
    console.log('OK: id_token guardado em .oauth-test-token (email/sub podem ser vistos com jwt -d)');
    process.exit(0);
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(PORT, async () => {
  console.log('A abrir o browser para o consentimento Google...');
  const url = authUrl.toString();
  // Windows: abre o browser predefinido
  spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
  console.log('Se não abriu automaticamente, abre manualmente esta URL:');
  console.log(url);
});

setTimeout(() => {
  console.error('Timeout: ninguiem completou o consentimento em 5 min.');
  process.exit(1);
}, 5 * 60 * 1000);
