const https = require('https');
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2 && !parts[0].startsWith('#')) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const url = env.SUPABASE_URL || 'https://gpwypyrqvvvnktxkkmyx.supabase.co';
const key = env.SUPABASE_ANON_KEY || '';

console.log('Target URL:', url);
console.log('Key length:', key.length, 'Key starts with:', key.substring(0, 15));

function doReq(path, method = 'GET', body = null) {
  return new Promise((resolve) => {
    const u = new URL(path, url);
    const req = https.request(u, {
      method,
      rejectUnauthorized: false,
      headers: {
        'apikey': key,
        'Authorization': 'Bearer ' + key,
        'Content-Type': 'application/json'
      }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        console.log(`[${method}] ${path} -> Status ${res.statusCode}:`);
        console.log(d.substring(0, 300));
        resolve({ code: res.statusCode, data: d });
      });
    });
    req.on('error', err => {
      console.error('Request error:', err.message);
      resolve({ code: 500, error: err.message });
    });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  console.log('\n--- 1. Testing GET /rest/v1/ninos ---');
  await doReq('/rest/v1/ninos?select=*');

  console.log('\n--- 1b. Testing POST /rest/v1/ninos ---');
  await doReq('/rest/v1/ninos', 'POST', {
    id_nino: 'nin_01',
    codigo_estudiante: 'EST-CAIMIUP-01',
    nombre_o_pseudonimo: 'Mateo G.',
    fecha_nacimiento: '2019-04-12',
    nivel_actual: 1
  });

  console.log('\n--- 2. Testing GET /rest/v1/perfiles_usuarios ---');
  await doReq('/rest/v1/perfiles_usuarios?select=*');

  console.log('\n--- 3. Testing POST /rest/v1/perfiles_usuarios ---');
  await doReq('/rest/v1/perfiles_usuarios', 'POST', {
    id: 'b4a0f44e-1234-4567-890a-bcdef0123456',
    email: 'test_verify@caimiup.edu.co',
    nombre_completo: 'Test User',
    role: 'docente'
  });

  console.log('\n--- 4. Testing POST /auth/v1/signup ---');
  await doReq('/auth/v1/signup', 'POST', {
    email: 'test_signup_probe@caimiup.edu.co',
    password: 'Password123!',
    data: { nombre_completo: 'Test Probe' }
  });
}

run();
