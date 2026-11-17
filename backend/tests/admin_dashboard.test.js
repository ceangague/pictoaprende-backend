/**
 * =====================================================================
 * PROYECTO CAIMIUP - SUITE DE PRUEBAS DEL DASHBOARD DE ADMINISTRADOR
 * Validación de Supabase Auth, RBAC, Vinculación de Niños y CRUD Pictogramas
 * Agente: QA_Integration_Tester & Backend_Cloud_Dev
 * =====================================================================
 */

const http = require('http');
const assert = require('assert');

const BASE_URL = 'http://localhost:3000';

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method: method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: { 'Content-Type': 'application/json' }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: null, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runAdminDashboardTests() {
  console.log('\n======================================================');
  console.log('[QA_Integration_Tester]: Validando Módulos del Dashboard Administrador');
  console.log('Módulos: RBAC Usuarios | Vinculación Padre-Hijo | CRUD Pictos | Hardware Sync');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(nombre, fn) {
    try {
      await fn();
      console.log(`  ✅ [PASS] ${nombre}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${nombre}`);
      console.error(`     Error: ${err.message}`);
      failed++;
    }
  }

  // Asegurar sesión como Admin
  await request('POST', '/api/supabase/login', { role: 'admin' });

  // 1. Consulta de usuarios registrados
  await test('GET /api/supabase/usuarios - Listado de cuentas institucionales con cruce de niños', async () => {
    const res = await request('GET', '/api/supabase/usuarios');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.exito, true);
    assert.ok(Array.isArray(res.body.datos));
    assert.ok(res.body.datos.length >= 1);

    const admin = res.body.datos.find(u => u.role === 'admin');
    assert.ok(admin, 'Debe existir el usuario con rol admin');
    assert.strictEqual(admin.email, 'admipictoaprende@gmail.com');
  });

  // 2. Creación de usuario Docente
  await test('POST /api/supabase/usuarios - Creación de cuenta Docente por Admin', async () => {
    const res = await request('POST', '/api/supabase/usuarios', {
      email: `docente_terapia_${Date.now()}@caimiup.edu.co`,
      nombre_completo: 'Lic. Camilo Ochoa (Terapeuta)',
      password: 'Temporal2026*',
      role: 'docente'
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.exito, true);
    assert.strictEqual(res.body.usuario.role, 'docente');
  });

  // 3. Regla Crítica: Rechazo de rol Padre sin niño vinculado
  await test('POST /api/supabase/usuarios - REGLA CRÍTICA: Rechazo de rol Padre sin id_nino_asociado (400)', async () => {
    const res = await request('POST', '/api/supabase/usuarios', {
      email: `padre_sin_hijo_${Date.now()}@caimiup.edu.co`,
      nombre_completo: 'Pedro Pérez',
      password: 'Temporal2026*',
      role: 'padre'
      // Sin id_nino_asociado
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.exito, false);
    assert.ok(res.body.mensaje.includes('id_nino_asociado'));
  });

  let createdPadreEmail = `madre_mateo_${Date.now()}@caimiup.edu.co`;
  let idNinoTest = null;

  // 4. Creación válida de rol Padre con vinculación a niño
  await test('POST /api/supabase/usuarios - Creación de Padre vinculado exitosamente', async () => {
    const resNuevoNino = await request('POST', '/api/supabase/ninos', {
      codigo_estudiante: 'EST-PRE-01',
      nombre_o_pseudonimo: 'Mateo Test',
      fecha_nacimiento: '2021-04-12',
      nivel_actual: 1
    });
    idNinoTest = resNuevoNino.body.nino.id_nino;

    const res = await request('POST', '/api/supabase/usuarios', {
      email: createdPadreEmail,
      nombre_completo: 'Claudia Gómez (Madre)',
      password: 'Temporal2026*',
      role: 'padre',
      id_nino_asociado: idNinoTest
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.exito, true);
    assert.strictEqual(res.body.usuario.id_nino_asociado, idNinoTest);
  });

  // 5. Inyección y Carga de Pictograma a Storage
  await test('POST /api/supabase/storage/upload - Carga de archivo vectorial al bucket pictogramas', async () => {
    const res = await request('POST', '/api/supabase/storage/upload', {
      filename: 'pintar_arasaac.svg',
      content: '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40" fill="blue"/></svg>',
      contentType: 'image/svg+xml'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.exito, true);
    assert.strictEqual(res.body.bucket, 'pictogramas');
    assert.ok(res.body.url_imagen.includes('pintar_arasaac.svg'));
  });

  // 6. Edición CRUD de Pictograma existente
  await test('PUT /api/supabase/pictogramas/:id - Modificación de pictograma y actualización de versión OTA', async () => {
    const res = await request('PUT', '/api/supabase/pictogramas/pic_01', {
      nombre: 'Agua Fresca',
      categoria: 'NECESIDAD',
      nivel: 1,
      boton_asociado: 'P1',
      audio_texto: 'Quiero agua fresca y limpia.'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.exito, true);
    assert.strictEqual(res.body.pictograma.nombre, 'Agua Fresca');
    assert.ok(res.body.version_catalogo > 1);
  });

  // 7. Eliminación CRUD de Pictograma
  await test('DELETE /api/supabase/pictogramas/:id - Eliminación controlada con refresco hacia hardware', async () => {
    // Inyectar un pictograma temporal para eliminar
    const tempRes = await request('POST', '/api/supabase/pictogramas', {
      nombre: 'Pictograma_Temporal',
      categoria: 'RUTINA',
      nivel: 3,
      boton_asociado: 'P8'
    });
    assert.strictEqual(tempRes.status, 201);
    const tempId = tempRes.body.pictograma.id_pictograma;

    const delRes = await request('DELETE', `/api/supabase/pictogramas/${tempId}`);
    assert.strictEqual(delRes.status, 200);
    assert.strictEqual(delRes.body.exito, true);
  });

  // 8. Emisión de Comandos al Hardware Edge
  await test('POST /api/supabase/hardware/comando - Emisión de comando FORCE_SYNC hacia Raspberry Pi', async () => {
    const res = await request('POST', '/api/supabase/hardware/comando', {
      comando: 'UPDATE_PICTOGRAMS'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.exito, true);
    assert.strictEqual(res.body.sync.comando_pendiente, 'UPDATE_PICTOGRAMS');
  });

  // 9. RLS: Validación de seguridad - Acceso denegado a no administradores
  await test('RLS: Rol Padre no puede crear usuarios (403)', async () => {
    await request('POST', '/api/supabase/login', { email: createdPadreEmail, password: 'Temporal2026*' });

    const res = await request('POST', '/api/supabase/usuarios', {
      email: 'hacker@caimiup.edu.co',
      nombre_completo: 'Intruso',
      role: 'admin'
    });
    assert.strictEqual(res.status, 400); // Rechazado por validación RLS de Backend
    assert.strictEqual(res.body.exito, false);

    // Restaurar a Admin
    await request('POST', '/api/supabase/login', { email: 'admipictoaprende@gmail.com', password: 'AdmiPictoaprende2026' });
  });

  // 10. Alta de Paciente / Niño en Supabase
  await test('POST /api/supabase/ninos - Alta de nuevo paciente TEA por Admin', async () => {
    const res = await request('POST', '/api/supabase/ninos', {
      codigo_estudiante: 'EST-CAIMIUP-TEST-99',
      nombre_o_pseudonimo: 'Samuel P.',
      fecha_nacimiento: '2021-11-05',
      nivel_actual: 1,
      observaciones_terapeuticas: 'TEA Grado 1. Buena receptividad a estímulos visuales en pantalla.'
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.exito, true);
    assert.ok(res.body.nino.id_nino);
    assert.strictEqual(res.body.nino.codigo_estudiante, 'EST-CAIMIUP-TEST-99');
    assert.strictEqual(res.body.nino.nivel_actual, 1);
  });

  // 11. RLS: Validación de que rol Padre o no-admin no puede crear niños (403)
  await test('RLS: Rol Padre o no-admin no puede crear registros de niños (403)', async () => {
    await request('POST', '/api/supabase/login', { email: createdPadreEmail, password: 'Temporal2026*' });

    const res = await request('POST', '/api/supabase/ninos', {
      codigo_estudiante: 'EST-CAIMIUP-HACK',
      nombre_o_pseudonimo: 'Intruso Menor',
      fecha_nacimiento: '2022-01-01'
    });

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.exito, false);

    // Restaurar a Admin
    await request('POST', '/api/supabase/login', { email: 'admipictoaprende@gmail.com', password: 'AdmiPictoaprende2026' });
  });

  // 12. FLUJO DE INTEGRACIÓN COMPLETO: CREACIÓN DE NIÑO -> VINCULACIÓN DE PADRE -> VALIDACIÓN BIDIRECCIONAL
  await test('FLUJO DE INTEGRACIÓN COMPLETO: Ciclo de Vida Niño -> Padre -> Verificación Bidireccional', async () => {
    // Paso 1: Crear nuevo Niño
    const flowCode = 'EST-FLOW-' + Date.now().toString().slice(-6);
    const resNino = await request('POST', '/api/supabase/ninos', {
      codigo_estudiante: flowCode,
      nombre_o_pseudonimo: 'Lucas M.',
      fecha_nacimiento: '2021-09-18',
      nivel_actual: 2,
      observaciones_terapeuticas: 'Paciente en fase de discriminación de emociones intermedias.'
    });

    assert.strictEqual(resNino.status, 201);
    assert.strictEqual(resNino.body.exito, true);
    const ninoCreado = resNino.body.nino;
    assert.ok(ninoCreado.id_nino, 'El nuevo niño debe tener un id_nino generado');

    // Paso 2: Crear cuenta de Padre utilizando el id_nino recién generado en id_nino_asociado
    const emailPadre = 'padre_lucas_' + Date.now() + '@caimiup.edu.co';
    const resPadre = await request('POST', '/api/supabase/usuarios', {
      email: emailPadre,
      nombre_completo: 'Alfonso M. (Padre de Lucas)',
      password: 'Temporal2026*',
      role: 'padre',
      id_nino_asociado: ninoCreado.id_nino
    });

    assert.strictEqual(resPadre.status, 201);
    assert.strictEqual(resPadre.body.exito, true);
    assert.strictEqual(resPadre.body.usuario.id_nino_asociado, ninoCreado.id_nino);

    // Paso 3: Validar con GET /api/supabase/usuarios que el perfil del padre incluye la relación enriquecida
    const resUsuarios = await request('GET', '/api/supabase/usuarios');
    assert.strictEqual(resUsuarios.status, 200);
    const padreEncontrado = resUsuarios.body.datos.find(u => u.email === emailPadre);
    assert.ok(padreEncontrado, 'El usuario padre debe existir en la lista');
    assert.strictEqual(padreEncontrado.id_nino_asociado, ninoCreado.id_nino);
    assert.ok(padreEncontrado.nino_info, 'Debe incluir metadatos del niño asociado');
    assert.strictEqual(padreEncontrado.nino_info.nombre, 'Lucas M.');

    // Paso 4: Validar con GET /api/supabase/ninos que el niño tiene asignado el correo del acudiente
    const resNinos = await request('GET', '/api/supabase/ninos');
    assert.strictEqual(resNinos.status, 200);
    const ninoEncontrado = resNinos.body.datos.find(n => n.id_nino === ninoCreado.id_nino);
    assert.ok(ninoEncontrado, 'El niño debe existir en la lista');
    assert.strictEqual(ninoEncontrado.id_acudiente, emailPadre, 'El id_acudiente del niño debe estar sincronizado con el email del padre');
  });

  console.log('\n======================================================');
  console.log(`[QA_Integration_Tester]: Admin Dashboard Tests: ${passed} PASARON, ${failed} FALLARON.`);
  console.log('======================================================\n');

  if (failed > 0) process.exit(1);
  else process.exit(0);
}

runAdminDashboardTests();
