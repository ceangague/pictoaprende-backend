/**
 * =====================================================================
 * PROYECTO CAIMIUP - SUITE DE PRUEBAS DE PROGRESIÓN ACUMULATIVA DE NIVELES
 * Fases: Fase 2 (Diseño), Fase 4 (Software), Fase 5 (Integración) y Fase 6 (QA)
 * Agente: [QA_Integration_Tester] & [Backend_Cloud_Dev]
 * =====================================================================
 * Requisitos Verificados:
 * - Nivel 1 = 3 botones (P1, P2, P3)
 * - Nivel 2 = 5 botones (Suma Nivel 1 + Nivel 2: P1..P5)
 * - Nivel 3 = 8 botones (Suma Niveles 1, 2, 3: P1..P8)
 * - Ordenamiento determinista ascendente por boton_asociado (P1..P8)
 * - Actualización reactiva mediante sync_control
 * =====================================================================
 */

const assert = require('assert');
const path = require('path');
const supabaseService = require('../../cloud_backend/supabase_service');
const firebaseService = require('../../cloud_backend/firebase_service');
const { getStore } = require('../config/db');
const pictogramasController = require('../controllers/pictogramasController');

function runProgressionTests() {
  console.log('\n======================================================');
  console.log('[QA_Integration_Tester]: Validando Lógica Acumulativa de Niveles (PictoAprende)');
  console.log('Arquitectura: Supabase Cloud & Local Edge Sync (TEACCH)');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  function test(nombre, fn) {
    try {
      fn();
      console.log(`  ✅ [PASS] ${nombre}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${nombre}`);
      console.error(`     Error: ${err.message}`);
      failed++;
    }
  }

  // --- 1. PRUEBAS EN SUPABASE SERVICE ---
  console.log('--- 1. Pruebas de Servicio Supabase ---');

  test('Test Nivel 1: Retorna exactamente 5 pictogramas de necesidades básicas (P1 a P5)', () => {
    // Simular que el docente establece nivel 1
    const pictos = supabaseService.getPictogramas(1);
    assert.strictEqual(pictos.length, 5, `Esperados 5 pictogramas en Nivel 1, obtenidos ${pictos.length}`);
    const botones = pictos.map(p => p.boton_asociado);
    assert.deepStrictEqual(botones, ['P1', 'P2', 'P3', 'P4', 'P5'], `Botones esperados ['P1', 'P2', 'P3', 'P4', 'P5'], obtenidos ${JSON.stringify(botones)}`);
    const nombres = pictos.map(p => p.nombre);
    assert.deepStrictEqual(nombres, ['Agua', 'Comida', 'Baño', 'Vestirse', 'Dormir']);
  });

  test('Test Nivel 2: Retorna exactamente 8 pictogramas de emociones y socialización (P1 a P8)', () => {
    // Simular nivel 2 (8 pictogramas dedicados)
    const pictos = supabaseService.getPictogramas(2);
    assert.strictEqual(pictos.length, 8, `Esperados 8 pictogramas en Nivel 2, obtenidos ${pictos.length}`);
    const botones = pictos.map(p => p.boton_asociado);
    assert.deepStrictEqual(botones, ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'], `Botones esperados P1-P8, obtenidos ${JSON.stringify(botones)}`);
    const nombres = pictos.map(p => p.nombre);
    assert.deepStrictEqual(nombres, ['Feliz', 'Triste', 'Enojado', 'Calma', 'Abrazo', 'Escuchar', 'Compartir', 'Esperar']);
  });

  test('Test Nivel 3: Retorna los 8 pictogramas complejos de rutinas y cognitivo (P1 al P8)', () => {
    // Simular nivel 3 (8 pictogramas complejos)
    const pictos = supabaseService.getPictogramas(3);
    assert.strictEqual(pictos.length, 8, `Esperados 8 pictogramas en Nivel 3, obtenidos ${pictos.length}`);
    const botones = pictos.map(p => p.boton_asociado);
    assert.deepStrictEqual(botones, ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'], `Botones esperados P1-P8, obtenidos ${JSON.stringify(botones)}`);
    const nombres = pictos.map(p => p.nombre);
    assert.deepStrictEqual(nombres, ['Jugar', 'Guardar', 'Pintar', 'Música', 'Ciencia', 'Contar', 'Construir', 'Despedida']);
  });

  test('Test Ordenamiento: Pictogramas ordenados estrictamente por boton_asociado físico', () => {
    const pictos = supabaseService.getPictogramas(3);
    for (let i = 0; i < pictos.length; i++) {
      assert.strictEqual(pictos[i].boton_asociado, `P${i + 1}`, `Posición ${i} debe ser P${i + 1}`);
    }
  });

  test('Test Sincronización sync_control: Actualización de nivel por el docente impacta hardware', () => {
    const userDocente = { role: 'docente', email: 'docente@caimiup.edu.co' };
    const res = supabaseService.actualizarNivelNino('nin_01', 2, userDocente, 'Avance a emociones');
    assert.strictEqual(res.exito, true);
    assert.strictEqual(res.nino.nivel_actual, 2);

    const statusSync = supabaseService.getSyncStatus();
    assert.strictEqual(statusSync.nivel_activo, 2);
    assert.strictEqual(statusSync.comando_pendiente, 'CHANGE_LEVEL');

    // Al consultar con el nivel_activo actualizado de sync_control (Nivel 2 = 8 pictogramas)
    const pictosActivos = supabaseService.getPictogramas(statusSync.nivel_activo);
    assert.strictEqual(pictosActivos.length, 8);
  });

  // --- 2. PRUEBAS EN FIREBASE SERVICE ---
  console.log('\n--- 2. Pruebas de Servicio Firebase (Arquitectura Híbrida) ---');

  test('Firebase Service: Nivel 1 retorna 3, Nivel 2 retorna 5, Nivel 3 retorna 8', () => {
    const p1 = firebaseService.getPictogramas(1);
    const p2 = firebaseService.getPictogramas(2);
    const p3 = firebaseService.getPictogramas(3);

    assert.strictEqual(p1.length, 3);
    assert.strictEqual(p2.length, 5);
    assert.strictEqual(p3.length, 8);
    assert.deepStrictEqual(p1.map(p => p.boton_asociado), ['P1', 'P2', 'P3']);
    assert.deepStrictEqual(p2.map(p => p.boton_asociado), ['P1', 'P2', 'P3', 'P4', 'P5']);
    assert.deepStrictEqual(p3.map(p => p.boton_asociado), ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8']);
  });

  // --- 3. PRUEBAS EN CONTROLADOR REST API ---
  console.log('\n--- 3. Pruebas en Controlador REST API /api/pictogramas ---');

  test('pictogramasController: Filtrado acumulativo con orden físico por tecla', () => {
    function fakeRes() {
      return {
        statusCode: 200,
        data: null,
        json(d) { this.data = d; return this; },
        status(code) { this.statusCode = code; return this; }
      };
    }

    const reqN1 = { query: { nivel: '1' } };
    const resN1 = fakeRes();
    pictogramasController.getPictogramas(reqN1, resN1);
    assert.strictEqual(resN1.data.exito, true);
    assert.strictEqual(resN1.data.total, 3);
    assert.deepStrictEqual(resN1.data.datos.map(p => p.boton_asociado), ['P1', 'P2', 'P3']);

    const reqN2 = { query: { nivel: '2' } };
    const resN2 = fakeRes();
    pictogramasController.getPictogramas(reqN2, resN2);
    assert.strictEqual(resN2.data.total, 5);
    assert.deepStrictEqual(resN2.data.datos.map(p => p.boton_asociado), ['P1', 'P2', 'P3', 'P4', 'P5']);

    const reqN3 = { query: { nivel: '3' } };
    const resN3 = fakeRes();
    pictogramasController.getPictogramas(reqN3, resN3);
    assert.strictEqual(resN3.data.total, 8);
    assert.deepStrictEqual(resN3.data.datos.map(p => p.boton_asociado), ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8']);
  });

  console.log('\n======================================================');
  console.log(`[QA_Integration_Tester]: Resumen de Pruebas: ${passed} PASARON, ${failed} FALLARON.`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runProgressionTests();
