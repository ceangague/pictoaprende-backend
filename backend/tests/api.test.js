/**
 * =====================================================================
 * PROYECTO CAIMIUP - SUITE DE PRUEBAS AUTOMATIZADAS
 * Fase 6: Pruebas Unitarias, Integración y Validación de Algoritmos
 * Agente: QA_Tester
 * =====================================================================
 */

const http = require('http');
const assert = require('assert');

// Iniciar servidor en puerto de pruebas o usar el servidor existente
const { server, store, calcularMetricas } = require('../server');
const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

// Helper para realizar solicitudes HTTP en tests
function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method: method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, body: parsed, raw: data });
        } catch (e) {
          resolve({ status: res.statusCode, body: null, raw: data });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('\n======================================================');
  console.log('[QA_Tester]: Iniciando Suite de Pruebas Automatizadas');
  console.log('Proyecto: PictoAprende CAIMIUP');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(nombre, testFn) {
    try {
      await testFn();
      console.log(`  ✅ [PASS] ${nombre}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${nombre}`);
      console.error(`     Error: ${err.message}`);
      failed++;
    }
  }

  // 1. Prueba de Salud del Servidor
  await test('GET /health - Verificación de disponibilidad del servicio', async () => {
    const res = await request('GET', '/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.estado, 'ACTIVO');
    assert.strictEqual(res.body.proyecto, 'PictoAprende CAIMIUP');
  });

  // 2. Prueba de Autenticación y Roles
  await test('GET /api/auth/roles - Catálogo de roles institucionales', async () => {
    const res = await request('GET', '/api/auth/roles');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.exito, true);
    assert.strictEqual(res.body.datos.length >= 3, true);
    const roles = res.body.datos.map(r => r.nombre);
    assert.ok(roles.includes('ADMINISTRADOR'));
    assert.ok(roles.includes('DOCENTE'));
    assert.ok(roles.includes('ACUDIENTE'));
  });

  await test('POST /api/auth/login - Autenticación de docente del CAIMIUP', async () => {
    const res = await request('POST', '/api/auth/login', {
      correo: 'docente@caimiup.edu.co'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.exito, true);
    assert.strictEqual(res.body.usuario.rol, 'DOCENTE');
    assert.ok(res.body.token);
  });

  // 3. Prueba de Pacientes / Niños (Habeas Data)
  await test('GET /api/ninos - Listado de pacientes con datos protegidos', async () => {
    const res = await request('GET', '/api/ninos');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.exito, true);
    assert.ok(Array.isArray(res.body.datos));
  });

  await test('POST /api/ninos - Creación de nuevo registro seudonimizado', async () => {
    const res = await request('POST', '/api/ninos', {
      codigo_estudiante: 'EST-TEST-99',
      nombre_o_pseudonimo: 'Camilo T.',
      fecha_nacimiento: '2021-08-15',
      observaciones_terapeuticas: 'Prueba de QA automatizada'
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.exito, true);
    assert.strictEqual(res.body.datos.codigo_estudiante, 'EST-TEST-99');
  });

  // 4. Catálogo de Pictogramas ARASAAC (Catálogo de 21 Pictogramas Únicos e Independientes)
  await test('GET /api/pictogramas - Catálogo de 21 pictogramas vinculados a teclas', async () => {
    const res = await request('GET', '/api/pictogramas');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.exito, true);
    assert.strictEqual(res.body.total, 21);
    const teclas = res.body.datos.map(p => p.tecla_asociada);
    assert.ok(teclas.includes('T1'));
    assert.ok(teclas.includes('T8'));
  });

  await test('GET /api/supabase/pictogramas - Validación de niveles independientes no acumulativos', async () => {
    const resN1 = await request('GET', '/api/supabase/pictogramas?nivel=1');
    assert.strictEqual(resN1.status, 200);
    assert.strictEqual(resN1.body.datos.length, 5); // Nivel 1: 5 pictos (P1-P5)

    const resN2 = await request('GET', '/api/supabase/pictogramas?nivel=2');
    assert.strictEqual(resN2.status, 200);
    assert.strictEqual(resN2.body.datos.length, 8); // Nivel 2: 8 pictos (P1-P8)

    const resN3 = await request('GET', '/api/supabase/pictogramas?nivel=3');
    assert.strictEqual(resN3.status, 200);
    assert.strictEqual(resN3.body.datos.length, 8); // Nivel 3: 8 pictos (P1-P8)

    // Validar regla estricta: Ningún pictograma se repite entre niveles
    const nombresN1 = resN1.body.datos.map(p => p.nombre.toLowerCase());
    const nombresN2 = resN2.body.datos.map(p => p.nombre.toLowerCase());
    const nombresN3 = resN3.body.datos.map(p => p.nombre.toLowerCase());

    for (const n of nombresN1) {
      assert.ok(!nombresN2.includes(n), `Pictograma ${n} repetido entre Nivel 1 y Nivel 2`);
      assert.ok(!nombresN3.includes(n), `Pictograma ${n} repetido entre Nivel 1 y Nivel 3`);
    }
    for (const n of nombresN2) {
      assert.ok(!nombresN3.includes(n), `Pictograma ${n} repetido entre Nivel 2 y Nivel 3`);
    }
  });

  // 5. Ciclo de Sesiones Pedagógicas y Telemetría IoT
  let idSesionCreada = null;
  await test('POST /api/sesiones/iniciar - Creación de sesión pedagógica guiada', async () => {
    const res = await request('POST', '/api/sesiones/iniciar', {
      id_nino: 1,
      id_docente: 2,
      modalidad: 'IDENTIFICACION_GUIADA'
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.exito, true);
    assert.strictEqual(res.body.datos.modalidad, 'IDENTIFICACION_GUIADA');
    idSesionCreada = res.body.datos.id_sesion;
    assert.ok(idSesionCreada > 0);
  });

  await test('POST /api/supabase/sesion/iniciar y finalizar - Control de temporizador y estados de sesión', async () => {
    // Iniciar sesión con temporizador de 2 minutos
    const resInicio = await request('POST', '/api/supabase/sesion/iniciar', {
      id_nino: 'nin_01',
      nivel: 1,
      duracion_minutos: 2,
      observaciones: 'Evaluación rápida de discriminación táctil'
    }, { 'x-user-role': 'docente' });

    assert.strictEqual(resInicio.status, 200);
    assert.strictEqual(resInicio.body.exito, true);
    assert.strictEqual(resInicio.body.sesion.duracion_minutos, 2);
    assert.strictEqual(resInicio.body.sesion.estado, 'ACTIVA');
    assert.strictEqual(resInicio.body.sync.estado_sesion, 'ACTIVA');
    assert.strictEqual(resInicio.body.sync.duracion_minutos, 2);
    assert.strictEqual(resInicio.body.sync.comando_pendiente, 'START_SESSION');

    const idSesionIniciada = resInicio.body.sesion.id_sesion;

    // Finalizar sesión
    const resFin = await request('POST', '/api/supabase/sesion/finalizar', {
      id_sesion: idSesionIniciada,
      total_intentos: 5,
      total_aciertos: 4,
      total_errores: 1,
      duracion_real_seg: 120
    });

    assert.strictEqual(resFin.status, 200);
    assert.strictEqual(resFin.body.exito, true);
    assert.strictEqual(resFin.body.sync.estado_sesion, 'TERMINADA');
  });

  await test('POST /api/sesiones/interaccion - Ingesta de telemetría IoT con pulsación exitosa', async () => {
    const res = await request('POST', '/api/sesiones/interaccion', {
      id_sesion: idSesionCreada,
      id_pictograma: 1, // Agua
      tecla: 'T1',
      tiempo_reaccion_ms: 1150,
      resultado: 'ACIERTO'
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.exito, true);
    assert.strictEqual(res.body.datos.tecla_pulsada, 'T1');
    assert.strictEqual(res.body.datos.resultado, 'ACIERTO');
  });

  await test('PUT /api/sesiones/:id/finalizar - Cierre formal de sesión con notas clínicas', async () => {
    const res = await request('PUT', `/api/sesiones/${idSesionCreada}/finalizar`, {
      observacion_docente: 'Prueba de QA finalizada con respuesta satisfactoria.'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.exito, true);
    assert.ok(res.body.datos.fecha_fin);
  });

  // 6. Validación Matemática de Algoritmos Pedagógicos (Interés y Dificultad)
  await test('GET /api/metricas - Validación de fórmulas matemáticas de Interés y Dificultad', async () => {
    const res = await request('GET', '/api/metricas');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.exito, true);
    const r = res.body.datos.resumen;

    // Verificar que la tasa de aciertos esté acotada entre 0 y 100%
    assert.ok(r.tasa_aciertos_pct >= 0 && r.tasa_aciertos_pct <= 100);
    assert.ok(r.tiempo_promedio_reaccion_seg > 0);
    assert.ok(r.pictograma_mayor_interes !== null);

    // Validar algoritmo para cada pictograma
    const pictos = res.body.datos.analisis_pictogramas;
    assert.strictEqual(pictos.length, 21);
    pictos.forEach(p => {
      assert.ok(p.indice_interes_pct >= 0 && p.indice_interes_pct <= 100);
      assert.ok(p.indice_dificultad >= 0 && p.indice_dificultad <= 10);
    });
  });

  // 7. Módulo de Eventos CAIMIUP (CRUD)
  let idEventoCreado = null;
  await test('POST /api/eventos - Creación de evento institucional', async () => {
    const res = await request('POST', '/api/eventos', {
      titulo: 'Taller de Comunicación con ARASAAC para Familias',
      descripcion: 'Sesión presencial interactiva en CAIMIUP',
      tipo_evento: 'TALLER_PADRES',
      fecha_inicio: '2026-11-15T09:00:00',
      fecha_fin: '2026-11-15T11:00:00',
      dirigido_a: 'ACUDIENTES',
      lugar: 'Auditorio Central CAIMIUP'
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.exito, true);
    idEventoCreado = res.body.datos.id_evento;
    assert.ok(idEventoCreado > 0);
  });

  await test('GET /api/eventos - Filtrado de eventos por público objetivo', async () => {
    const res = await request('GET', '/api/eventos?dirigido_a=ACUDIENTES');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.exito, true);
    assert.ok(res.body.datos.length >= 1);
  });

  await test('DELETE /api/eventos/:id - Eliminación controlada de evento de prueba', async () => {
    const res = await request('DELETE', `/api/eventos/${idEventoCreado}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.exito, true);
  });

  console.log('\n======================================================');
  console.log(`[QA_Tester]: Resultados Finales: ${passed} PASARON, ${failed} FALLARON.`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('[QA_Tester]: Todos los módulos técnicos cumplen los criterios de aceptación.');
    process.exit(0);
  }
}

// Ejecutar si se invoca directamente con node
if (require.main === module) {
  runTests();
}

module.exports = { runTests };
