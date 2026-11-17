/**
 * =====================================================================
 * PROYECTO CAIMIUP - SUITE DE PRUEBAS DE INTEGRACIÓN SUPABASE
 * Fase 5 & Fase 6: Validación de PostgreSQL, RLS, Storage y Realtime Sync
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

async function runSupabaseTests() {
  console.log('\n======================================================');
  console.log('[QA_Integration_Tester]: Validando Conexión e Integración con Supabase');
  console.log('Componentes: PostgreSQL 15+ | RLS Segregation | Realtime Sync | Storage');
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

  // 1. Estado y Conectividad con Supabase
  await test('GET /api/supabase/status - Estado del motor de base de datos Supabase', async () => {
    const res = await request('GET', '/api/supabase/status');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.exito, true);
    assert.strictEqual(res.body.supabase.provider, 'Supabase (PostgreSQL 15+ & RLS)');
    assert.strictEqual(res.body.supabase.realtime_enabled, true);
    assert.strictEqual(res.body.supabase.storage_bucket, 'pictogramas');
  });

  // 2. Consulta de Catálogo ARASAAC desde Supabase
  await test('GET /api/supabase/pictogramas - Catálogo de 8 pictogramas vinculados a teclas P1-P8', async () => {
    const res = await request('GET', '/api/supabase/pictogramas');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.exito, true);
    assert.ok(res.body.datos.length >= 8);
    const botones = res.body.datos.map(p => p.boton_asociado);
    assert.ok(botones.includes('P1') && botones.includes('P8'));
  });

  // 3. Telemetría Atómica (Edge RPi/ESP32 -> Supabase metricas_palabras)
  await test('POST /api/supabase/telemetria - Inserción de pulsación física con latencia ms', async () => {
    const res = await request('POST', '/api/supabase/telemetria', {
      id_sesion: 'ses_hw_supabase_test',
      id_nino: 'nin_01',
      palabra: 'Agua',
      boton_presionado: 'P1',
      boton_esperado: 'P1',
      tiempo_reaccion_ms: 870,
      resultado: 'ACIERTO'
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.exito, true);
    assert.strictEqual(res.body.datos.palabra, 'Agua');
    assert.strictEqual(res.body.datos.tiempo_reaccion_ms, 870);
  });

  // 4. Modificación de Nivel Pedagógico con RLS y Supabase Realtime
  await test('PUT /api/supabase/ninos/:id/nivel - Docente asigna Nivel 2 y sincroniza RPi', async () => {
    // Autenticar rol docente
    await request('POST', '/api/supabase/login', { role: 'docente' });

    const resNivel = await request('PUT', '/api/supabase/ninos/nin_01/nivel', { nivel: 2 });
    assert.strictEqual(resNivel.status, 200);
    assert.strictEqual(resNivel.body.exito, true);
    assert.strictEqual(resNivel.body.nino.nivel_actual, 2);
    assert.strictEqual(resNivel.body.sync.comando_pendiente, 'CHANGE_LEVEL');
  });

  // 5. Consulta de Histogramas y Segregación RLS para Rol Padre
  await test('GET /api/supabase/metricas - Padre consulta histogramas de su hijo', async () => {
    // Autenticar rol padre
    await request('POST', '/api/supabase/login', { role: 'padre' });

    const resMetricas = await request('GET', '/api/supabase/metricas?id_nino=nin_01');
    assert.strictEqual(resMetricas.status, 200);
    assert.strictEqual(resMetricas.body.exito, true);
    assert.ok(resMetricas.body.datos.histogramas.Agua);
    assert.ok(resMetricas.body.datos.histogramas.Agua.distribucion_bins);

    // Intento de acceder a un niño no asignado -> Supabase RLS debe denegarlo (403)
    const resDenegado = await request('GET', '/api/supabase/metricas?id_nino=nin_02');
    assert.strictEqual(resDenegado.status, 403);
    assert.strictEqual(resDenegado.body.exito, false);
  });

  // 6. Actualización OTA de Pictogramas (Rol Admin hacia Supabase Storage)
  await test('POST /api/supabase/pictogramas - Admin inyecta nuevo pictograma a Storage y notifica RPi', async () => {
    // Autenticar rol admin
    await request('POST', '/api/supabase/login', { role: 'admin' });

    const resOTA = await request('POST', '/api/supabase/pictogramas', {
      nombre: 'Manzana',
      categoria: 'NECESIDAD',
      nivel: 1,
      boton_asociado: 'P2',
      audio_texto: 'Manzana. Fruta deliciosa.'
    });

    assert.strictEqual(resOTA.status, 201);
    assert.strictEqual(resOTA.body.exito, true);
    assert.strictEqual(resOTA.body.pictograma.nombre, 'Manzana');
    assert.ok(resOTA.body.version_catalogo > 1);

    // Verificar que la RPi detecta la actualización pendiente
    const resSync = await request('GET', '/api/supabase/sync-status');
    assert.strictEqual(resSync.status, 200);
    assert.strictEqual(resSync.body.sync.comando_pendiente, 'UPDATE_PICTOGRAMS');
  });

  console.log('\n======================================================');
  console.log(`[QA_Integration_Tester]: Supabase Tests: ${passed} PASARON, ${failed} FALLARON.`);
  console.log('======================================================\n');

  if (failed > 0) process.exit(1);
  else process.exit(0);
}

runSupabaseTests();
