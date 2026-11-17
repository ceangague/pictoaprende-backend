/**
 * =====================================================================
 * PROYECTO CAIMIUP - SUITE DE PRUEBAS DEL DASHBOARD DE DOCENTE / ESPECIALISTA
 * Validación de Asignación Hardware (sync_control), RLS Mensajería y Sesiones
 * Fases Metodológicas: Fase 2, Fase 4, Fase 5, Fase 6 (Pruebas del Sistema)
 * Agente: QA_Integration_Tester & Backend_Cloud_Dev
 * =====================================================================
 */

const http = require('http');
const assert = require('assert');

const BASE_URL = 'http://localhost:3000';

function request(method, path, body = null, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const headers = {
      'Content-Type': 'application/json',
      ...extraHeaders
    };

    const options = {
      method: method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: headers
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

async function runDocenteDashboardTests() {
  console.log('\n==================================================================');
  console.log('[QA_Integration_Tester]: Validando Módulos del Dashboard Docente TEA');
  console.log('Módulos: Asignación Hardware | sync_control | RLS Mensajería | Sesiones');
  console.log('==================================================================\n');

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

  // Headers simulando roles
  const docenteHeaders = {
    'Referer': 'http://localhost:3000/dashboard/docente.html',
    'x-user-role': 'docente',
    'x-user-id': 'usr_docente_01'
  };

  const padre1Headers = {
    'Referer': 'http://localhost:3000/dashboard/padre.html',
    'x-user-role': 'padre',
    'x-user-id': 'usr_padre_01',
    'x-user-email': 'padre.carlos@caimiup.edu.co'
  };

  const padre2Headers = {
    'Referer': 'http://localhost:3000/dashboard/padre.html',
    'x-user-role': 'padre',
    'x-user-id': 'usr_padre_02',
    'x-user-email': 'padre.marta@caimiup.edu.co'
  };

  // Asegurar sesión como Docente
  await request('POST', '/api/supabase/login', { role: 'docente' });

  // -------------------------------------------------------------------
  // TEST 1: Consulta del Directorio de Niños para Asignación
  // -------------------------------------------------------------------
  await test('Módulo 1: GET /api/supabase/ninos - Consulta de niños matriculados para el especialista', async () => {
    const res = await request('GET', '/api/supabase/ninos', null, docenteHeaders);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.exito, true);
    assert.ok(Array.isArray(res.body.datos), 'Debe retornar un arreglo de niños');
    assert.ok(res.body.datos.length >= 2, 'Debe haber al menos 2 niños de prueba');

    const mateo = res.body.datos.find(n => n.id_nino === 'nin_01' || n.codigo_estudiante === 'EST-2026-001');
    assert.ok(mateo, 'Debe existir el niño Mateo G.');
    assert.ok(typeof mateo.nivel_actual === 'number', 'Debe tener nivel_actual numérico');
  });

  // -------------------------------------------------------------------
  // TEST 2: Asignación de Sesión Clínica y Adaptación Hardware (sync_control)
  // -------------------------------------------------------------------
  await test('Módulo 1: POST /api/supabase/docente/asignar-sesion - Asignar menor y nivel adaptativo', async () => {
    const payload = {
      id_nino: 'nin_01',
      nivel: 2,
      observaciones: 'Sesión presencial de identificación de emociones y autorregulación'
    };

    const res = await request('POST', '/api/supabase/docente/asignar-sesion', payload, docenteHeaders);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.exito, true);
    assert.ok(res.body.datos, 'Debe retornar datos del menor y sync_control');
    assert.strictEqual(res.body.datos.nino.nivel_actual, 2, 'El nivel del menor debe actualizarse a 2');
    assert.strictEqual(res.body.datos.sync.estudiante_activo_id, 'nin_01');
    assert.strictEqual(res.body.datos.sync.nivel_activo, 2);
    assert.strictEqual(res.body.datos.sync.comando_pendiente, 'CHANGE_LEVEL');
  });

  // -------------------------------------------------------------------
  // TEST 3: Verificación de Estado en sync_control (Raspberry Pi HDMI)
  // -------------------------------------------------------------------
  await test('Módulo 1: GET /api/supabase/sync-control - Verificar comando pendiente y nivel activo', async () => {
    const res = await request('GET', '/api/supabase/sync-control');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.exito, true);
    assert.ok(res.body.sync);
    assert.strictEqual(res.body.sync.estudiante_activo_id, 'nin_01');
    assert.strictEqual(res.body.sync.nivel_activo, 2);
    assert.strictEqual(res.body.sync.comando_pendiente, 'CHANGE_LEVEL');
  });

  // -------------------------------------------------------------------
  // TEST 4: Directorio de Padres para Envío de Mensajes Directos
  // -------------------------------------------------------------------
  await test('Módulo 2: GET /api/supabase/padres - Listado de acudientes para selector directo', async () => {
    const res = await request('GET', '/api/supabase/padres', null, docenteHeaders);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.exito, true);
    assert.ok(Array.isArray(res.body.datos));
    assert.ok(res.body.datos.length >= 1, 'Debe existir al menos un padre registrado');

    const padre = res.body.datos[0];
    assert.ok(padre.email, 'El padre debe tener correo electrónico');
    assert.ok(padre.nombre_completo, 'El padre debe tener nombre completo');
  });

  // -------------------------------------------------------------------
  // TEST 5: Emisión de Comunicado GENERAL a todas las familias
  // -------------------------------------------------------------------
  let idMsgGeneral = null;
  await test('Módulo 2: POST /api/supabase/comunicaciones - Enviar comunicado GENERAL', async () => {
    const payload = {
      tipo_mensaje: 'GENERAL',
      id_destinatario: null,
      asunto: 'Circular Institucional: Taller de Pictogramas TEACCH',
      contenido: 'Estimadas familias, este viernes tendremos jornada de socialización en el CAIMIUP.'
    };

    const res = await request('POST', '/api/supabase/comunicaciones', payload, docenteHeaders);
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.exito, true);
    assert.ok(res.body.datos.id, 'Debe retornar el ID del nuevo mensaje');
    assert.strictEqual(res.body.datos.tipo_mensaje, 'GENERAL');
    assert.strictEqual(res.body.datos.id_destinatario, null);
    idMsgGeneral = res.body.datos.id;
  });

  // -------------------------------------------------------------------
  // TEST 6: Emisión de Mensaje DIRECTO y Privado a Padre 1
  // -------------------------------------------------------------------
  let idMsgDirecto = null;
  await test('Módulo 2: POST /api/supabase/comunicaciones - Enviar mensaje DIRECTO a Padre 1', async () => {
    const payload = {
      tipo_mensaje: 'DIRECTO',
      id_destinatario: 'usr_padre_01',
      nombre_destinatario: 'Carlos Gómez',
      asunto: 'Reporte Clínico Confidencial: Mateo avanzó a Nivel 2',
      contenido: 'Carlos, hoy Mateo demostró excelente tolerancia al cambio de pictogramas a Nivel 2.'
    };

    const res = await request('POST', '/api/supabase/comunicaciones', payload, docenteHeaders);
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.exito, true);
    assert.ok(res.body.datos.id);
    assert.strictEqual(res.body.datos.tipo_mensaje, 'DIRECTO');
    assert.strictEqual(res.body.datos.id_destinatario, 'usr_padre_01');
    assert.strictEqual(res.body.datos.leido_por_padre, false);
    idMsgDirecto = res.body.datos.id;
  });

  // -------------------------------------------------------------------
  // TEST 7: Docente puede consultar todos los comunicados (General y Directos)
  // -------------------------------------------------------------------
  await test('Módulo 2: GET /api/supabase/comunicaciones (Docente) - Acceso a bandeja completa', async () => {
    const res = await request('GET', '/api/supabase/comunicaciones', null, docenteHeaders);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.exito, true);
    assert.ok(Array.isArray(res.body.datos));

    const tieneGeneral = res.body.datos.some(m => m.id === idMsgGeneral);
    const tieneDirecto = res.body.datos.some(m => m.id === idMsgDirecto);
    assert.ok(tieneGeneral, 'Docente debe ver el mensaje GENERAL creado');
    assert.ok(tieneDirecto, 'Docente debe ver el mensaje DIRECTO creado');
  });

  // -------------------------------------------------------------------
  // TEST 8: Confidencialidad RLS: Padre 1 recibe su mensaje directo y el general
  // -------------------------------------------------------------------
  await test('Módulo 2 (RLS): GET /api/supabase/comunicaciones (Padre 1) - Ve general y su directo', async () => {
    const res = await request('GET', '/api/supabase/comunicaciones', null, padre1Headers);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.exito, true);

    const tieneGeneral = res.body.datos.some(m => m.id === idMsgGeneral);
    const tieneDirecto = res.body.datos.some(m => m.id === idMsgDirecto);
    assert.ok(tieneGeneral, 'Padre 1 DEBE ver los mensajes GENERALES');
    assert.ok(tieneDirecto, 'Padre 1 DEBE ver su mensaje DIRECTO');
  });

  // -------------------------------------------------------------------
  // TEST 9: Confidencialidad RLS Estricta: Padre 2 NO puede ver el directo de Padre 1
  // -------------------------------------------------------------------
  await test('Módulo 2 (RLS): GET /api/supabase/comunicaciones (Padre 2) - NO ve el directo de Padre 1', async () => {
    const res = await request('GET', '/api/supabase/comunicaciones', null, padre2Headers);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.exito, true);

    const tieneGeneral = res.body.datos.some(m => m.id === idMsgGeneral);
    const tieneDirectoAjeno = res.body.datos.some(m => m.id === idMsgDirecto);

    assert.ok(tieneGeneral, 'Padre 2 DEBE ver los comunicados generales');
    assert.strictEqual(tieneDirectoAjeno, false, 'VIOLACIÓN DE RLS: Padre 2 NO debe ver el mensaje directo de Padre 1');
  });

  // -------------------------------------------------------------------
  // TEST 10: Marcado de lectura de comunicación por el acudiente
  // -------------------------------------------------------------------
  await test('Módulo 2: PUT /api/supabase/comunicaciones/:id/leido - Marcar mensaje como leído', async () => {
    const res = await request('PUT', `/api/supabase/comunicaciones/${idMsgDirecto}/leido`, null, padre1Headers);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.exito, true);
    assert.strictEqual(res.body.datos.leido_por_padre, true);
  });

  // -------------------------------------------------------------------
  // TEST 11: Historial Consolidado de Sesiones de Hardware (Req 4)
  // -------------------------------------------------------------------
  await test('Módulo 3: GET /api/supabase/historial-sesiones - Consulta consolidada con ninos y es_reciente', async () => {
    const res = await request('GET', '/api/supabase/historial-sesiones', null, docenteHeaders);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.exito, true);
    assert.ok(Array.isArray(res.body.datos), 'Debe ser un array de sesiones');
    assert.ok(res.body.datos.length >= 3, 'Debe contener al menos 3 sesiones de historial');

    // Comprobar orden descendente
    const primera = res.body.datos[0];
    const segunda = res.body.datos[1];
    assert.ok(new Date(primera.fecha_inicio) >= new Date(segunda.fecha_inicio), 'El historial debe estar ordenado por fecha_inicio DESC');

    // Comprobar bandera es_reciente
    assert.strictEqual(primera.es_reciente, true, 'La primera sesión debe estar marcada como es_reciente = true');

    // Comprobar datos del menor integrados
    assert.ok(primera.nombre_nino, 'La sesión debe incluir el nombre del niño');
    assert.ok(primera.codigo_estudiante, 'La sesión debe incluir el código del estudiante');
    assert.ok(typeof primera.total_intentos === 'number');
    assert.ok(typeof primera.total_aciertos === 'number');
  });

  console.log('\n==================================================================');
  console.log(`[QA_Integration_Tester]: Resumen de Pruebas: ${passed} Pasadas, ${failed} Fallidas`);
  console.log('==================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

// Ejecución directa
runDocenteDashboardTests().catch(err => {
  console.error('Error fatal ejecutando suite docente:', err);
  process.exit(1);
});
