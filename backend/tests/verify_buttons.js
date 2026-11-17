/**
 * PROYECTO CAIMIUP - TEST SUITE DE BOTONES Y ACCIONES POR ROL
 * Verifica exhaustivamente el funcionamiento de todas las acciones de los botones:
 * - Rol Niño (Pulsadores P1-P8, Aciertos, Errores y Telemetría)
 * - Rol Docente (Temporizadores, Asignación, Notas clínicas, Comunicaciones e Historial)
 * - Rol Padre (Reporte analítico, Agenda de eventos, Bandeja inbox y Marcar leído)
 * - Rol Admin (Comandos OTA RPi, Alta de usuarios, Alta/Edición de pacientes, Inyección/Edición de pictos)
 */

const http = require('http');
const assert = require('assert');

function request(path, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function run() {
  console.log('=====================================================================');
  console.log('  PICTOAPRENDE CAIMIUP: VERIFICACIÓN DE BOTONES POR CADA ROL');
  console.log('=====================================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (e) {
      console.error(`  ❌ [FAIL] ${name}: ${e.message}`);
      failed++;
    }
  }

  // --- 1. ROL NIÑO ---
  console.log('--- 1. ROL NIÑO (Pantalla HDMI Raspberry Pi & Pulsadores P1-P8) ---');

  await test('Niño: Pulsación acertada (P1 para Agua) transmite telemetría', async () => {
    const res = await request('/api/supabase/telemetria', {
      method: 'POST'
    }, {
      id_sesion: 'ses_test_01',
      id_nino: 'nin_01',
      palabra: 'Agua',
      boton_presionado: 'P1',
      boton_esperado: 'P1',
      tiempo_reaccion_ms: 820,
      resultado: 'ACIERTO'
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.datos.resultado, 'ACIERTO');
  });

  await test('Niño: Pulsación errónea (P3 cuando espera P1) registra error no punitivo', async () => {
    const res = await request('/api/supabase/telemetria', {
      method: 'POST'
    }, {
      id_sesion: 'ses_test_01',
      id_nino: 'nin_01',
      palabra: 'Agua',
      boton_presionado: 'P3',
      boton_esperado: 'P1',
      tiempo_reaccion_ms: 1950,
      resultado: 'ERROR'
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.datos.resultado, 'ERROR');
  });

  // --- 2. ROL DOCENTE ---
  console.log('\n--- 2. ROL DOCENTE (Panel de Control y Sesiones Clínicas) ---');

  await test('Docente: Botón "⚡ Refrescar Estado" (GET /api/supabase/sync-status)', async () => {
    const res = await request('/api/supabase/sync-status', {
      headers: { 'x-user-role': 'docente' }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.exito, true);
    assert.ok(res.body.sync);
  });

  await test('Docente: Botón "▶️ Iniciar Sesión con Temporizador" (POST /api/supabase/sesion/iniciar)', async () => {
    const res = await request('/api/supabase/sesion/iniciar', {
      method: 'POST',
      headers: { 'x-user-role': 'docente' }
    }, {
      id_nino: 'nin_01',
      nivel: 1,
      duracion_minutos: 5,
      observaciones: 'Prueba de inicio con temporizador'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.exito, true);
    assert.strictEqual(res.body.sync.estado_sesion, 'ACTIVA');
  });

  await test('Docente: Botón "⏹️ Finalizar Sesión" (POST /api/supabase/sesion/finalizar)', async () => {
    const res = await request('/api/supabase/sesion/finalizar', {
      method: 'POST',
      headers: { 'x-user-role': 'docente' }
    }, {
      duracion_real_seg: 120,
      total_intentos: 5,
      total_aciertos: 4,
      total_errores: 1
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.exito, true);
    assert.strictEqual(res.body.sync.estado_sesion, 'TERMINADA');
  });

  await test('Docente: Botón "📡 Sincronizar Nivel" (POST /api/supabase/docente/asignar-sesion)', async () => {
    const res = await request('/api/supabase/docente/asignar-sesion', {
      method: 'POST',
      headers: { 'x-user-role': 'docente' }
    }, {
      id_nino: 'nin_01',
      nivel: 2,
      observaciones: 'Ajuste adaptativo a Nivel 2'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.exito, true);
    assert.strictEqual(res.body.nino.nivel_actual, 2);
  });

  await test('Docente: Botón "💾 Actualizar en Expediente" (PUT /api/supabase/ninos/:id/nivel)', async () => {
    const res = await request('/api/supabase/ninos/nin_01/nivel', {
      method: 'PUT',
      headers: { 'x-user-role': 'docente' }
    }, {
      nivel: 1,
      observaciones: 'Retorno a Nivel 1 para calibración'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.exito, true);
  });

  let idComTest = null;
  await test('Docente: Botón "📨 Enviar Comunicación" (POST /api/supabase/comunicaciones)', async () => {
    const res = await request('/api/supabase/comunicaciones', {
      method: 'POST',
      headers: { 'x-user-role': 'docente' }
    }, {
      asunto: 'Nota clínica de verificación',
      contenido: 'Se confirma excelente respuesta sensorial.',
      tipo_mensaje: 'DIRECTO',
      id_destinatario_padre: 'usr_padre_01'
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.exito, true);
    idComTest = res.body.comunicacion.id;
  });

  await test('Docente: Botón "🔄 Recargar Bandeja" (GET /api/supabase/comunicaciones)', async () => {
    const res = await request('/api/supabase/comunicaciones', {
      headers: { 'x-user-role': 'docente' }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.exito, true);
  });

  await test('Docente: Botón "🔄 Actualizar Historial" (GET /api/supabase/sesiones)', async () => {
    const res = await request('/api/supabase/sesiones', {
      headers: { 'x-user-role': 'docente' }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.exito, true);
  });

  // --- 3. ROL PADRE ---
  console.log('\n--- 3. ROL PADRE (Dashboard Analítico Familiar) ---');

  await test('Padre: Botón "🔄 Refrescar" y Modal Reporte (GET /api/supabase/padre/reporte-analitico)', async () => {
    const res = await request('/api/supabase/padre/reporte-analitico', {
      headers: { 'x-user-role': 'padre', 'x-user-id': 'usr_padre_01' }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.exito, true);
    assert.ok(res.body.datos.kpis);
  });

  await test('Padre: Botones de Filtro de Eventos (GET /api/supabase/eventos)', async () => {
    const res = await request('/api/supabase/eventos?dirigido_a=TODOS', {
      headers: { 'x-user-role': 'padre' }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.exito, true);
  });

  await test('Padre: Botón "✓ Marcar como Leído" (PUT /api/supabase/comunicaciones/:id/leido)', async () => {
    if (!idComTest) return;
    const res = await request(`/api/supabase/comunicaciones/${idComTest}/leido`, {
      method: 'PUT',
      headers: { 'x-user-role': 'padre', 'x-user-id': 'usr_padre_01' }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.exito, true);
  });

  // --- 4. ROL ADMIN ---
  console.log('\n--- 4. ROL ADMIN (Gestión Centralizada y Hardware OTA) ---');

  await test('Admin: Botón "🔄 Forzar Sincronización OTA" (POST /api/supabase/hardware/comando)', async () => {
    const res = await request('/api/supabase/hardware/comando', {
      method: 'POST',
      headers: { 'x-user-role': 'admin' }
    }, {
      comando: 'UPDATE_PICTOGRAMS'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.exito, true);
  });

  await test('Admin: Botón "⚡ Latencia Nodo" (POST /api/supabase/hardware/comando)', async () => {
    const res = await request('/api/supabase/hardware/comando', {
      method: 'POST',
      headers: { 'x-user-role': 'admin' }
    }, {
      comando: 'PING'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.exito, true);
  });

  await test('Admin: Botón "⚠️ Reiniciar Pantalla HDMI" (POST /api/supabase/hardware/comando)', async () => {
    const res = await request('/api/supabase/hardware/comando', {
      method: 'POST',
      headers: { 'x-user-role': 'admin' }
    }, {
      comando: 'RESET_SESSION'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.exito, true);
  });

  await test('Admin: Botón "🔄 Refrescar Directorio" (GET /api/supabase/usuarios)', async () => {
    const res = await request('/api/supabase/usuarios', {
      headers: { 'x-user-role': 'admin' }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.exito, true);
  });

  const testEmail = `profesor_${Date.now()}@caimiup.edu.co`;
  await test('Admin: Botón "➕ Crear Usuario en Supabase" (POST /api/supabase/usuarios)', async () => {
    const res = await request('/api/supabase/usuarios', {
      method: 'POST',
      headers: { 'x-user-role': 'admin' }
    }, {
      email: testEmail,
      nombre_completo: 'Docente Evaluador',
      password: 'Password123*',
      role: 'docente'
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.exito, true);
  });

  let testIdNino = null;
  await test('Admin: Botón "💾 Dar de Alta Paciente" (POST /api/supabase/ninos)', async () => {
    const res = await request('/api/supabase/ninos', {
      method: 'POST',
      headers: { 'x-user-role': 'admin' }
    }, {
      codigo_estudiante: `EST-TEST-${Date.now().toString().slice(-4)}`,
      nombre_o_pseudonimo: 'Paciente Test',
      fecha_nacimiento: '2021-06-15',
      nivel_actual: 1,
      observaciones_terapeuticas: 'Paciente de prueba automatizada'
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.exito, true);
    testIdNino = res.body.nino.id_nino;
  });

  await test('Admin: Botón "💾 Guardar Cambios Paciente" (PUT /api/supabase/ninos/:id)', async () => {
    if (!testIdNino) return;
    const res = await request(`/api/supabase/ninos/${testIdNino}`, {
      method: 'PUT',
      headers: { 'x-user-role': 'admin' }
    }, {
      nombre_o_pseudonimo: 'Paciente Test Modificado',
      nivel_actual: 2,
      observaciones_terapeuticas: 'Notas actualizadas'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.exito, true);
  });

  let testPictoId = null;
  await test('Admin: Botón "☁️ Subir a Supabase Storage y Actualizar OTA" (POST /api/supabase/pictogramas)', async () => {
    const res = await request('/api/supabase/pictogramas', {
      method: 'POST',
      headers: { 'x-user-role': 'admin' }
    }, {
      nombre: 'Jugo',
      categoria: 'NECESIDAD',
      nivel: 1,
      boton_asociado: 'P1',
      audio_texto: 'Jugo fresco de frutas'
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.exito, true);
    testPictoId = res.body.pictograma.id_pictograma;
  });

  await test('Admin: Botón "💾 Guardar Cambios y Notificar RPi" (PUT /api/supabase/pictogramas/:id)', async () => {
    if (!testPictoId) return;
    const res = await request(`/api/supabase/pictogramas/${testPictoId}`, {
      method: 'PUT',
      headers: { 'x-user-role': 'admin' }
    }, {
      nombre: 'Jugo Natural',
      categoria: 'NECESIDAD',
      nivel: 1,
      boton_asociado: 'P1',
      audio_texto: 'Jugo natural recién hecho'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.exito, true);
  });

  await test('Admin: Botón "🗑️ Eliminar Pictograma" (DELETE /api/supabase/pictogramas/:id)', async () => {
    if (!testPictoId) return;
    const res = await request(`/api/supabase/pictogramas/${testPictoId}`, {
      method: 'DELETE',
      headers: { 'x-user-role': 'admin' }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.exito, true);
  });

  console.log('\n=====================================================================');
  console.log(`[QA_Tester]: RESUMEN FINAL: ${passed} PASARON, ${failed} FALLARON.`);
  console.log('=====================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch(e => {
  console.error('Error fatal ejecutando suite de verificación:', e);
  process.exit(1);
});
