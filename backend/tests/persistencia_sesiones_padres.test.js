/**
 * =====================================================================
 * PROYECTO CAIMIUP - SUITE DE PRUEBAS DE PERSISTENCIA DE SESIONES (ROL PADRES)
 * Fases Metodológicas: Fase 2 (Diseño BD), Fase 4 (Software), Fase 6 (Pruebas del Sistema)
 * Agente: QA_Tester & Backend_DB_Dev
 * =====================================================================
 * 
 * Valida que:
 *  1. Las sesiones del rol de padres (sesiones de aprendizaje y sesiones de autenticación)
 *     queden guardadas en la base de datos persistente.
 *  2. Al cerrar y reiniciar el backend, todas las sesiones se mantienen intactas.
 *  3. Se respeta estrictamente el protocolo RLS (Habeas Data CAIMIUP).
 */

const http = require('http');
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

function request(method, reqPath, body = null, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(reqPath, BASE_URL);
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

async function esperar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runPersistenciaTests() {
  console.log('\n==================================================================');
  console.log('[QA_Tester]: Iniciando Suite de Pruebas: Persistencia de Sesiones Rol Padres');
  console.log('Objetivo: Garantizar que al iniciar/cerrar el backend, las sesiones se mantengan en BD.');
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

  // 1. Iniciar servidor backend de prueba
  let serverProcess = null;
  const serverModule = require('../server');
  const dbPersistence = require('../config/persistence');

  // Asegurar que el servidor esté escuchando
  await new Promise(resolve => {
    if (serverModule.server.listening) {
      resolve();
    } else {
      serverModule.server.listen(PORT, '0.0.0.0', resolve);
    }
  });

  console.log('[QA_Tester]: Servidor Backend listo en puerto ' + PORT);

  let tokenPadre = null;
  let idSesionCreada = null;
  let totalSesionesAntesReinicio = 0;

  // -------------------------------------------------------------------
  // TEST 1: Login de rol Padre y guardado de sesión de usuario en Base de Datos
  // -------------------------------------------------------------------
  await test('Fase 4: Registro y guardado de sesión en la Base de Datos persistente', async () => {
    tokenPadre = 'token-caimiup-padre-test-' + Date.now();
    const testPadre = {
      id: 'a0000000-0000-0000-0000-000000000003',
      auth_user_id: 'usr_padre_01',
      email: 'padre@caimiup.edu.co',
      nombre_completo: 'Carlos Gómez (Padre de Mateo G.)',
      role: 'padre',
      id_nino_asociado: 'nin_01',
      activo: true
    };
    dbPersistence.registrarSesionUsuario(testPadre, tokenPadre);

    // Verificar en la persistencia que la sesión está registrada
    const sesionEnBD = dbPersistence.obtenerSesionUsuario(tokenPadre);
    assert.ok(sesionEnBD, 'La sesión del padre debe existir en la base de datos persistente');
    assert.strictEqual(sesionEnBD.email, 'padre@caimiup.edu.co');
    assert.strictEqual(sesionEnBD.role, 'padre');
    assert.strictEqual(sesionEnBD.activo, true);
  });

  // -------------------------------------------------------------------
  // TEST 2: Validación de endpoint de sesión activa en BD
  // -------------------------------------------------------------------
  await test('Fase 4: GET /api/supabase/sesion/activa confirma sesión del padre en BD', async () => {
    const res = await request('GET', '/api/supabase/sesion/activa', null, {
      'Authorization': `Bearer ${tokenPadre}`,
      'x-user-role': 'padre',
      'x-user-email': 'padre@caimiup.edu.co'
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.exito, true);
    assert.strictEqual(res.body.sesion.email, 'padre@caimiup.edu.co');
    assert.strictEqual(res.body.sesion.activo, true);
  });

  // -------------------------------------------------------------------
  // TEST 3: Consulta de historial de sesiones guardadas en BD para el Padre
  // -------------------------------------------------------------------
  await test('Fase 4: GET /api/supabase/padre/sesiones consulta sesiones persistidas de su hijo (nin_01)', async () => {
    const res = await request('GET', '/api/supabase/padre/sesiones', null, {
      'Authorization': `Bearer ${tokenPadre}`,
      'x-user-role': 'padre',
      'x-user-email': 'padre@caimiup.edu.co'
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.exito, true);
    assert.strictEqual(res.body.nino.id_nino, 'nin_01');
    assert.ok(Array.isArray(res.body.sesiones));
    assert.ok(res.body.sesiones.length >= 3, 'Debe tener al menos las 3 sesiones históricas');

    totalSesionesAntesReinicio = res.body.sesiones.length;
  });

  // -------------------------------------------------------------------
  // TEST 4: Registro de una nueva sesión clínica de aprendizaje para el hijo del padre
  // -------------------------------------------------------------------
  await test('Fase 4: Registro de nueva sesión pedagógica en BD para Mateo G. (nin_01)', async () => {
    // Iniciar sesión como docente
    const resInicio = await request('POST', '/api/supabase/sesion/iniciar', {
      id_nino: 'nin_01',
      nivel: 1,
      duracion_minutos: 5,
      observaciones: 'Sesión de prueba de persistencia ante reinicio del backend.'
    }, {
      'x-user-role': 'docente',
      'x-user-id': 'usr_docente_01'
    });

    assert.strictEqual(resInicio.status, 200);
    assert.strictEqual(resInicio.body.exito, true);
    idSesionCreada = resInicio.body.sesion.id_sesion;
    assert.ok(idSesionCreada, 'Debe generar un ID de sesión');

    // Registrar 2 telemetrías atómicas
    await request('POST', '/api/supabase/telemetria', {
      id_sesion: idSesionCreada,
      id_nino: 'nin_01',
      palabra: 'Agua',
      boton_presionado: 'P1',
      boton_esperado: 'P1',
      tiempo_reaccion_ms: 820,
      resultado: 'ACIERTO'
    });

    await request('POST', '/api/supabase/telemetria', {
      id_sesion: idSesionCreada,
      id_nino: 'nin_01',
      palabra: 'Comida',
      boton_presionado: 'P2',
      boton_esperado: 'P2',
      tiempo_reaccion_ms: 1100,
      resultado: 'ACIERTO'
    });

    // Finalizar sesión
    const resFin = await request('POST', '/api/supabase/sesion/finalizar', {
      id_sesion: idSesionCreada,
      total_intentos: 2,
      total_aciertos: 2,
      total_errores: 0
    });

    assert.strictEqual(resFin.status, 200);
    assert.strictEqual(resFin.body.exito, true);

    // Verificar en BD inmediatamente
    const sesionBD = dbPersistence.obtenerTodasSesionesHardware().find(s => s.id_sesion === idSesionCreada);
    assert.ok(sesionBD, 'La nueva sesión debe estar guardada en la base de datos persistente');
    assert.strictEqual(sesionBD.estado, 'TERMINADA');
    assert.strictEqual(sesionBD.total_aciertos, 2);
  });

  // -------------------------------------------------------------------
  // TEST 5: SIMULACIÓN DE APAGADO Y REINICIO COMPLETO DEL BACKEND
  // -------------------------------------------------------------------
  await test('Fase 6: Simulación de Apagado y Cierre del Servidor Backend', async () => {
    // Forzar guardado inmediato en disco
    dbPersistence.guardarInmediato();

    // Comprobar que el archivo caimiup_db_store.json existe y tiene datos
    const dbFile = path.join(__dirname, '../../database/caimiup_db_store.json');
    assert.ok(fs.existsSync(dbFile), 'El archivo caimiup_db_store.json debe existir físicamente en disco');

    const raw = fs.readFileSync(dbFile, 'utf8');
    const parsed = JSON.parse(raw);
    assert.ok(parsed.sesiones_hardware.length > totalSesionesAntesReinicio, 'El archivo en disco debe contener la nueva sesión');
    assert.ok(parsed.sesiones_usuarios.some(u => u.email === 'padre@caimiup.edu.co' && u.activo), 'El archivo en disco debe contener la sesión del padre');

    // Cerrar el servidor
    await new Promise(resolve => {
      serverModule.server.close(resolve);
    });

    console.log('     🛑 Servidor Backend CERRADO (Simulando fin de proceso o corte de energía).');
  });

  // -------------------------------------------------------------------
  // TEST 6: REINICIO DEL SERVIDOR BACKEND (RESTAURACIÓN DESDE LA BASE DE DATOS)
  // -------------------------------------------------------------------
  await test('Fase 6: Reinicio del Backend y Restauración Completa de Sesiones desde BD', async () => {
    // Re-inicializar el gestor de persistencia simulando arranque nuevo
    dbPersistence.inicializar();

    // Sincronizar SupabaseService desde la base de datos
    const supabaseService = require('../../cloud_backend/supabase_service');
    supabaseService.cargarSesionesDesdeBD();

    // Volver a encender el servidor HTTP en el puerto 3000
    await new Promise(resolve => {
      serverModule.server.listen(PORT, '0.0.0.0', resolve);
    });
    await esperar(200);

    console.log('     🚀 Servidor Backend REINICIADO exitosamente.');
  });

  // -------------------------------------------------------------------
  // TEST 7: Verificación de que la sesión del Padre se mantuvo tras el reinicio
  // -------------------------------------------------------------------
  await test('Fase 4 & 6: La sesión de autenticación del Padre SE MANTIENE tras el reinicio', async () => {
    const res = await request('GET', '/api/supabase/sesion/activa', null, {
      'Authorization': `Bearer ${tokenPadre}`,
      'x-user-role': 'padre',
      'x-user-email': 'padre@caimiup.edu.co'
    });

    assert.strictEqual(res.status, 200, 'La sesión del padre debe seguir siendo válida tras reiniciar el backend');
    assert.strictEqual(res.body.exito, true);
    assert.strictEqual(res.body.sesion.email, 'padre@caimiup.edu.co');
    assert.strictEqual(res.body.sesion.activo, true);
  });

  // -------------------------------------------------------------------
  // TEST 8: Verificación de que las sesiones de aprendizaje del niño SE MANTUVIERON
  // -------------------------------------------------------------------
  await test('Fase 4 & 6: Las sesiones de aprendizaje de Mateo G. SE MANTIENEN tras el reinicio', async () => {
    const res = await request('GET', '/api/supabase/padre/sesiones', null, {
      'Authorization': `Bearer ${tokenPadre}`,
      'x-user-role': 'padre',
      'x-user-email': 'padre@caimiup.edu.co'
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.exito, true);
    assert.strictEqual(res.body.persistencia.mantiene_tras_reinicio, true);

    const sesionEncontrada = res.body.sesiones.find(s => s.id_sesion === idSesionCreada);
    assert.ok(sesionEncontrada, 'La sesión creada antes de apagar el backend DEBE existir tras el reinicio');
    assert.strictEqual(sesionEncontrada.total_aciertos, 2);
    assert.strictEqual(sesionEncontrada.estado, 'TERMINADA');

    // Comprobar también el reporte analítico del padre tras el reinicio
    const resReporte = await request('GET', '/api/supabase/padre/reporte-analitico', null, {
      'Authorization': `Bearer ${tokenPadre}`,
      'x-user-role': 'padre',
      'x-user-email': 'padre@caimiup.edu.co'
    });

    assert.strictEqual(resReporte.status, 200);
    assert.ok(resReporte.body.datos.kpis.total_sesiones >= 4, 'El total de sesiones acumuladas debe incluir la persistida');
  });

  // -------------------------------------------------------------------
  // TEST 9: RLS Estricto: Un padre no puede consultar las sesiones de otro menor
  // -------------------------------------------------------------------
  await test('Fase 2 & 4: RLS Estricto: Padre 1 es bloqueado si intenta consultar sesiones de nin_02 (403)', async () => {
    const res = await request('GET', '/api/supabase/padre/sesiones?id_nino=nin_02', null, {
      'Authorization': `Bearer ${tokenPadre}`,
      'x-user-role': 'padre',
      'x-user-email': 'padre@caimiup.edu.co'
    });

    assert.strictEqual(res.status, 403, 'Debe responder con 403 Forbidden por violación de RLS');
    assert.strictEqual(res.body.exito, false);
    assert.ok(res.body.mensaje.includes('42501') || res.body.mensaje.includes('Acceso denegado'));
  });

  // -------------------------------------------------------------------
  // TEST 10: Logout formal del padre y actualización en Base de Datos
  // -------------------------------------------------------------------
  await test('Fase 4: Logout formal del Padre desactiva la sesión en la Base de Datos', async () => {
    const res = await request('POST', '/api/supabase/logout', {
      token: tokenPadre,
      email: 'padre@caimiup.edu.co'
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.exito, true);

    // Verificar que ya no está activa
    const resActiva = await request('GET', '/api/supabase/sesion/activa', null, {
      'Authorization': `Bearer ${tokenPadre}`
    });
    assert.strictEqual(resActiva.status, 401, 'Una vez cerrada, la sesión debe responder 401 Unauthorized');
  });

  // Cerrar servidor al finalizar pruebas
  serverModule.server.close();

  console.log('\n==================================================================');
  console.log(`[QA_Tester]: Resumen de Pruebas: ${passed} Pasadas, ${failed} Fallidas`);
  console.log('==================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPersistenciaTests().catch(err => {
  console.error('[QA_Tester]: Error crítico en suite de pruebas:', err);
  process.exit(1);
});
