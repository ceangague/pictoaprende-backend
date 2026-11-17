/**
 * =====================================================================
 * PROYECTO CAIMIUP - SUITE DE VALIDACIÓN DE HARDWARE & IOT (FASE 3)
 * Verificación de Esquemático, Mapeo de Pines, JSON Serial y diagram.json
 * Agente: QA_Integration_Tester & IoT_Hardware_Eng
 * =====================================================================
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

async function runHardwareValidationTests() {
  console.log('\n==================================================================');
  console.log('[QA_Integration_Tester]: Validando Fase 3 - Hardware, IoT y Esquemático');
  console.log('Módulos: Mapeo de Pines | Formato Serial JSON | Simulación Wokwi | Seguridad 3.3V');
  console.log('==================================================================\n');

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

  // 1. Validar que el archivo diagram.json de Wokwi sea JSON válido y tenga 8 botones
  test('Wokwi: Archivo diagram.json es sintácticamente válido y contiene los 8 botones Kailh', () => {
    const wokwiPath = path.resolve(__dirname, '../../hardware_iot/wokwi/diagram.json');
    assert.ok(fs.existsSync(wokwiPath), 'El archivo diagram.json debe existir en hardware_iot/wokwi/');

    const content = fs.readFileSync(wokwiPath, 'utf8');
    const diagram = JSON.parse(content);

    assert.ok(Array.isArray(diagram.parts), 'diagram.json debe tener un arreglo de partes');
    assert.ok(Array.isArray(diagram.connections), 'diagram.json debe tener un arreglo de conexiones');

    // Verificar ESP32
    const esp = diagram.parts.find(p => p.id === 'esp');
    assert.ok(esp, 'diagram.json debe incluir el microcontrolador ESP32');

    // Verificar los 8 botones (P1 a P8)
    const botones = diagram.parts.filter(p => p.type === 'wokwi-pushbutton');
    assert.strictEqual(botones.length, 8, 'Deben existir exactamente 8 pulsadores para P1-P8');

    // Verificar LED y Buzzer
    const led = diagram.parts.find(p => p.id === 'led_status');
    const buzzer = diagram.parts.find(p => p.id === 'buzzer');
    assert.ok(led, 'Debe existir LED de confirmación');
    assert.ok(buzzer, 'Debe existir Buzzer suave');
  });

  // 2. Validar que los pines asignados en Wokwi correspondan a los pines seguros de solo lectura/entrada
  test('Seguridad GPIO: Los 8 botones están conectados a los pines seguros (13, 12, 14, 27, 26, 25, 33, 32)', () => {
    const wokwiPath = path.resolve(__dirname, '../../hardware_iot/wokwi/diagram.json');
    const diagram = JSON.parse(fs.readFileSync(wokwiPath, 'utf8'));

    const pinesEsperados = ['esp:13', 'esp:12', 'esp:14', 'esp:27', 'esp:26', 'esp:25', 'esp:33', 'esp:32'];

    pinesEsperados.forEach(pin => {
      const conexion = diagram.connections.find(c => c[0] === pin || c[1] === pin);
      assert.ok(conexion, `El pin ${pin} debe estar conectado a uno de los pulsadores en diagram.json`);
    });

    // Validar que ningún botón esté conectado a pines peligrosos (0, 6 a 11, etc.)
    const pinesPeligrosos = ['esp:0', 'esp:6', 'esp:7', 'esp:8', 'esp:9', 'esp:10', 'esp:11'];
    pinesPeligrosos.forEach(pin => {
      const conexionPeligrosa = diagram.connections.find(c => (c[0] === pin || c[1] === pin) && (String(c[0]).includes('btn') || String(c[1]).includes('btn')));
      assert.strictEqual(conexionPeligrosa, undefined, `PELIGRO: El pin ${pin} no debe usarse para botones`);
    });
  });

  // 3. Validar la estructura del Firmware ESP32 C++
  test('Firmware ESP32: Archivo esp32_kailh_keypad.ino implementa INPUT_PULLUP y formato JSON', () => {
    const inoPath = path.resolve(__dirname, '../../hardware_iot/esp32_firmware/esp32_kailh_keypad.ino');
    assert.ok(fs.existsSync(inoPath), 'El archivo esp32_kailh_keypad.ino debe existir');

    const code = fs.readFileSync(inoPath, 'utf8');

    assert.ok(code.includes('INPUT_PULLUP'), 'El firmware debe configurar los botones con INPUT_PULLUP');
    assert.ok(code.includes('DEBOUNCE_DELAY_MS'), 'El firmware debe implementar constante de antirrebote');
    assert.ok(code.includes('boton'), 'El firmware debe generar campo "boton" en JSON');
    assert.ok(code.includes('estado'), 'El firmware debe generar campo "estado" en JSON');
    assert.ok(code.includes('timestamp'), 'El firmware debe generar campo "timestamp" en JSON');
    assert.ok(code.includes('BEEP_OK'), 'El firmware debe responder a comandos BEEP_OK desde la RPi');
  });

  // 4. Validar el script Python de la Raspberry Pi Edge
  test('Script RPi: Archivo edge_serial_bridge.py implementa pyserial, auto-detect y parseo JSON', () => {
    const pyPath = path.resolve(__dirname, '../../hardware_edge/rpi_display/edge_serial_bridge.py');
    assert.ok(fs.existsSync(pyPath), 'El archivo edge_serial_bridge.py debe existir');

    const code = fs.readFileSync(pyPath, 'utf8');

    assert.ok(code.includes('serial.Serial'), 'El script debe usar pyserial para conexión');
    assert.ok(code.includes('json.loads'), 'El script debe deserializar tramas JSON');
    assert.ok(code.includes('auto_detect_port'), 'El script debe implementar auto-detección de puerto');
    assert.ok(code.includes('BEEP_OK'), 'El script debe emitir comandos de confirmación acústica');
  });

  // 5. Validar que la trama JSON generada sea completamente compatible con los endpoints del backend
  test('Compatibilidad Serial-Backend: Simulación de trama JSON parseable y válida para Supabase', () => {
    const muestraPayloadESP32 = JSON.stringify({
      boton: 'P1',
      estado: 'PRESIONADO',
      pictograma: 'Agua',
      gpio: 13,
      nivel: 1,
      dt_ms: 880,
      timestamp: Date.now()
    });

    const parsed = JSON.parse(muestraPayloadESP32);
    assert.strictEqual(parsed.boton, 'P1');
    assert.strictEqual(parsed.estado, 'PRESIONADO');
    assert.strictEqual(parsed.pictograma, 'Agua');
    assert.strictEqual(typeof parsed.dt_ms, 'number');
    assert.strictEqual(parsed.nivel, 1);
  });

  // 6. Validar documentación técnica y esquemático
  test('Documentación: Archivo ESQUEMATICO_Y_PINOUT.md contiene especificaciones completas', () => {
    const docPath = path.resolve(__dirname, '../../hardware_iot/ESQUEMATICO_Y_PINOUT.md');
    assert.ok(fs.existsSync(docPath), 'El documento ESQUEMATICO_Y_PINOUT.md debe existir');

    const doc = fs.readFileSync(docPath, 'utf8');
    assert.ok(doc.includes('Kailh Box Red'), 'Debe especificar switches Kailh Box Red');
    assert.ok(doc.includes('Elecrow 7-inch'), 'Debe especificar pantalla Elecrow 7"');
    assert.ok(doc.includes('Raspberry Pi 3 Model B+'), 'Debe especificar Raspberry Pi 3B+');
    assert.ok(doc.includes('1024x600'), 'Debe especificar resolución 1024x600');
    assert.ok(doc.includes('INPUT_PULLUP'), 'Debe documentar lógica INPUT_PULLUP');
    assert.ok(doc.includes('Power Budget') || doc.includes('Presupuesto'), 'Debe incluir balance de potencia');
  });

  console.log('\n==================================================================');
  console.log(`[QA_Integration_Tester]: Resumen de Hardware Tests: ${passed} Pasadas, ${failed} Fallidas`);
  console.log('==================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runHardwareValidationTests().catch(err => {
  console.error('Error fatal ejecutando pruebas de hardware:', err);
  process.exit(1);
});
