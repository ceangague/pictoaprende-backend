/**
 * =====================================================================
 * PROYECTO CAIMIUP - INGESTA DE TELEMETRÍA IOT (MQTT & WEBSOCKET)
 * Fase 3 & Fase 4: Suscriptor MQTT y Difusor en Tiempo Real
 * Agente: IoT_Hardware_Eng & Backend_DB_Dev
 * =====================================================================
 */

const mqtt = require('mqtt');
const { getStore } = require('./db');

const MQTT_BROKER = process.env.MQTT_BROKER || 'mqtt://broker.emqx.io:1883';
const TOPIC_INTERACCION = 'caimiup/teclado/interaccion';
const TOPIC_CONTROL = 'caimiup/teclado/control';
const TOPIC_ESTADO = 'caimiup/teclado/estado';

let mqttClient = null;
const wsClients = new Set();

function initMQTT(wss) {
  // Manejo de clientes WebSocket desde el frontend
  if (wss) {
    wss.on('connection', (ws) => {
      wsClients.add(ws);
      console.log(`[Backend_DB_Dev]: Cliente WebSocket conectado. Total clientes: ${wsClients.size}`);
      
      // Enviar estado actual inicial
      ws.send(JSON.stringify({ tipo: 'CONEXION_ESTABLECIDA', timestamp: Date.now() }));

      ws.on('close', () => {
        wsClients.delete(ws);
        console.log(`[Backend_DB_Dev]: Cliente WebSocket desconectado. Total clientes: ${wsClients.size}`);
      });
    });
  }

  // Conexión con broker MQTT
  console.log(`[IoT_Hardware_Eng]: Conectando suscriptor backend a broker MQTT: ${MQTT_BROKER}`);
  mqttClient = mqtt.connect(MQTT_BROKER, {
    clientId: 'CAIMIUP_BACKEND_SUB_' + Math.random().toString(16).substring(2, 8),
    clean: true,
    connectTimeout: 5000
  });

  mqttClient.on('connect', () => {
    console.log('[IoT_Hardware_Eng]: Suscriptor backend MQTT conectado.');
    mqttClient.subscribe([TOPIC_INTERACCION, TOPIC_ESTADO], (err) => {
      if (!err) {
        console.log(`[IoT_Hardware_Eng]: Suscrito exitosamente a tópicos: ${TOPIC_INTERACCION}, ${TOPIC_ESTADO}`);
      }
    });
  });

  mqttClient.on('message', (topic, message) => {
    try {
      const payload = JSON.parse(message.toString());
      console.log(`[IoT_Hardware_Eng]: Mensaje MQTT recibido en [${topic}]:`, payload);

      if (topic === TOPIC_INTERACCION) {
        procesarInteraccionIoT(payload);
      }

      // Difundir a todos los clientes WebSocket del frontend
      broadcastWebSocket({
        tipo: topic === TOPIC_INTERACCION ? 'TELEMETRIA_TECLADO' : 'ESTADO_DISPOSITIVO',
        topic,
        data: payload
      });
    } catch (err) {
      console.error('[Backend_DB_Dev]: Error al parsear mensaje MQTT:', err.message);
    }
  });

  mqttClient.on('error', (err) => {
    console.warn('[IoT_Hardware_Eng]: Advertencia broker MQTT:', err.message);
  });
}

/**
 * Procesa la pulsación de tecla y la almacena en el registro de telemetría
 */
function procesarInteraccionIoT(data) {
  const store = getStore();
  const idSesion = data.id_sesion || 1;
  const sesion = store.sesiones.find(s => s.id_sesion === idSesion);

  const nuevaInteraccion = {
    id_interaccion: store.interacciones.length + 1,
    id_sesion: idSesion,
    id_pictograma: data.id_pictograma || 1,
    tecla_pulsada: data.tecla || 'T1',
    tiempo_reaccion_ms: data.tiempo_reaccion_ms || 1200,
    resultado: data.resultado || (data.es_acierto === false ? 'ERROR' : 'ACIERTO'),
    timestamp_interaccion: new Date().toISOString()
  };

  store.interacciones.push(nuevaInteraccion);

  if (sesion) {
    sesion.total_intentos = (sesion.total_intentos || 0) + 1;
    if (nuevaInteraccion.resultado === 'ACIERTO') {
      sesion.total_aciertos = (sesion.total_aciertos || 0) + 1;
    } else if (nuevaInteraccion.resultado === 'ERROR') {
      sesion.total_errores = (sesion.total_errores || 0) + 1;
    }
  }

  console.log(`[Backend_DB_Dev]: Interacción guardada en BD. Sesión #${idSesion} actualizada.`);
}

/**
 * Notifica a los dashboards abiertos en el navegador
 */
function broadcastWebSocket(msgObj) {
  const payloadStr = JSON.stringify(msgObj);
  for (const client of wsClients) {
    if (client.readyState === 1) { // OPEN
      client.send(payloadStr);
    }
  }
}

/**
 * Publica un mensaje de control hacia el teclado ESP32
 */
function enviarComandoTeclado(comando) {
  if (mqttClient && mqttClient.connected) {
    mqttClient.publish(TOPIC_CONTROL, JSON.stringify(comando));
    console.log('[IoT_Hardware_Eng]: Comando de control enviado al teclado:', comando);
  }
}

module.exports = {
  initMQTT,
  broadcastWebSocket,
  enviarComandoTeclado,
  procesarInteraccionIoT
};
