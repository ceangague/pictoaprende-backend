/**
 * =====================================================================
 * PROYECTO CAIMIUP - SUITE DE PRUEBAS ARQUITECTURA HÍBRIDA
 * Validación RBAC (4 Roles), Telemetría Edge e Inyección OTA
 * Agente: QA_Integration_Tester
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

async function runHybridTests() {
  console.log('\n======================================================');
  console.log('[QA_Integration_Tester]: Validando Arquitectura Híbrida CAIMIUP');
  console.log('Componentes: Edge (ESP32/RPi) + Firebase Cloud + RBAC 4 Roles');
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

  // 1. Verificación del Sync Status para la Raspberry Pi
  await test('GET /api/cloud/sync-status - Consulta de estado y versión OTA para RPi', async () => {
    const res = await request('GET', '/api/cloud/sync-status');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.exito, true);
    assert.ok(res.body.sync.id_dispositivo === 'RPI_CAIMIUP_01');
    assert.ok(res.body.sync.version_catalogo >= 1);
  });

  // 2. Telemetría de Botones Físicos desde Hardware Edge
  await test('POST /api/cloud/telemetria - Ingesta de pulsación física ESP32 hacia Firestore', async () => {
    const res = await request('POST', '/api/cloud/telemetria', {
      id_sesion: 'ses_hw_test',
      id_nino: 'nin_01',
      palabra: 'Agua',
      boton_presionado: 'P1',
      boton_esperado: 'P1',
      tiempo_reaccion_ms: 920,
      resultado: 'ACIERTO'
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.exito, true);
    assert.strictEqual(res.body.datos.palabra, 'Agua');
    assert.strictEqual(res.body.datos.tiempo_reaccion_ms, 920);
  });

  // 3. Auditoría de Seguridad RBAC (4 Roles)
  await test('RBAC: Rol Docente modifica nivel pedagógico en hardware', async () => {
    // 3.1 Login como Docente
    await request('POST', '/api/cloud/login', { role: 'docente' });

    // 3.2 Modificar nivel de Mateo a Nivel 2
    const resNivel = await request('PUT', '/api/cloud/ninos/nin_01/nivel', { nivel: 2 });
    assert.strictEqual(resNivel.status, 200);
    assert.strictEqual(resNivel.body.exito, true);
    assert.strictEqual(resNivel.body.nino.nivel_actual, 2);
    assert.strictEqual(resNivel.body.sync.comando_pendiente, 'CHANGE_LEVEL');
  });

  await test('RBAC: Rol Padre consulta histograma de su hijo con segregación estricta', async () => {
    // 3.3 Login como Padre
    await request('POST', '/api/cloud/login', { role: 'padre' });

    // Consulta métricas de su hijo (nin_01)
    const resMetricas = await request('GET', '/api/cloud/metricas?id_nino=nin_01');
    assert.strictEqual(resMetricas.status, 200);
    assert.strictEqual(resMetricas.body.exito, true);
    assert.ok(resMetricas.body.datos.histogramas.Agua);
    assert.ok(resMetricas.body.datos.histogramas.Agua.distribucion_bins);

    // Intento no autorizado de consultar hijo ajeno (nin_02) -> Debe denegarse (403)
    const resDenegado = await request('GET', '/api/cloud/metricas?id_nino=nin_02');
    assert.strictEqual(resDenegado.status, 403);
    assert.strictEqual(resDenegado.body.exito, false);
  });

  await test('RBAC: Rol Guest (Invitado) tiene acceso restringido a métricas', async () => {
    // Login como Guest
    await request('POST', '/api/cloud/login', { role: 'guest' });
    const resGuest = await request('GET', '/api/cloud/metricas?id_nino=nin_01');
    assert.strictEqual(resGuest.status, 403);
  });

  // 4. Inyección y Actualización OTA de Pictogramas (Rol Admin)
  await test('OTA: Rol Admin inyecta nuevo pictograma y notifica a Raspberry Pi', async () => {
    // Login como Admin
    await request('POST', '/api/cloud/login', { role: 'admin' });

    const resInyeccion = await request('POST', '/api/cloud/pictogramas', {
      nombre: 'Pintar',
      categoria: 'RUTINA',
      nivel: 3,
      boton_asociado: 'P6',
      audio_texto: 'Pintar. Vamos a dibujar con colores.'
    });

    assert.strictEqual(resInyeccion.status, 201);
    assert.strictEqual(resInyeccion.body.exito, true);
    assert.strictEqual(resInyeccion.body.pictograma.nombre, 'Pintar');
    assert.ok(resInyeccion.body.version_catalogo > 1);

    // Verificar que el sync status refleja la actualización para el hardware
    const resSync = await request('GET', '/api/cloud/sync-status');
    assert.strictEqual(resSync.body.sync.comando_pendiente, 'UPDATE_PICTOGRAMS');
  });

  console.log('\n======================================================');
  console.log(`[QA_Integration_Tester]: Pruebas Híbridas: ${passed} PASARON, ${failed} FALLARON.`);
  console.log('======================================================\n');

  if (failed > 0) process.exit(1);
  else process.exit(0);
}

runHybridTests();
