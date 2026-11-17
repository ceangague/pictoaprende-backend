/**
 * =====================================================================
 * PROYECTO CAIMIUP - SUITE DE PRUEBAS DEL DASHBOARD DE PADRES / ACUDIENTES
 * Validación de RLS Estricto (Regla de Oro), Reporte Analítico STEM y Agenda
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

async function runPadreDashboardTests() {
  console.log('\n==================================================================');
  console.log('[QA_Integration_Tester]: Validando Módulos del Dashboard Padre STEM');
  console.log('Módulos: RLS Habeas Data | Reporte Analítico | Histograma | Eventos | Mensajes');
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

  // Headers simulando a Carlos Gómez (Padre de Mateo G. - nin_01)
  const padre1Headers = {
    'Referer': 'http://localhost:3000/dashboard/padre.html',
    'x-user-role': 'padre',
    'x-user-id': 'usr_padre_01',
    'x-user-email': 'padre@caimiup.edu.co'
  };

  // Headers simulando a Marta Gómez (Madre de Santiago R. - nin_02)
  const padre2Headers = {
    'Referer': 'http://localhost:3000/dashboard/padre.html',
    'x-user-role': 'padre',
    'x-user-id': 'usr_padre_02',
    'x-user-email': 'padre_santiago@caimiup.edu.co'
  };

  // Headers simulando a un Invitado / Guest
  const guestHeaders = {
    'Referer': 'http://localhost:3000/dashboard/guest.html',
    'x-user-role': 'guest',
    'x-user-id': 'usr_guest_01'
  };

  // -------------------------------------------------------------------
  // TEST 1: Consulta del Reporte Analítico de su propio hijo (Padre 1 -> nin_01)
  // -------------------------------------------------------------------
  await test('Módulo 4: GET /api/supabase/padre/reporte-analitico (Padre 1) - Consulta autorizada de su hijo', async () => {
    const res = await request('GET', '/api/supabase/padre/reporte-analitico', null, padre1Headers);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.exito, true);
    assert.ok(res.body.datos);
    assert.strictEqual(res.body.datos.nino.id_nino, 'nin_01');
    assert.strictEqual(res.body.datos.nino.nombre, 'Mateo G.');
  });

  // -------------------------------------------------------------------
  // TEST 2: REGLA DE ORO RLS: Padre 1 NO puede consultar al hijo de Padre 2
  // -------------------------------------------------------------------
  await test('RLS Estricto: GET /api/supabase/padre/reporte-analitico?id_nino=nin_02 (Padre 1) - Bloqueo 403', async () => {
    const res = await request('GET', '/api/supabase/padre/reporte-analitico?id_nino=nin_02', null, padre1Headers);
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.exito, false);
    assert.ok(res.body.mensaje.includes('42501') || res.body.mensaje.includes('Acceso denegado'));
  });

  // -------------------------------------------------------------------
  // TEST 3: REGLA DE ORO RLS: Padre 2 consulta su propio hijo y es bloqueado de nin_01
  // -------------------------------------------------------------------
  await test('RLS Estricto: GET /api/supabase/padre/reporte-analitico (Padre 2) - Autorizado en nin_02, Bloqueado en nin_01', async () => {
    // Consulta autorizada de su propio hijo
    const resPropio = await request('GET', '/api/supabase/padre/reporte-analitico', null, padre2Headers);
    assert.strictEqual(resPropio.status, 200);
    assert.strictEqual(resPropio.body.datos.nino.id_nino, 'nin_02');

    // Intento no autorizado en nin_01
    const resAjeno = await request('GET', '/api/supabase/padre/reporte-analitico?id_nino=nin_01', null, padre2Headers);
    assert.strictEqual(resAjeno.status, 403);
    assert.strictEqual(resAjeno.body.exito, false);
  });

  // -------------------------------------------------------------------
  // TEST 4: Bloqueo de acceso al reporte analítico para el rol Guest
  // -------------------------------------------------------------------
  await test('RLS: GET /api/supabase/padre/reporte-analitico (Guest) - Acceso restringido (403)', async () => {
    const res = await request('GET', '/api/supabase/padre/reporte-analitico', null, guestHeaders);
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.exito, false);
  });

  // -------------------------------------------------------------------
  // TEST 5: Validación de KPIs Consolidados y Métricas STEM
  // -------------------------------------------------------------------
  await test('Módulo 4: Verificación de estructura de KPIs (Precisión, Latencia, Sesiones)', async () => {
    const res = await request('GET', '/api/supabase/padre/reporte-analitico', null, padre1Headers);
    assert.strictEqual(res.status, 200);

    const kpis = res.body.datos.kpis;
    assert.ok(kpis, 'Debe incluir objeto de KPIs');
    assert.ok(typeof kpis.tasa_precision === 'number', 'tasa_precision debe ser numérico');
    assert.ok(kpis.tasa_precision >= 0 && kpis.tasa_precision <= 100);
    assert.ok(typeof kpis.total_sesiones === 'number');
    assert.ok(kpis.total_sesiones >= 3, 'Debe acumular al menos 3 sesiones presenciales');
    assert.ok(typeof kpis.tiempo_reaccion_promedio_ms === 'number');
    assert.ok(kpis.pictograma_destacado, 'Debe incluir pictograma destacado');
  });

  // -------------------------------------------------------------------
  // TEST 6: Estructura del Histograma Temporal para Chart.js
  // -------------------------------------------------------------------
  await test('Módulo 1: Validación de dataset temporal para Histograma (Aciertos vs Errores)', async () => {
    const res = await request('GET', '/api/supabase/padre/reporte-analitico', null, padre1Headers);
    assert.strictEqual(res.status, 200);

    const hist = res.body.datos.histograma_temporal;
    assert.ok(Array.isArray(hist), 'histograma_temporal debe ser un arreglo');
    assert.ok(hist.length >= 3, 'Debe tener al menos 3 puntos de sesión');

    const punto = hist[0];
    assert.ok(punto.label, 'Cada punto debe tener etiqueta temporal (ej: Sesión 1)');
    assert.ok(typeof punto.aciertos === 'number', 'Aciertos debe ser numérico');
    assert.ok(typeof punto.errores === 'number', 'Errores debe ser numérico');
    assert.ok(typeof punto.tasa_pct === 'number', 'Tasa porcentual debe ser numérica');
  });

  // -------------------------------------------------------------------
  // TEST 7: Desglose de Fortalezas en Competencias STEM
  // -------------------------------------------------------------------
  await test('Módulo 4: Validación de competencias STEM cualitativas', async () => {
    const res = await request('GET', '/api/supabase/padre/reporte-analitico', null, padre1Headers);
    assert.strictEqual(res.status, 200);

    const fortalezas = res.body.datos.fortalezas_stem;
    assert.ok(Array.isArray(fortalezas));
    assert.ok(fortalezas.length >= 4, 'Debe incluir las 4 dimensiones STEM');

    const ciencia = fortalezas.find(f => f.area.includes('Ciencia'));
    assert.ok(ciencia, 'Debe incluir área de Ciencia');
    assert.ok(ciencia.nivel, 'Debe incluir valoración cualitativa');
  });

  // -------------------------------------------------------------------
  // TEST 8: Agenda de Eventos STEM filtrada para Acudientes
  // -------------------------------------------------------------------
  await test('Módulo 2: GET /api/supabase/eventos - Agenda institucional filtrada para acudientes', async () => {
    const res = await request('GET', '/api/supabase/eventos', null, padre1Headers);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.exito, true);
    assert.ok(Array.isArray(res.body.datos));
    assert.ok(res.body.datos.length >= 3, 'Debe contener al menos 3 eventos en agenda');

    // Verificar que solo vengan eventos dirigidos a ACUDIENTES o TODOS
    const todosValidos = res.body.datos.every(e => e.dirigido_a === 'ACUDIENTES' || e.dirigido_a === 'TODOS');
    assert.ok(todosValidos, 'El padre solo debe recibir eventos dirigidos a familias o generales');

    const primerEvento = res.body.datos[0];
    assert.ok(primerEvento.titulo);
    assert.ok(primerEvento.fecha_inicio);
    assert.ok(primerEvento.categoria_stem);
  });

  // -------------------------------------------------------------------
  // TEST 9: Bandeja de Comunicaciones y Recomendaciones Privadas
  // -------------------------------------------------------------------
  await test('Módulo 3: GET /api/supabase/comunicaciones - Bandeja inbox con avisos generales y notas directas', async () => {
    const res = await request('GET', '/api/supabase/comunicaciones', null, padre1Headers);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.exito, true);
    assert.ok(Array.isArray(res.body.datos));
    assert.ok(res.body.datos.length >= 1, 'Debe haber mensajes en bandeja');

    const tieneGeneral = res.body.datos.some(m => m.tipo_mensaje === 'GENERAL');
    assert.ok(tieneGeneral, 'Debe poder leer comunicados generales');
  });

  // -------------------------------------------------------------------
  // TEST 10: Acuse de Recibo / Marcar Mensaje como Leído
  // -------------------------------------------------------------------
  await test('Módulo 3: PUT /api/supabase/comunicaciones/:id/leido - Padre confirma lectura de reporte', async () => {
    // Obtener los mensajes del padre
    const inbox = await request('GET', '/api/supabase/comunicaciones', null, padre1Headers);
    const mensajeDirecto = inbox.body.datos.find(m => m.tipo_mensaje === 'DIRECTO');

    if (mensajeDirecto) {
      const res = await request('PUT', `/api/supabase/comunicaciones/${mensajeDirecto.id}/leido`, null, padre1Headers);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.exito, true);
      assert.strictEqual(res.body.datos.leido_por_padre, true);
    }
  });

  console.log('\n==================================================================');
  console.log(`[QA_Integration_Tester]: Resumen de Pruebas: ${passed} Pasadas, ${failed} Fallidas`);
  console.log('==================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

// Ejecución directa
runPadreDashboardTests().catch(err => {
  console.error('Error fatal ejecutando suite padre:', err);
  process.exit(1);
});
