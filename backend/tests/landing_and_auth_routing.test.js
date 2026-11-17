/**
 * =====================================================================
 * TEST SUITE: LANDING PAGE INSTITUCIONAL Y ENRUTAMIENTO ESTRICTO RBAC
 * Fase 4: Desarrollo de Software Web & Fase 6: Pruebas del Sistema
 * Agente: QA_Integration_Tester
 * =====================================================================
 */

const http = require('http');
const assert = require('assert');
const path = require('path');
const fs = require('fs');

// Cargar .env si existe
const envPath = path.join(__dirname, '../../.env');
if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') {
  try { process.loadEnvFile(envPath); } catch (e) {}
}

const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}`;

function request(method, pathname, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathname, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = data;
        try {
          parsed = JSON.parse(data);
        } catch (e) {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: parsed,
          raw: data
        });
      });
    });

    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error(`Timeout al solicitar ${pathname}`));
    });

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}`);
    failed++;
  }
}

async function runTests() {
  console.log('======================================================');
  console.log('[QA_Integration_Tester]: Validando Landing Page y Enrutamiento RBAC');
  console.log('Módulos: Portal Público | Gateway Login | 4 Dashboards Segregados | Contacto');
  console.log('======================================================\n');

  // Test 1: Disponibilidad y contenido de la Landing Page
  await test('GET / - Landing Page institucional pública activa con W3C standards', async () => {
    const res = await request('GET', '/');
    assert.strictEqual(res.status, 200);
    assert.ok(res.headers['content-type'].includes('text/html'));
    assert.ok(res.raw.includes('PictoAprende CAIMIUP'));
    assert.ok(res.raw.includes('Entorno Interactivo de Aprendizaje para Niños con TEA'));
    assert.ok(res.raw.includes('Portal de Acceso Institucional CAIMIUP'));
  });

  // Test 2: Login Admin único autorizado con redirección estricta a /dashboard/admin.html
  await test('POST /api/supabase/login - Autenticación Admin única (admipictoaprende@gmail.com) con redirección forzosa a admin.html', async () => {
    const res = await request('POST', '/api/supabase/login', {
      email: 'admipictoaprende@gmail.com',
      password: 'AdmiPictoaprende2026'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.exito, true);
    assert.strictEqual(res.body.role, 'admin');
    assert.strictEqual(res.body.redirectUrl, '/dashboard/admin.html');
    assert.ok(res.body.token);
  });

  // Test 3: Rechazo de contraseña incorrecta para la cuenta admin
  await test('POST /api/supabase/login - Rechazo de contraseña incorrecta para admin (401)', async () => {
    const res = await request('POST', '/api/supabase/login', {
      email: 'admipictoaprende@gmail.com',
      password: 'PasswordIncorrecto2026'
    });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.exito, false);
    assert.ok(res.body.mensaje.includes('Contraseña incorrecta'));
  });

  // Test 4: Rechazo de cuentas anteriores eliminadas (docente y padre)
  await test('POST /api/supabase/login - Rechazo de cuentas eliminadas (docente y padre) (401)', async () => {
    const resDocente = await request('POST', '/api/supabase/login', {
      email: 'docente@caimiup.edu.co',
      password: 'caimiup2026'
    });
    assert.strictEqual(resDocente.status, 401);
    assert.strictEqual(resDocente.body.exito, false);

    const resPadre = await request('POST', '/api/supabase/login', {
      email: 'padre@caimiup.edu.co',
      password: 'caimiup2026'
    });
    assert.strictEqual(resPadre.status, 401);
    assert.strictEqual(resPadre.body.exito, false);
  });

  // Test 5: Rechazo del rol Visitante/Guest por eliminación formal del rol (401)
  await test('POST /api/supabase/login - Rechazo de rol Visitante/Guest por eliminación del rol (401)', async () => {
    const res = await request('POST', '/api/supabase/login', {
      email: 'visitante@caimiup.edu.co',
      password: 'caimiup2026'
    });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.exito, false);
  });

  // Test 6: Rechazo de credenciales inexistentes con 401
  await test('POST /api/supabase/login - Rechazo de usuario no registrado (401)', async () => {
    const res = await request('POST', '/api/supabase/login', {
      email: 'intruso@externo.com',
      password: 'password123'
    });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.exito, false);
    assert.ok(res.body.mensaje.includes('no está registrado'));
  });

  // Test 7: Rechazo de contraseña vacía con 401
  await test('POST /api/supabase/login - Rechazo de contraseña vacía (401)', async () => {
    const res = await request('POST', '/api/supabase/login', {
      email: 'admipictoaprende@gmail.com',
      password: '   '
    });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.exito, false);
  });

  // Test 8: Verificación de disponibilidad de /dashboard/admin.html con AuthGuard
  await test('GET /dashboard/admin.html - Panel de Administrador protegido con AuthGuard', async () => {
    const res = await request('GET', '/dashboard/admin.html');
    assert.strictEqual(res.status, 200);
    assert.ok(res.raw.includes("AuthGuard.protect(['admin'])"));
    assert.ok(res.raw.includes('Panel de Administración Global'));
  });

  // Test 9: Verificación de disponibilidad de /dashboard/docente.html con AuthGuard
  await test('GET /dashboard/docente.html - Panel de Docente protegido con AuthGuard', async () => {
    const res = await request('GET', '/dashboard/docente.html');
    assert.strictEqual(res.status, 200);
    assert.ok(res.raw.includes("AuthGuard.protect(['docente', 'admin'])"));
    assert.ok(res.raw.includes('Panel de Especialista y Asignación Pedagógica'));
  });

  // Test 10: Verificación de disponibilidad de /dashboard/padre.html con AuthGuard
  await test('GET /dashboard/padre.html - Panel de Padre protegido con AuthGuard', async () => {
    const res = await request('GET', '/dashboard/padre.html');
    assert.strictEqual(res.status, 200);
    assert.ok(res.raw.includes("AuthGuard.protect(['padre', 'admin'])"));
    assert.ok(res.raw.includes('Reporte Analítico de Avance Familiar'));
  });

  // Test 11: Verificación de retiro y redirección del rol Invitado en /dashboard/guest.html
  await test('GET /dashboard/guest.html - Redirección forzosa al portal por eliminación del rol Invitado', async () => {
    const res = await request('GET', '/dashboard/guest.html');
    assert.strictEqual(res.status, 200);
    assert.ok(res.raw.includes('window.location.replace'));
  });

  // Test 12: Formulario público de contacto con validación
  await test('POST /api/contacto - Recepción y almacenamiento de consulta ciudadana CAIMIUP', async () => {
    const res = await request('POST', '/api/contacto', {
      nombre: 'Dra. Claudia Morales',
      correo: 'claudia.morales@unipamplona.edu.co',
      asunto: 'Consulta sobre metodología TEACCH y PictoAprende',
      mensaje: 'Buenas tardes equipo CAIMIUP, me gustaría coordinar una visita técnica al aula interactiva.'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.exito, true);
    assert.ok(res.body.contacto.id);
  });

  console.log('\n======================================================');
  console.log(`[QA_Integration_Tester]: Tests Ejecutados: ${passed} PASARON, ${failed} FALLARON.`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('[QA_Integration_Tester] Error fatal en suite de pruebas:', err);
  process.exit(1);
});
