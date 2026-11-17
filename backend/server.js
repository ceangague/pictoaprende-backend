/**
 * =====================================================================
 * PROYECTO CAIMIUP - SERVIDOR NATIVO REST & TELEMETRÍA IOT
 * Fases 3 & 4: Servidor HTTP, SSE en Tiempo Real, Ingesta de Telemetría
 * Agente: Backend_DB_Dev & IoT_Hardware_Eng
 * =====================================================================
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const os = require('os');
const dgram = require('dgram');
const crypto = require('crypto');

// Cargar .env de forma nativa si existe
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(envPath);
  } catch (e) {}
}

const PORT = process.env.PORT || 3000;
const FRONTEND_DIR = path.join(__dirname, '../frontend');
const WEB_DASHBOARD_DIR = path.join(__dirname, '../web_dashboard');
const firebaseService = require('../cloud_backend/firebase_service');
const supabaseService = require('../cloud_backend/supabase_service');
const emailService = require('./services/emailService');
const dbPersistence = require('./config/persistence');

// Manejo resiliente de excepciones no capturadas de red (ej. ECONNRESET desde Supabase Cloud)
process.on('uncaughtException', (err) => {
  console.warn('[Backend_Server]: Advertencia de excepción no capturada (recuperada):', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.warn('[Backend_Server]: Advertencia de promesa rechazada no controlada:', reason);
});

// --- 1. REPOSITORIO DE DATOS EN MEMORIA (CONFORME A SCHEMA.SQL Y SEED.SQL) ---
const store = {
  roles: [
    { id_rol: 1, nombre: 'ADMINISTRADOR', descripcion: 'Personal administrativo CAIMIUP' },
    { id_rol: 2, nombre: 'DOCENTE', descripcion: 'Docentes y terapeutas especializados' },
    { id_rol: 3, nombre: 'ACUDIENTE', descripcion: 'Padres de familia y tutores legales' }
  ],
  usuarios: [
    { id_usuario: 1, id_rol: 1, nombre_completo: 'Administrador PictoAprende', correo: 'admipictoaprende@gmail.com', password: 'AdmiPictoaprende2026', rol: 'ADMINISTRADOR', telefono: '' }
  ],
  ninos: [],
  pictogramas: [
    // Nivel 1: 5 Pictogramas Fáciles (P1 a P5)
    { id_pictograma: 1, codigo_arasaac: 2237, nombre: 'Agua', categoria: 'NECESIDAD', nivel: 1, tecla_asociada: 'T1', ruta_imagen: '/assets/pictograms/agua.svg', audio_refuerzo: 'Agua. Quiero agua fresca.', activo: true },
    { id_pictograma: 2, codigo_arasaac: 2463, nombre: 'Comida', categoria: 'NECESIDAD', nivel: 1, tecla_asociada: 'T2', ruta_imagen: '/assets/pictograms/comida.svg', audio_refuerzo: 'Comida. Hora de comer.', activo: true },
    { id_pictograma: 3, codigo_arasaac: 2844, nombre: 'Baño', categoria: 'NECESIDAD', nivel: 1, tecla_asociada: 'T3', ruta_imagen: '/assets/pictograms/bano.svg', audio_refuerzo: 'Baño. Necesito ir al baño.', activo: true },
    { id_pictograma: 4, codigo_arasaac: 3241, nombre: 'Vestirse', categoria: 'RUTINA', nivel: 1, tecla_asociada: 'T4', ruta_imagen: '/assets/pictograms/vestirse.svg', audio_refuerzo: 'Vestirse. Me pongo la ropa.', activo: true },
    { id_pictograma: 5, codigo_arasaac: 8120, nombre: 'Dormir', categoria: 'NECESIDAD', nivel: 1, tecla_asociada: 'T5', ruta_imagen: '/assets/pictograms/dormir.svg', audio_refuerzo: 'Dormir. Momento de descansar.', activo: true },
    // Nivel 2: 8 Pictogramas de Dificultad Media (P1 a P8)
    { id_pictograma: 6, codigo_arasaac: 3002, nombre: 'Feliz', categoria: 'EMOCION', nivel: 2, tecla_asociada: 'T1', ruta_imagen: '/assets/pictograms/feliz.svg', audio_refuerzo: 'Feliz. Me siento muy contento.', activo: true },
    { id_pictograma: 7, codigo_arasaac: 3005, nombre: 'Triste', categoria: 'EMOCION', nivel: 2, tecla_asociada: 'T2', ruta_imagen: '/assets/pictograms/triste.svg', audio_refuerzo: 'Triste. Necesito un abrazo.', activo: true },
    { id_pictograma: 8, codigo_arasaac: 3010, nombre: 'Enojado', categoria: 'EMOCION', nivel: 2, tecla_asociada: 'T3', ruta_imagen: '/assets/pictograms/enojado.svg', audio_refuerzo: 'Enojado. Necesito respirar profundo.', activo: true },
    { id_pictograma: 9, codigo_arasaac: 3122, nombre: 'Calma', categoria: 'EMOCION', nivel: 2, tecla_asociada: 'T4', ruta_imagen: '/assets/pictograms/calma.svg', audio_refuerzo: 'Calma. Me siento tranquilo.', activo: true },
    { id_pictograma: 10, codigo_arasaac: 5430, nombre: 'Abrazo', categoria: 'SOCIAL', nivel: 2, tecla_asociada: 'T5', ruta_imagen: '/assets/pictograms/abrazo.svg', audio_refuerzo: 'Abrazo. Quiero dar afecto.', activo: true },
    { id_pictograma: 11, codigo_arasaac: 4201, nombre: 'Escuchar', categoria: 'SOCIAL', nivel: 2, tecla_asociada: 'T6', ruta_imagen: '/assets/pictograms/escuchar.svg', audio_refuerzo: 'Escuchar. Presto atención.', activo: true },
    { id_pictograma: 12, codigo_arasaac: 6125, nombre: 'Compartir', categoria: 'SOCIAL', nivel: 2, tecla_asociada: 'T7', ruta_imagen: '/assets/pictograms/compartir.svg', audio_refuerzo: 'Compartir. Jugamos juntos.', activo: true },
    { id_pictograma: 13, codigo_arasaac: 5180, nombre: 'Esperar', categoria: 'RUTINA', nivel: 2, tecla_asociada: 'T8', ruta_imagen: '/assets/pictograms/esperar.svg', audio_refuerzo: 'Esperar. Espero mi turno con paciencia.', activo: true },
    // Nivel 3: 8 Pictogramas Complejos (P1 a P8)
    { id_pictograma: 14, codigo_arasaac: 6542, nombre: 'Jugar', categoria: 'RUTINA', nivel: 3, tecla_asociada: 'T1', ruta_imagen: '/assets/pictograms/jugar.svg', audio_refuerzo: 'Jugar. Vamos a divertirnos.', activo: true },
    { id_pictograma: 15, codigo_arasaac: 7011, nombre: 'Guardar', categoria: 'RUTINA', nivel: 3, tecla_asociada: 'T2', ruta_imagen: '/assets/pictograms/guardar.svg', audio_refuerzo: 'Guardar. Hora de ordenar los juguetes.', activo: true },
    { id_pictograma: 16, codigo_arasaac: 4780, nombre: 'Pintar', categoria: 'COGNITIVO', nivel: 3, tecla_asociada: 'T3', ruta_imagen: '/assets/pictograms/pintar.svg', audio_refuerzo: 'Pintar. Vamos a colorear.', activo: true },
    { id_pictograma: 17, codigo_arasaac: 5310, nombre: 'Música', categoria: 'COGNITIVO', nivel: 3, tecla_asociada: 'T4', ruta_imagen: '/assets/pictograms/musica.svg', audio_refuerzo: 'Música. Escuchemos una canción.', activo: true },
    { id_pictograma: 18, codigo_arasaac: 9205, nombre: 'Ciencia', categoria: 'COGNITIVO', nivel: 3, tecla_asociada: 'T5', ruta_imagen: '/assets/pictograms/ciencia.svg', audio_refuerzo: 'Ciencia. Hora de explorar y descubrir.', activo: true },
    { id_pictograma: 19, codigo_arasaac: 8340, nombre: 'Contar', categoria: 'COGNITIVO', nivel: 3, tecla_asociada: 'T6', ruta_imagen: '/assets/pictograms/contar.svg', audio_refuerzo: 'Contar. Uno, dos, tres números.', activo: true },
    { id_pictograma: 20, codigo_arasaac: 7415, nombre: 'Construir', categoria: 'COGNITIVO', nivel: 3, tecla_asociada: 'T7', ruta_imagen: '/assets/pictograms/construir.svg', audio_refuerzo: 'Construir. Apilemos los bloques.', activo: true },
    { id_pictograma: 21, codigo_arasaac: 6010, nombre: 'Despedida', categoria: 'RUTINA', nivel: 3, tecla_asociada: 'T8', ruta_imagen: '/assets/pictograms/despedida.svg', audio_refuerzo: 'Despedida. ¡Hasta luego, gran trabajo!', activo: true }
  ],
  sesiones: [],
  interacciones: [],
  eventos: [
    {
      id_evento: 1,
      titulo: 'Taller de Estrategias Visuales TEACCH en Casa',
      descripcion: 'Capacitación práctica para familias y acudientes en el uso de agendas visuales y reforzadores comunicativos.',
      tipo_evento: 'TALLER_PADRES',
      fecha_inicio: new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 16),
      fecha_fin: new Date(Date.now() + 86400000 * 3 + 7200000).toISOString().slice(0, 16),
      lugar: 'Auditorio Principal CAIMIUP - Unipamplona',
      dirigido_a: 'ACUDIENTES',
      capacidad_maxima: 35,
      estado: 'PROGRAMADO',
      creado_por: 1
    },
    {
      id_evento: 2,
      titulo: 'Jornada Lúdica y de Integración Sensorial',
      descripcion: 'Actividades motrices y de interacción social guiadas por el equipo de fonoaudiología y terapia ocupacional.',
      tipo_evento: 'JORNADA_LUDICA',
      fecha_inicio: new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 16),
      fecha_fin: new Date(Date.now() + 86400000 * 7 + 14400000).toISOString().slice(0, 16),
      lugar: 'Zona Verde y Gimnasio Terapéutico CAIMIUP',
      dirigido_a: 'TODOS',
      capacidad_maxima: 50,
      estado: 'PROGRAMADO',
      creado_por: 1
    },
    {
      id_evento: 3,
      titulo: 'Comité de Seguimiento Clínico y Pedagógico',
      descripcion: 'Evaluación multidisciplinaria de avances con docentes de educación especial y directores de programa.',
      tipo_evento: 'REUNION_EVALUACION',
      fecha_inicio: new Date(Date.now() + 86400000 * 12).toISOString().slice(0, 16),
      fecha_fin: new Date(Date.now() + 86400000 * 12 + 10800000).toISOString().slice(0, 16),
      lugar: 'Sala de Juntas CAIMIUP',
      dirigido_a: 'DOCENTES',
      capacidad_maxima: 15,
      estado: 'PROGRAMADO',
      creado_por: 1
    }
  ]
};

// --- 2. GESTIÓN DE CLIENTES SSE (SERVER-SENT EVENTS EN TIEMPO REAL) ---
const sseClients = new Set();

function broadcastEvent(eventType, data) {
  const message = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(message);
    } catch (e) {
      sseClients.delete(client);
    }
  }
}

// Heartbeat keep-alive para evitar desconexiones por inactividad de proxies o navegadores (cada 25s)
const sseHeartbeatInterval = setInterval(() => {
  for (const client of sseClients) {
    try {
      client.write(': keepalive\n\n');
    } catch (e) {
      sseClients.delete(client);
    }
  }
}, 25000);
if (sseHeartbeatInterval.unref) sseHeartbeatInterval.unref();

// Conectar notificador de Supabase Cloud a los clientes SSE de la plataforma Web
if (supabaseService && typeof supabaseService.onRealtime === 'function') {
  supabaseService.onRealtime(({ channel, payload }) => {
    broadcastEvent(channel || 'SUPABASE_REALTIME', payload);
    if (payload && payload.evento) {
      broadcastEvent(payload.evento, payload);
    }
  });
}

// Emisor de Beacon UDP para auto-descubrimiento y sincronización instantánea con Raspberry Pi
let beaconUdpSocket = null;
function iniciarBeaconAutoDiscovery(lanIps, port) {
  try {
    beaconUdpSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    beaconUdpSocket.bind(0, () => {
      try { beaconUdpSocket.setBroadcast(true); } catch (e) {}

      const wifiNet = lanIps.find(n => n.name && n.name.toLowerCase().includes('wi-fi')) ||
                      lanIps.find(n => n.name && n.name.toLowerCase().includes('ethernet') && !n.name.toLowerCase().includes('virtual')) ||
                      lanIps[0];
      const hostIp = wifiNet ? wifiNet.ip : '127.0.0.1';

      const payload = JSON.stringify({
        evento: 'PICTOAPRENDE_BACKEND_ONLINE',
        url: `http://${hostIp}:${port}`,
        ip: hostIp,
        port: port,
        time: Date.now()
      });
      const buffer = Buffer.from(payload);

      function emitir() {
        if (!beaconUdpSocket) return;
        // Broadcast general a la red local
        beaconUdpSocket.send(buffer, 0, buffer.length, 5055, '255.255.255.255', () => {});

        // Unicast a IP conocida en rpi_ip.txt
        const rpiIpFile = path.join(__dirname, '../rpi_ip.txt');
        if (fs.existsSync(rpiIpFile)) {
          try {
            const rpiHost = fs.readFileSync(rpiIpFile, 'utf8').trim();
            if (rpiHost && rpiHost !== hostIp) {
              beaconUdpSocket.send(buffer, 0, buffer.length, 5055, rpiHost, () => {});
            }
          } catch (e) {}
        }

        // Unicast a candidatos comunes
        ['172.20.10.3', '192.168.1.80', '192.168.1.78'].forEach(target => {
          beaconUdpSocket.send(buffer, 0, buffer.length, 5055, target, () => {});
        });
      }

      emitir();
      const beaconTimer = setInterval(emitir, 2500);
      console.log(`[IoT_Hardware_Eng]: ⚡ Beacon UDP Activo (Puerto 5055) -> Auto-descubrimiento instantáneo para RPi.`);
    });

    beaconUdpSocket.on('error', err => {
      console.warn('[IoT_Hardware_Eng]: Aviso en socket Beacon UDP:', err.message);
    });
  } catch (err) {
    console.warn('[IoT_Hardware_Eng]: No se pudo iniciar Beacon UDP:', err.message);
  }
}

// --- 3. FUNCIONES DE CÁLCULO PEDAGÓGICO (FASE 2 & FASE 4) ---
function calcularMetricas(idNino = null) {
  let sesiones = store.sesiones;
  let interacciones = store.interacciones;

  if (idNino) {
    sesiones = sesiones.filter(s => s.id_nino === idNino);
    const sIds = new Set(sesiones.map(s => s.id_sesion));
    interacciones = interacciones.filter(i => sIds.has(i.id_sesion));
  }

  const totalSesiones = sesiones.length;
  const totalIntentos = interacciones.length;
  const totalAciertos = interacciones.filter(i => i.resultado === 'ACIERTO').length;
  const totalErrores = interacciones.filter(i => i.resultado === 'ERROR').length;
  const tasaAciertos = totalIntentos > 0 ? ((totalAciertos / totalIntentos) * 100).toFixed(1) : '0.0';

  const sumaTiempo = interacciones.reduce((acc, curr) => acc + (curr.tiempo_reaccion_ms || 0), 0);
  const tiempoPromedioReaccionMs = totalIntentos > 0 ? Math.round(sumaTiempo / totalIntentos) : 0;
  const tiempoPromedioReaccionSeg = (tiempoPromedioReaccionMs / 1000).toFixed(2);

  const T_MAXIMO_MS = 5000;

  const analisisPictogramas = store.pictogramas.map(picto => {
    const interaccionesPicto = interacciones.filter(i => i.id_pictograma === picto.id_pictograma);
    const pulsaciones = interaccionesPicto.length;
    const aciertos = interaccionesPicto.filter(i => i.resultado === 'ACIERTO').length;
    const errores = interaccionesPicto.filter(i => i.resultado === 'ERROR').length;

    // Fórmula de Interés: (Pulsaciones Pi / Total) * 100
    const indiceInteres = totalIntentos > 0 ? Number(((pulsaciones / totalIntentos) * 100).toFixed(1)) : 0;

    const sumaT = interaccionesPicto.reduce((a, b) => a + (b.tiempo_reaccion_ms || 0), 0);
    const mediaTiempoMs = pulsaciones > 0 ? Math.round(sumaT / pulsaciones) : 0;

    // Fórmula de Dificultad: (Errores / Intentos * 0.6) + (Media_T / T_max * 0.4)
    let indiceDificultad = 0;
    if (pulsaciones > 0) {
      const compError = (errores / pulsaciones) * 0.6;
      const compTiempo = (Math.min(mediaTiempoMs, T_MAXIMO_MS) / T_MAXIMO_MS) * 0.4;
      indiceDificultad = Number(((compError + compTiempo) * 10).toFixed(2));
    }

    return {
      id_pictograma: picto.id_pictograma,
      nombre: picto.nombre,
      categoria: picto.categoria,
      tecla: picto.tecla_asociada,
      ruta_imagen: picto.ruta_imagen,
      pulsaciones,
      aciertos,
      errores,
      tiempo_medio_ms: mediaTiempoMs,
      indice_interes_pct: indiceInteres,
      indice_dificultad: indiceDificultad
    };
  });

  const porInteres = [...analisisPictogramas].sort((a, b) => b.indice_interes_pct - a.indice_interes_pct);
  const porDificultad = [...analisisPictogramas].sort((a, b) => b.indice_dificultad - a.indice_dificultad);

  return {
    resumen: {
      total_sesiones: totalSesiones,
      total_intentos: totalIntentos,
      total_aciertos: totalAciertos,
      total_errores: totalErrores,
      tasa_aciertos_pct: parseFloat(tasaAciertos),
      tiempo_promedio_reaccion_ms: tiempoPromedioReaccionMs,
      tiempo_promedio_reaccion_seg: parseFloat(tiempoPromedioReaccionSeg),
      pictograma_mayor_interes: porInteres.length > 0 ? porInteres[0] : null,
      pictograma_mayor_dificultad: porDificultad.length > 0 ? porDificultad[0] : null
    },
    analisis_pictogramas: analisisPictogramas,
    sesiones_recientes: sesiones.slice(-5).reverse()
  };
}

// --- 4. MAPEO DE TIPOS MIME PARA SERVIR ARCHIVOS ESTÁTICOS ---
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

// --- 5. SERVIDOR HTTP PRINCIPAL ---
const server = http.createServer((req, res) => {
  // Encabezados de Seguridad OWASP y CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id, x-user-email, x-user-role');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  let pathname = '/';
  let query = {};
  try {
    const parsedUrl = new URL(req.url, 'http://127.0.0.1');
    pathname = parsedUrl.pathname;
    query = Object.fromEntries(parsedUrl.searchParams.entries());
  } catch (errUrl) {
    const parts = (req.url || '/').split('?');
    pathname = parts[0] || '/';
    if (parts[1]) {
      try {
        const sp = new URLSearchParams(parts[1]);
        query = Object.fromEntries(sp.entries());
      } catch (e) {}
    }
  }

  // Helper para responder JSON
  const sendJSON = (statusCode, data) => {
    res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
  };

  // Helper para leer body JSON con mitigación de DoS por memoria
  const MAX_PAYLOAD_SIZE = 1024 * 1024; // Límite de 1MB por payload
  const parseBody = (callback) => {
    let body = '';
    let size = 0;
    let aborted = false;
    req.on('data', chunk => {
      if (aborted) return;
      size += chunk.length;
      if (size > MAX_PAYLOAD_SIZE) {
        aborted = true;
        sendJSON(413, { exito: false, mensaje: 'Carga útil excesiva (Límite 1MB permitido).' });
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on('end', () => {
      if (aborted) return;
      try {
        const json = body ? JSON.parse(body) : {};
        callback(json);
      } catch (e) {
        sendJSON(400, { exito: false, mensaje: 'Cuerpo de solicitud JSON inválido' });
      }
    });
  };

  // --- RUTAS DE LA API REST (/api) ---

  // Health
  if (pathname === '/health' && req.method === 'GET') {
    return sendJSON(200, { estado: 'ACTIVO', proyecto: 'PictoAprende CAIMIUP', version: '1.0.0', time: new Date() });
  }

  // SSE Stream en tiempo real para Dashboard y Telemetría
  if (pathname === '/api/telemetria/stream' || pathname === '/api/sync/events' || pathname === '/api/realtime') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write(`event: BIENVENIDA\ndata: ${JSON.stringify({ conectado: true, time: Date.now() })}\n\n`);
    sseClients.add(res);
    req.on('close', () => { sseClients.delete(res); });
    return;
  }

  // 1. Auth & Roles
  if (pathname === '/api/auth/roles' && req.method === 'GET') {
    return sendJSON(200, { exito: true, datos: store.roles });
  }

  if (pathname === '/api/auth/usuarios' && req.method === 'GET') {
    return sendJSON(200, { exito: true, datos: store.usuarios });
  }

  if (pathname === '/api/auth/login' && req.method === 'POST') {
    return parseBody(body => {
      const correo = (body.correo || body.email || '').trim().toLowerCase();
      const usuario = store.usuarios.find(u => u.correo.toLowerCase() === correo);
      if (!usuario) {
        return sendJSON(401, { exito: false, mensaje: 'Credenciales inválidas' });
      }
      if (body.password !== undefined && usuario.password && body.password !== usuario.password) {
        return sendJSON(401, { exito: false, mensaje: 'Contraseña incorrecta' });
      }
      return sendJSON(200, {
        exito: true,
        mensaje: 'Autenticación exitosa',
        usuario,
        token: 'token-caimiup-' + usuario.id_usuario
      });
    });
  }

  // 2. Niños
  if (pathname === '/api/ninos' && req.method === 'GET') {
    return sendJSON(200, { exito: true, datos: store.ninos });
  }

  if (pathname.startsWith('/api/ninos/') && req.method === 'GET') {
    const id = parseInt(pathname.split('/')[3]);
    const nino = store.ninos.find(n => n.id_nino === id);
    if (!nino) return sendJSON(404, { exito: false, mensaje: 'Niño no encontrado' });
    return sendJSON(200, { exito: true, datos: nino });
  }

  if (pathname === '/api/ninos' && req.method === 'POST') {
    return parseBody(body => {
      if (!body.codigo_estudiante || !body.nombre_o_pseudonimo) {
        return sendJSON(400, { exito: false, mensaje: 'Código y nombre son obligatorios' });
      }
      const nuevo = {
        id_nino: store.ninos.length + 1,
        codigo_estudiante: body.codigo_estudiante,
        nombre_o_pseudonimo: body.nombre_o_pseudonimo,
        fecha_nacimiento: body.fecha_nacimiento || '2021-01-01',
        id_acudiente: body.id_acudiente ? parseInt(body.id_acudiente) : 3,
        nombre_acudiente: 'María Gómez (Madre Acudiente)',
        observaciones_terapeuticas: body.observaciones_terapeuticas || '',
        activo: true
      };
      store.ninos.push(nuevo);
      return sendJSON(201, { exito: true, datos: nuevo });
    });
  }

  // 3. Pictogramas
  if (pathname === '/api/pictogramas' && req.method === 'GET') {
    let pictos = store.pictogramas;
    if (query.categoria) {
      pictos = pictos.filter(p => p.categoria.toLowerCase() === query.categoria.toLowerCase());
    }
    return sendJSON(200, { exito: true, total: pictos.length, datos: pictos });
  }

  // 4. Sesiones
  if (pathname === '/api/sesiones' && req.method === 'GET') {
    let sesiones = store.sesiones;
    if (query.id_nino) {
      sesiones = sesiones.filter(s => s.id_nino === parseInt(query.id_nino));
    }
    return sendJSON(200, { exito: true, datos: sesiones });
  }

  if (pathname.startsWith('/api/sesiones/') && !pathname.endsWith('/finalizar') && req.method === 'GET') {
    const id = parseInt(pathname.split('/')[3]);
    const sesion = store.sesiones.find(s => s.id_sesion === id);
    if (!sesion) return sendJSON(404, { exito: false, mensaje: 'Sesión no encontrada' });
    const interacciones = store.interacciones.filter(i => i.id_sesion === id);
    return sendJSON(200, { exito: true, datos: { ...sesion, interacciones } });
  }

  if (pathname === '/api/sesiones/iniciar' && req.method === 'POST') {
    return parseBody(body => {
      const nino = store.ninos.find(n => n.id_nino === parseInt(body.id_nino));
      const nuevaSesion = {
        id_sesion: store.sesiones.length + 1,
        id_nino: body.id_nino ? parseInt(body.id_nino) : 1,
        id_docente: body.id_docente ? parseInt(body.id_docente) : 2,
        nombre_nino: nino ? nino.nombre_o_pseudonimo : 'Estudiante TEA',
        nombre_docente: 'Lic. Liliana Flórez (Docente)',
        modalidad: body.modalidad || 'EXPLORACION_LIBRE',
        fecha_inicio: new Date().toISOString(),
        fecha_fin: null,
        total_intentos: 0,
        total_aciertos: 0,
        total_errores: 0,
        observacion_docente: ''
      };
      store.sesiones.push(nuevaSesion);
      broadcastEvent('SESION_INICIADA', nuevaSesion);
      return sendJSON(201, { exito: true, datos: nuevaSesion });
    });
  }

  if (pathname.includes('/finalizar') && req.method === 'PUT') {
    const parts = pathname.split('/');
    const id = parseInt(parts[3]);
    const sesion = store.sesiones.find(s => s.id_sesion === id);
    if (!sesion) return sendJSON(404, { exito: false, mensaje: 'Sesión no encontrada' });

    return parseBody(body => {
      sesion.fecha_fin = new Date().toISOString();
      if (body.observacion_docente) sesion.observacion_docente = body.observacion_docente;
      broadcastEvent('SESION_FINALIZADA', sesion);
      return sendJSON(200, { exito: true, datos: sesion });
    });
  }

  // Telemetría / Ingesta de pulsación (Vía Teclado ESP32, Simulador o Frontend)
  if ((pathname === '/api/sesiones/interaccion' || pathname === '/api/telemetria/simular') && req.method === 'POST') {
    return parseBody(body => {
      const idSesion = body.id_sesion ? parseInt(body.id_sesion) : (store.sesiones.length || 1);
      const idPictograma = body.id_pictograma ? parseInt(body.id_pictograma) : 1;
      const picto = store.pictogramas.find(p => p.id_pictograma === idPictograma) || store.pictogramas[0];

      const sesion = store.sesiones.find(s => s.id_sesion === idSesion);
      const resultado = body.resultado || (body.es_acierto === false ? 'ERROR' : 'ACIERTO');
      const tiempoReaccion = parseInt(body.tiempo_reaccion_ms) || 1200;

      const nuevaInteraccion = {
        id_interaccion: store.interacciones.length + 1,
        id_sesion: idSesion,
        id_pictograma: picto.id_pictograma,
        tecla_pulsada: body.tecla || picto.tecla_asociada,
        nombre_pictograma: picto.nombre,
        tiempo_reaccion_ms: tiempoReaccion,
        resultado: resultado,
        timestamp_interaccion: new Date().toISOString()
      };

      store.interacciones.push(nuevaInteraccion);

      if (sesion) {
        sesion.total_intentos = (sesion.total_intentos || 0) + 1;
        if (resultado === 'ACIERTO') sesion.total_aciertos = (sesion.total_aciertos || 0) + 1;
        if (resultado === 'ERROR') sesion.total_errores = (sesion.total_errores || 0) + 1;
      }

      // Difundir inmediatamente a todos los dashboards conectados por SSE
      broadcastEvent('TELEMETRIA_TECLADO', nuevaInteraccion);

      return sendJSON(201, { exito: true, datos: nuevaInteraccion });
    });
  }

  // 5. Módulo de Eventos CAIMIUP
  if (pathname === '/api/eventos' && req.method === 'GET') {
    let eventos = [...store.eventos];
    if (query.dirigido_a && query.dirigido_a !== 'TODOS') {
      eventos = eventos.filter(e => e.dirigido_a === query.dirigido_a || e.dirigido_a === 'TODOS');
    }
    if (query.estado) {
      eventos = eventos.filter(e => e.estado === query.estado);
    }
    eventos.sort((a, b) => new Date(a.fecha_inicio) - new Date(b.fecha_inicio));
    return sendJSON(200, { exito: true, total: eventos.length, datos: eventos });
  }

  if (pathname.startsWith('/api/eventos/') && req.method === 'GET') {
    const id = parseInt(pathname.split('/')[3]);
    const evento = store.eventos.find(e => e.id_evento === id);
    if (!evento) return sendJSON(404, { exito: false, mensaje: 'Evento no encontrado' });
    return sendJSON(200, { exito: true, datos: evento });
  }

  if (pathname === '/api/eventos' && req.method === 'POST') {
    return parseBody(body => {
      if (!body.titulo || !body.fecha_inicio || !body.fecha_fin) {
        return sendJSON(400, { exito: false, mensaje: 'Título y fechas son requeridos' });
      }
      const nuevoEvento = {
        id_evento: store.eventos.length + 1,
        titulo: body.titulo,
        descripcion: body.descripcion || '',
        tipo_evento: body.tipo_evento || 'TALLER_PADRES',
        fecha_inicio: body.fecha_inicio,
        fecha_fin: body.fecha_fin,
        lugar: body.lugar || 'Sede CAIMIUP - Unipamplona',
        dirigido_a: body.dirigido_a || 'TODOS',
        capacidad_maxima: body.capacidad_maxima ? parseInt(body.capacidad_maxima) : 30,
        estado: 'PROGRAMADO',
        creado_por: 1
      };
      store.eventos.push(nuevoEvento);
      broadcastEvent('EVENTO_CREADO', nuevoEvento);
      return sendJSON(201, { exito: true, datos: nuevoEvento });
    });
  }

  if (pathname.startsWith('/api/eventos/') && req.method === 'PUT') {
    const id = parseInt(pathname.split('/')[3]);
    const evento = store.eventos.find(e => e.id_evento === id);
    if (!evento) return sendJSON(404, { exito: false, mensaje: 'Evento no encontrado' });

    return parseBody(body => {
      Object.assign(evento, body);
      broadcastEvent('EVENTO_ACTUALIZADO', evento);
      return sendJSON(200, { exito: true, datos: evento });
    });
  }

  if (pathname.startsWith('/api/eventos/') && req.method === 'DELETE') {
    const id = parseInt(pathname.split('/')[3]);
    const index = store.eventos.findIndex(e => e.id_evento === id);
    if (index === -1) return sendJSON(404, { exito: false, mensaje: 'Evento no encontrado' });
    const eliminado = store.eventos.splice(index, 1)[0];
    broadcastEvent('EVENTO_ELIMINADO', { id_evento: id });
    return sendJSON(200, { exito: true, datos: eliminado });
  }

  // 6. Métricas
  if (pathname === '/api/metricas' && req.method === 'GET') {
    const idNino = query.id_nino ? parseInt(query.id_nino) : null;
    const metricas = calcularMetricas(idNino);
    return sendJSON(200, { exito: true, datos: metricas });
  }

  // =====================================================================
  // --- RUTAS SUPABASE / CLOUD (POSTGRESQL + RLS + REALTIME + STORAGE) ---
  // =====================================================================

  const getRequestUser = () => {
    const roleHeader = (req.headers['x-user-role'] || '').toLowerCase();
    const userIdHeader = req.headers['x-user-id'];
    const userEmailHeader = req.headers['x-user-email'];
    const authHeader = (req.headers['authorization'] || '').toLowerCase();
    const referer = (req.headers['referer'] || '').toLowerCase();

    // Si viene identificación explícita por headers de test / sesión API
    if (userIdHeader || userEmailHeader) {
      const user = supabaseService.getUserByIdOrEmail ? supabaseService.getUserByIdOrEmail(userIdHeader, userEmailHeader) : null;
      if (user) return user;
      if (roleHeader) {
        let ninoAsoc = null;
        if (roleHeader === 'padre') {
          ninoAsoc = (userIdHeader === 'usr_padre_02' || (userEmailHeader && userEmailHeader.includes('santiago'))) ? 'nin_02' : 'nin_01';
        }
        return {
          id: userIdHeader || 'usr_temp',
          auth_user_id: userIdHeader || 'usr_temp',
          role: roleHeader,
          email: userEmailHeader || 'usuario@caimiup.edu.co',
          nombre_completo: 'Usuario CAIMIUP',
          id_nino_asociado: ninoAsoc,
          activo: true
        };
      }
    }

    if (roleHeader === 'admin' || authHeader.includes('admin') || referer.includes('admin.html')) {
      return supabaseService.getAdminUser ? supabaseService.getAdminUser() : supabaseService.getCurrentUser();
    }
    if (roleHeader === 'docente' || authHeader.includes('docente') || referer.includes('docente.html')) {
      return supabaseService.getDocenteUser ? supabaseService.getDocenteUser(userIdHeader || userEmailHeader) : supabaseService.getCurrentUser();
    }
    if (roleHeader === 'padre' || authHeader.includes('padre') || referer.includes('padre.html')) {
      return supabaseService.getPadreUser ? supabaseService.getPadreUser(userIdHeader || userEmailHeader) : supabaseService.getCurrentUser();
    }
    return supabaseService.getCurrentUser();
  };

  // Endpoint OTA (Over-The-Air) para actualización instantánea desde la Raspberry Pi sin SCP
  if (pathname.startsWith('/api/hardware/ota/') && req.method === 'GET') {
    const filename = pathname.replace('/api/hardware/ota/', '');
    const rpiDir = path.join(__dirname, '..', 'hardware_edge', 'rpi_display');

    if (filename === 'actualizar.sh') {
      const laptopIp = '192.168.1.69';
      const shContent = `#!/bin/bash
echo "[IoT_Hardware_Eng]: ====================================================="
echo "[IoT_Hardware_Eng]: 🔄 DESCARGANDO ACTUALIZACIÓN DESDE http://${laptopIp}:3000"
echo "[IoT_Hardware_Eng]: ====================================================="
cd /home/pi/PictoAprende/hardware_edge/rpi_display 2>/dev/null || cd ~/PictoAprende/hardware_edge/rpi_display 2>/dev/null || cd .
curl -s http://${laptopIp}:3000/api/hardware/ota/main_display.py -o main_display.py
curl -s http://${laptopIp}:3000/api/hardware/ota/supabase_sync.py -o supabase_sync.py
curl -s http://${laptopIp}:3000/api/hardware/ota/pictoaprende-display.service -o pictoaprende-display.service
echo "http://${laptopIp}:3000" > backend_url.txt
echo "[IoT_Hardware_Eng]: ✅ Archivos actualizados exitosamente."
echo "[IoT_Hardware_Eng]: 🚀 Iniciando pantalla HDMI terapéutica (Elecrow 7\")..."
DISPLAY=:0 python3 main_display.py
`;
      res.writeHead(200, { 'Content-Type': 'text/x-shellscript' });
      return res.end(shContent);
    }

    const targetFile = path.join(rpiDir, path.basename(filename));
    if (fs.existsSync(targetFile)) {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      return fs.createReadStream(targetFile).pipe(res);
    }
    return sendJSON(404, { exito: false, mensaje: 'Archivo no encontrado' });
  }

  // Estado del Servicio Supabase
  if ((pathname === '/api/supabase/status' || pathname === '/api/cloud/status') && req.method === 'GET') {
    return sendJSON(200, { exito: true, supabase: supabaseService.getStatus() });
  }

  // Configurar credenciales del proyecto Supabase (CaimiuUP) - Requiere rol de Administrador
  if (pathname === '/api/supabase/config' && req.method === 'POST') {
    const currentUser = getRequestUser();
    if (!currentUser || currentUser.role !== 'admin') {
      return sendJSON(403, { exito: false, mensaje: 'Acceso denegado: Se requiere rol de Administrador para modificar la infraestructura y credenciales de Supabase.' });
    }
    return parseBody(body => {
      try {
        const status = supabaseService.configureSupabase({
          url: body.url || body.supabase_url,
          anonKey: body.anon_key || body.supabase_anon_key,
          serviceRoleKey: body.service_role_key || body.supabase_service_role_key
        });
        return sendJSON(200, { exito: true, mensaje: 'Credenciales del proyecto Supabase actualizadas.', supabase: status });
      } catch (err) {
        return sendJSON(400, { exito: false, mensaje: err.message });
      }
    });
  }

  // Probar conectividad real con Supabase (CaimiuUP)
  if (pathname === '/api/supabase/test' && (req.method === 'POST' || req.method === 'GET')) {
    supabaseService.testConnection().then(resTest => {
      return sendJSON(resTest.connected ? 200 : 400, resTest);
    }).catch(err => {
      return sendJSON(500, { connected: false, message: err.message });
    });
    return;
  }

  // Sync Status y Heartbeat para la Raspberry Pi (Supabase / Cloud / sync_control)
  if ((pathname === '/api/supabase/sync-status' || pathname === '/api/supabase/sync-control' || pathname === '/api/cloud/sync-status') && req.method === 'GET') {
    const rawIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').replace(/^.*:/, '');
    const userAgent = req.headers['user-agent'] || '';
    const esHardwareRPi = userAgent.includes('RPi') || (query.device_id && query.nivel !== undefined);
    if (esHardwareRPi) {
      const syncUpdated = supabaseService.registrarPingHardware({
        device_id: query.device_id || 'RPI_CAIMIUP_01',
        ip: rawIp || '172.20.10.3',
        nivel: query.nivel,
        estudiante: query.estudiante
      });
      broadcastEvent('HARDWARE_HEARTBEAT', syncUpdated);
      return sendJSON(200, { exito: true, sync: syncUpdated });
    }
    return sendJSON(200, { exito: true, sync: supabaseService.getSyncStatus() });
  }

  // Catálogo de Pictogramas (Supabase)
  if ((pathname === '/api/supabase/pictogramas' || pathname === '/api/cloud/pictogramas') && req.method === 'GET') {
    const nivel = query.nivel ? parseInt(query.nivel) : null;
    const pictos = supabaseService.getPictogramas(nivel);
    return sendJSON(200, { exito: true, datos: pictos });
  }

  // Admin inyecta nuevo pictograma hacia Supabase Storage y RPi
  if ((pathname === '/api/supabase/pictogramas' || pathname === '/api/cloud/pictogramas') && req.method === 'POST') {
    return parseBody(body => {
      try {
        const currentUser = getRequestUser();
        const resInyeccion = supabaseService.inyectarPictograma(body, currentUser);
        broadcastEvent('OTA_UPDATE_PICTOGRAMS', resInyeccion.pictograma);
        return sendJSON(201, resInyeccion);
      } catch (err) {
        return sendJSON(403, { exito: false, mensaje: err.message });
      }
    });
  }

  // Admin edita un pictograma existente
  if (((pathname.startsWith('/api/supabase/pictogramas/') || pathname.startsWith('/api/cloud/pictogramas/'))) && req.method === 'PUT') {
    const parts = pathname.split('/');
    const idPictograma = parts[4];
    return parseBody(body => {
      try {
        const currentUser = getRequestUser();
        const resActualizar = supabaseService.actualizarPictograma(idPictograma, body, currentUser);
        broadcastEvent('OTA_UPDATE_PICTOGRAMS', resActualizar.pictograma);
        return sendJSON(200, resActualizar);
      } catch (err) {
        return sendJSON(403, { exito: false, mensaje: err.message });
      }
    });
  }

  // Admin elimina un pictograma del catálogo
  if (((pathname.startsWith('/api/supabase/pictogramas/') || pathname.startsWith('/api/cloud/pictogramas/'))) && req.method === 'DELETE') {
    const parts = pathname.split('/');
    const idPictograma = parts[4];
    try {
      const currentUser = getRequestUser();
      const resEliminar = supabaseService.eliminarPictograma(idPictograma, currentUser);
      broadcastEvent('OTA_UPDATE_PICTOGRAMS', { eliminado_id: idPictograma });
      return sendJSON(200, resEliminar);
    } catch (err) {
      return sendJSON(403, { exito: false, mensaje: err.message });
    }
  }

  // Subir imagen al Storage Bucket "pictogramas" (Admin)
  if ((pathname === '/api/supabase/storage/upload' || pathname === '/api/cloud/storage/upload') && req.method === 'POST') {
    return parseBody(body => {
      try {
        const currentUser = getRequestUser();
        const resUpload = supabaseService.subirImagenStorage(body.filename, body.content, body.contentType, currentUser);
        return sendJSON(200, resUpload);
      } catch (err) {
        return sendJSON(403, { exito: false, mensaje: err.message });
      }
    });
  }

  // Handshake Inicial Instantáneo (Raspberry Pi -> Servidor al encender para sincronización inmediata)
  if ((pathname === '/api/supabase/hardware/handshake' || pathname === '/api/cloud/hardware/handshake') && req.method === 'POST') {
    return parseBody(body => {
      const rawIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').replace(/^.*:/, '');
      const syncUpdated = supabaseService.registrarPingHardware({
        device_id: body.device_id || 'RPI_CAIMIUP_01',
        ip: body.ip || rawIp || '172.20.10.3',
        nivel: body.nivel,
        estudiante: body.estudiante
      });

      // Confirmar automáticamente si el nivel reportado coincide con el backend
      if (syncUpdated.comando_pendiente === 'CHANGE_LEVEL' &&
          Number(body.nivel) === Number(syncUpdated.nivel_activo)) {
        supabaseService.confirmarComandoHardware('CHANGE_LEVEL');
      }

      const catalogo = supabaseService.getPictogramas(syncUpdated.nivel_activo);
      broadcastEvent('HARDWARE_HANDSHAKE', { sync: syncUpdated, catalogo_length: catalogo.length });
      broadcastEvent('HARDWARE_HEARTBEAT', syncUpdated);

      return sendJSON(200, {
        exito: true,
        mensaje: 'Handshake inicial completado con éxito. Nodo Raspberry Pi totalmente sincronizado.',
        sync: supabaseService.getSyncStatus(),
        nivel_activo: syncUpdated.nivel_activo,
        estudiante_activo_id: syncUpdated.estudiante_activo_id,
        catalogo: catalogo
      });
    });
  }

  // Enviar comando manual a la Raspberry Pi (Admin / Docente)
  if ((pathname === '/api/supabase/hardware/comando' || pathname === '/api/cloud/hardware/comando') && req.method === 'POST') {
    return parseBody(body => {
      try {
        const currentUser = getRequestUser();
        const resComando = supabaseService.enviarComandoHardware(body.comando, currentUser);
        broadcastEvent('HARDWARE_COMMAND', resComando);
        return sendJSON(200, resComando);
      } catch (err) {
        return sendJSON(403, { exito: false, mensaje: err.message });
      }
    });
  }

  // Confirmación / Acknowledgment de comando ejecutado por la Raspberry Pi
  if ((pathname === '/api/supabase/hardware/ack-comando' || pathname === '/api/cloud/hardware/ack-comando') && req.method === 'POST') {
    return parseBody(body => {
      const resAck = supabaseService.confirmarComandoHardware(body.comando);
      broadcastEvent('HARDWARE_ACK', resAck);
      return sendJSON(200, resAck);
    });
  }

  // Listar usuarios registrados (Admin / Docente con RLS)
  if ((pathname === '/api/supabase/usuarios' || pathname === '/api/cloud/usuarios') && req.method === 'GET') {
    try {
      const currentUser = getRequestUser();
      const usuarios = supabaseService.getUsuarios(currentUser);
      return sendJSON(200, { exito: true, datos: usuarios });
    } catch (err) {
      return sendJSON(403, { exito: false, mensaje: err.message });
    }
  }

  // Crear nuevo usuario (Admin exclusivo, con enlace a nino si rol es padre)
  if ((pathname === '/api/supabase/usuarios' || pathname === '/api/cloud/usuarios') && req.method === 'POST') {
    return parseBody(async body => {
      try {
        const currentUser = getRequestUser();
        const resCrear = await supabaseService.crearUsuario(body, currentUser);
        broadcastEvent('NUEVO_USUARIO', resCrear.usuario);

        // Despachar correo de bienvenida institucional CAIMIUP al destinatario
        if (resCrear.exito && body.email) {
          let nombreNino = null;
          if (body.id_nino_asociado) {
            try {
              const ninos = supabaseService.getNinos(currentUser);
              const n = ninos.find(c => c.id_nino === body.id_nino_asociado);
              if (n) nombreNino = `${n.nombre_o_pseudonimo} (${n.codigo_estudiante})`;
            } catch (e) {}
          }
          emailService.enviarBienvenidaUsuario({
            email: body.email,
            nombre: body.nombre_completo,
            role: body.role,
            password: body.password || 'Caimiup2026*',
            nombreNino,
            urlAcceso: `http://${req.headers.host || 'localhost:3000'}`
          }).catch(mailErr => {
            console.warn('[Backend_DB_Dev]: Advertencia al despachar correo de bienvenida:', mailErr.message);
          });
        }

        return sendJSON(201, resCrear);
      } catch (err) {
        console.error('[server.js POST /api/supabase/usuarios error]:', err.message);
        return sendJSON(400, { exito: false, mensaje: err.message });
      }
    });
  }

  // Telemetría enviada por Raspberry Pi desde los botones físicos (Supabase metricas_palabras)
  if ((pathname === '/api/supabase/telemetria' || pathname === '/api/cloud/telemetria') && req.method === 'POST') {
    return parseBody(body => {
      const metrica = supabaseService.registrarTelemetria(body);
      broadcastEvent('HARDWARE_INTERACCION', metrica);
      return sendJSON(201, { exito: true, datos: metrica });
    });
  }

  // Métricas e Histogramas analíticos para padres y docentes (Supabase RLS)
  if ((pathname === '/api/supabase/metricas' || pathname === '/api/cloud/metricas') && req.method === 'GET') {
    try {
      const currentUser = getRequestUser();
      const idNino = query.id_nino || (currentUser.role === 'padre' ? currentUser.id_nino_asociado : 'nin_01');
      const reporte = supabaseService.obtenerMetricas(idNino, currentUser);
      return sendJSON(200, { exito: true, datos: reporte });
    } catch (err) {
      return sendJSON(403, { exito: false, mensaje: err.message });
    }
  }

  // Reporte Analítico Consolidado para Padres (RLS Estricto Habeas Data)
  if ((pathname === '/api/supabase/padre/reporte-analitico' || pathname === '/api/cloud/padre/reporte-analitico') && req.method === 'GET') {
    try {
      const currentUser = getRequestUser();
      const idNino = query.id_nino || null;
      const reporte = supabaseService.obtenerReporteAnaliticoPadre(idNino, currentUser);
      return sendJSON(200, { exito: true, datos: reporte });
    } catch (err) {
      const statusCode = err.message.includes('42501') ? 403 : (err.message.includes('no encontrado') ? 404 : 500);
      return sendJSON(statusCode, { exito: false, mensaje: err.message });
    }
  }

  // Historial de Sesiones Guardadas en Base de Datos para el Rol de Padres (Persistencia a reinicio)
  if ((pathname === '/api/supabase/padre/sesiones' || pathname === '/api/cloud/padre/sesiones') && req.method === 'GET') {
    try {
      const currentUser = getRequestUser();
      const idNino = query.id_nino || null;
      const resultado = supabaseService.getSesionesPadre(idNino, currentUser);
      return sendJSON(200, resultado);
    } catch (err) {
      const statusCode = err.message.includes('42501') ? 403 : (err.message.includes('no encontrado') ? 404 : 500);
      return sendJSON(statusCode, { exito: false, mensaje: err.message });
    }
  }

  // Eventos institucionales y agenda CAIMIUP (Supabase Cloud)
  if ((pathname === '/api/supabase/eventos' || pathname === '/api/cloud/eventos') && req.method === 'GET') {
    try {
      const currentUser = getRequestUser();
      const filtroDirigido = query.dirigido_a || null;
      const eventos = supabaseService.getEventos(filtroDirigido, currentUser);
      return sendJSON(200, { exito: true, total: eventos.length, datos: eventos });
    } catch (err) {
      return sendJSON(403, { exito: false, mensaje: err.message });
    }
  }

  // Lista de niños protegida por RLS en Supabase
  if ((pathname === '/api/supabase/ninos' || pathname === '/api/cloud/ninos') && req.method === 'GET') {
    const currentUser = getRequestUser();
    const ninos = supabaseService.getNinos(currentUser);
    return sendJSON(200, { exito: true, datos: ninos });
  }

  // Admin registra nuevo niño / paciente en Supabase
  if ((pathname === '/api/supabase/ninos' || pathname === '/api/cloud/ninos') && req.method === 'POST') {
    return parseBody(async body => {
      try {
        const currentUser = getRequestUser();
        const resNino = await supabaseService.crearNino(body, currentUser);
        broadcastEvent('NUEVO_NINO', resNino.nino);
        return sendJSON(201, resNino);
      } catch (err) {
        const isRLS = err.message.includes('RLS Error') || err.message.includes('Permiso denegado');
        return sendJSON(isRLS ? 403 : 400, { exito: false, mensaje: err.message });
      }
    });
  }

  // Docente actualiza el nivel pedagógico del niño (Supabase sync_control & RLS)
  if (((pathname.startsWith('/api/supabase/ninos/') || pathname.startsWith('/api/cloud/ninos/')) && pathname.endsWith('/nivel')) && req.method === 'PUT') {
    const parts = pathname.split('/');
    const idNino = parts[4];
    return parseBody(body => {
      try {
        const currentUser = getRequestUser();
        const resNivel = supabaseService.actualizarNivelNino(idNino, body.nivel, currentUser, body.observaciones);
        broadcastEvent('NIVEL_CAMBIADO', resNivel);
        return sendJSON(200, resNivel);
      } catch (err) {
        return sendJSON(403, { exito: false, mensaje: err.message });
      }
    });
  }

  // Docente inicia formalmente sesión con temporizador (2, 5, 10 min) en RPi
  if ((pathname === '/api/supabase/sesion/iniciar' || pathname === '/api/cloud/sesion/iniciar') && req.method === 'POST') {
    return parseBody(body => {
      try {
        const currentUser = getRequestUser();
        const resInicio = supabaseService.iniciarSesionHardware(body, currentUser);
        broadcastEvent('SESION_INICIADA', resInicio);
        broadcastEvent('HARDWARE_SYNC', resInicio);
        broadcastEvent('HARDWARE_COMMAND', { comando: 'START_SESSION', sync: resInicio.sync });
        return sendJSON(200, resInicio);
      } catch (err) {
        return sendJSON(403, { exito: false, mensaje: err.message });
      }
    });
  }

  // Cierre de sesión clínica (RPi al terminar tiempo o Docente manualmente)
  if ((pathname === '/api/supabase/sesion/finalizar' || pathname === '/api/cloud/sesion/finalizar') && req.method === 'POST') {
    return parseBody(body => {
      try {
        const resFin = supabaseService.finalizarSesionHardware(body);
        broadcastEvent('SESION_FINALIZADA', resFin);
        broadcastEvent('HARDWARE_COMMAND', { comando: 'END_SESSION', sync: resFin.sync });
        return sendJSON(200, resFin);
      } catch (err) {
        return sendJSON(500, { exito: false, mensaje: err.message });
      }
    });
  }

  // Actualización de estado de pantalla desde RPi (ej. retorno a 'ESPERANDO')
  if ((pathname === '/api/supabase/hardware/estado-sesion' || pathname === '/api/cloud/hardware/estado-sesion') && req.method === 'POST') {
    return parseBody(body => {
      try {
        const resEstado = supabaseService.establecerEstadoSesion(body.estado_sesion || 'ESPERANDO');
        broadcastEvent('SESSION_STATE_CHANGED', resEstado);
        return sendJSON(200, resEstado);
      } catch (err) {
        return sendJSON(400, { exito: false, mensaje: err.message });
      }
    });
  }

  // Docente asigna sesión clínica y sincroniza al hardware RPi (Req 1 y 2)
  if ((pathname === '/api/supabase/docente/asignar-sesion' || pathname === '/api/cloud/docente/asignar-sesion') && req.method === 'POST') {
    return parseBody(body => {
      try {
        const currentUser = getRequestUser();
        const resAsignacion = supabaseService.actualizarNivelNino(body.id_nino, body.nivel, currentUser, body.observaciones);
        broadcastEvent('HARDWARE_SYNC', resAsignacion);
        return sendJSON(200, resAsignacion);
      } catch (err) {
        return sendJSON(403, { exito: false, mensaje: err.message });
      }
    });
  }

  // Historial consolidado de sesiones de hardware (Req 4)
  if ((pathname === '/api/supabase/sesiones' || pathname === '/api/supabase/historial-sesiones' || pathname === '/api/cloud/sesiones') && req.method === 'GET') {
    try {
      const currentUser = getRequestUser();
      const sesiones = supabaseService.getHistorialSesiones(currentUser);
      return sendJSON(200, { exito: true, total: sesiones.length, datos: sesiones });
    } catch (err) {
      return sendJSON(403, { exito: false, mensaje: err.message });
    }
  }

  // Listar comunicaciones y mensajería con RLS (Req 3)
  if ((pathname === '/api/supabase/comunicaciones' || pathname === '/api/cloud/comunicaciones') && req.method === 'GET') {
    try {
      const currentUser = getRequestUser();
      const mensajes = supabaseService.getComunicaciones(currentUser);
      return sendJSON(200, { exito: true, total: mensajes.length, datos: mensajes });
    } catch (err) {
      return sendJSON(403, { exito: false, mensaje: err.message });
    }
  }

  // Docente o Admin redacta y envía comunicado a familias (General o Directo) (Req 3)
  if ((pathname === '/api/supabase/comunicaciones' || pathname === '/api/cloud/comunicaciones') && req.method === 'POST') {
    return parseBody(body => {
      try {
        const currentUser = getRequestUser();
        const resMsg = supabaseService.crearComunicacion(body, currentUser);
        if (!resMsg.es_duplicado) {
          broadcastEvent('NUEVA_COMUNICACION', resMsg.comunicacion);
        }

        // Notificar por correo electrónico institucional CAIMIUP al acudiente o acudientes
        if (resMsg.exito && resMsg.comunicacion && !resMsg.es_duplicado) {
          const msg = resMsg.comunicacion;
          const hostUrl = `http://${req.headers.host || 'localhost:3000'}/dashboard/padre.html`;

          if (msg.tipo_mensaje === 'DIRECTO' && msg.id_destinatario) {
            try {
              const padres = supabaseService.getPadres(currentUser);
              const p = padres.find(pad => pad.id === msg.id_destinatario || pad.auth_user_id === msg.id_destinatario || pad.email === msg.id_destinatario);
              if (p && p.email) {
                emailService.enviarNotificacionComunicado({
                  emailPadre: p.email,
                  nombrePadre: p.nombre_completo,
                  nombreDocente: msg.nombre_remitente,
                  asunto: msg.asunto,
                  contenido: msg.contenido,
                  nombreNino: p.nombre_nino,
                  urlAcceso: hostUrl
                }).catch(err => console.warn('[Backend_DB_Dev]: Advertencia al notificar por correo al padre:', err.message));
              }
            } catch (e) {}
          } else if (msg.tipo_mensaje === 'GENERAL') {
            try {
              const padres = supabaseService.getPadres(currentUser);
              padres.forEach(p => {
                if (p.email) {
                  emailService.enviarNotificacionComunicado({
                    emailPadre: p.email,
                    nombrePadre: p.nombre_completo,
                    nombreDocente: msg.nombre_remitente,
                    asunto: `[General] ${msg.asunto}`,
                    contenido: msg.contenido,
                    nombreNino: p.nombre_nino,
                    urlAcceso: hostUrl
                  }).catch(() => {});
                }
              });
            } catch (e) {}
          }
        }

        return sendJSON(201, resMsg);
      } catch (err) {
        return sendJSON(400, { exito: false, mensaje: err.message });
      }
    });
  }

  // Marcar comunicado como leído por el acudiente
  if ((pathname.startsWith('/api/supabase/comunicaciones/') || pathname.startsWith('/api/cloud/comunicaciones/')) && pathname.endsWith('/leido') && req.method === 'PUT') {
    const parts = pathname.split('/');
    const idMsg = parts[4];
    try {
      const currentUser = getRequestUser();
      const resLeido = supabaseService.marcarComunicacionLeida(idMsg, currentUser);
      return sendJSON(200, resLeido);
    } catch (err) {
      return sendJSON(403, { exito: false, mensaje: err.message });
    }
  }

  // Directorio de Padres/Acudientes para el selector de mensajes directos
  if ((pathname === '/api/supabase/padres' || pathname === '/api/cloud/padres') && req.method === 'GET') {
    try {
      const currentUser = getRequestUser();
      const padres = supabaseService.getPadres(currentUser);
      return sendJSON(200, { exito: true, total: padres.length, datos: padres });
    } catch (err) {
      return sendJSON(403, { exito: false, mensaje: err.message });
    }
  }

  // Admin / Docente actualiza datos o notas clínicas del niño
  if (((pathname.startsWith('/api/supabase/ninos/') || pathname.startsWith('/api/cloud/ninos/')) && !pathname.endsWith('/nivel')) && req.method === 'PUT') {
    const parts = pathname.split('/');
    const idNino = parts[4];
    return parseBody(body => {
      try {
        const currentUser = getRequestUser();
        const resUpdate = supabaseService.actualizarNino(idNino, body, currentUser);
        broadcastEvent('NINO_ACTUALIZADO', resUpdate.nino);
        return sendJSON(200, resUpdate);
      } catch (err) {
        return sendJSON(403, { exito: false, mensaje: err.message });
      }
    });
  }

  // Contacto público CAIMIUP
  if (pathname === '/api/contacto' && req.method === 'POST') {
    return parseBody(body => {
      if (!body.nombre || !body.correo || !body.mensaje) {
        return sendJSON(400, { exito: false, mensaje: 'Por favor complete su nombre, correo y mensaje.' });
      }
      const nuevoContacto = {
        id: Date.now(),
        nombre: body.nombre.trim(),
        correo: body.correo.trim(),
        asunto: (body.asunto || 'Consulta General CAIMIUP').trim(),
        mensaje: body.mensaje.trim(),
        fecha: new Date().toISOString()
      };
      if (!store.contactos) store.contactos = [];
      store.contactos.push(nuevoContacto);

      // Notificar al ciudadano remitente con membrete oficial CAIMIUP
      emailService.enviarConfirmacionContacto(nuevoContacto).catch(err => {
        console.warn('[Backend_DB_Dev]: Advertencia al despachar confirmación de contacto:', err.message);
      });

      return sendJSON(200, {
        exito: true,
        mensaje: '¡Gracias por comunicarte con el Centro de Atención Integral Materno Infantil (CAIMIUP)! Tu mensaje ha sido recibido con éxito por el equipo interdisciplinario.',
        contacto: nuevoContacto
      });
    });
  }

  // Diagnóstico y Estado del Servicio de Correo Institucional CAIMIUP
  if (pathname === '/api/email/status' && req.method === 'GET') {
    return sendJSON(200, {
      exito: true,
      servicio: 'CAIMIUP Email Delivery Engine',
      estado: emailService.getStatus()
    });
  }

  // Prueba de Entrega Directa de Correo (Admin / Verificación)
  if (pathname === '/api/email/test' && req.method === 'POST') {
    return parseBody(async body => {
      const destinatario = body.destinatario || body.to || body.email;
      if (!destinatario) {
        return sendJSON(400, { exito: false, mensaje: 'Por favor indique el correo electrónico destinatario para la prueba.' });
      }
      try {
        const resEnvio = await emailService.probarEnvio(destinatario);
        return sendJSON(200, resEnvio);
      } catch (err) {
        return sendJSON(500, { exito: false, mensaje: 'Error al enviar correo: ' + err.message });
      }
    });
  }

  // Login y enrutamiento estricto RBAC (Supabase)
  if ((pathname === '/api/supabase/login' || pathname === '/api/cloud/login') && req.method === 'POST') {
    return parseBody(body => {
      const email = body.email || body.correo || '';
      const password = body.password !== undefined ? body.password : null;
      const role = body.role || null;
      const resLogin = supabaseService.login(email, password, role);
      if (!resLogin.exito) {
        return sendJSON(401, resLogin);
      }
      return sendJSON(200, resLogin);
    });
  }

  // Validación y verificación de Sesión Activa de Usuario guardada en Base de Datos (Persistente a reinicio)
  if ((pathname === '/api/supabase/sesion/activa' || pathname === '/api/auth/sesion/activa') && req.method === 'GET') {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim() || (req.headers['x-auth-token'] || '');
    const userRole = req.headers['x-user-role'] || null;
    const userEmail = req.headers['x-user-email'] || null;

    const resSesion = supabaseService.validarSesionActiva(token, userRole, userEmail);
    if (!resSesion.valida) {
      return sendJSON(401, { exito: false, mensaje: resSesion.mensaje });
    }
    return sendJSON(200, {
      exito: true,
      mensaje: 'Sesión activa confirmada desde la base de datos persistente CAIMIUP.',
      sesion: resSesion.sesion
    });
  }

  // Logout formal de Usuario en Base de Datos
  if ((pathname === '/api/supabase/logout' || pathname === '/api/auth/logout') && req.method === 'POST') {
    return parseBody(body => {
      const authHeader = req.headers['authorization'] || '';
      const token = body.token || authHeader.replace(/^Bearer\s+/i, '').trim();
      const email = body.email || req.headers['x-user-email'] || null;
      const cerrado = supabaseService.cerrarSesionUsuario(token, email);
      return sendJSON(200, {
        exito: true,
        mensaje: 'Sesión cerrada y actualizada en la base de datos persistente.',
        cerrado
      });
    });
  }

  // --- SERVIR ARCHIVOS ESTÁTICOS (WEB DASHBOARD PREFERENTE, FRONTEND FALLBACK) ---
  // Mitigación estricta de Path Traversal e Inyección de Archivos Sensibles
  let decodedPath = '';
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch (e) {
    decodedPath = pathname;
  }
  decodedPath = decodedPath.replace(/\0/g, '');

  // Bloqueo de acceso a archivos de sistema, entorno o scripts sensibles
  const blockedPatterns = ['.env', '.git', '.bat', '.ps1', 'package.json', 'package-lock.json', '.key', '.pem', '.sql'];
  const lowerPath = decodedPath.toLowerCase();
  if (blockedPatterns.some(pattern => lowerPath.includes(pattern))) {
    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ exito: false, mensaje: 'Acceso denegado: Recurso restringido por política de seguridad CAIMIUP.' }));
  }

  let cleanRelPath = path.normalize(decodedPath).replace(/^(\.\.[\/\\])+/g, '').replace(/^[\\\/]+/, '');
  if (!cleanRelPath || cleanRelPath === '.' || cleanRelPath === 'index.html') {
    cleanRelPath = 'index.html';
  }

  // Confinamiento estricto a las carpetas autorizadas (sandboxing)
  let filePath = path.resolve(WEB_DASHBOARD_DIR, cleanRelPath);
  if (!filePath.startsWith(WEB_DASHBOARD_DIR)) {
    filePath = path.resolve(FRONTEND_DIR, cleanRelPath);
    if (!filePath.startsWith(FRONTEND_DIR)) {
      res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ exito: false, mensaje: 'Violación de seguridad: Intento de Path Traversal bloqueado.' }));
    }
  }

  if (!fs.existsSync(filePath)) {
    const candidateFrontend = path.resolve(FRONTEND_DIR, cleanRelPath);
    if (candidateFrontend.startsWith(FRONTEND_DIR) && fs.existsSync(candidateFrontend)) {
      filePath = candidateFrontend;
    }
  }

  // Si es un directorio, intentar buscar index.html o admin.html dentro de él
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    const subIndex = path.join(filePath, 'index.html');
    const subAdmin = path.join(filePath, 'admin.html');
    if (fs.existsSync(subIndex)) {
      filePath = subIndex;
    } else if (fs.existsSync(subAdmin)) {
      filePath = subAdmin;
    } else {
      filePath = path.join(WEB_DASHBOARD_DIR, 'index.html');
    }
  }

  // Si no existe el archivo solicitado
  if (!fs.existsSync(filePath)) {
    const ext = path.extname(cleanRelPath).toLowerCase();
    // Si tiene extensión y no es .html (ej. .svg, .png, .css, .js), responder 404 real para que el navegador y onerror actúen adecuadamente
    if (ext && ext !== '.html') {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ exito: false, mensaje: `Recurso no encontrado: ${cleanRelPath}` }));
    }
    if (fs.existsSync(path.join(WEB_DASHBOARD_DIR, 'index.html'))) {
      filePath = path.join(WEB_DASHBOARD_DIR, 'index.html');
    } else {
      filePath = path.join(FRONTEND_DIR, 'index.html');
    }
  }

  if (fs.existsSync(filePath)) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const headers = {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0'
    };
    if (ext === '.html') {
      headers['Clear-Site-Data'] = '"cache"';
    }
    res.writeHead(200, headers);
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Recurso No Encontrado');
  }
});

if (require.main === module) {
  server.listen(PORT, '0.0.0.0', () => {
    const interfaces = os.networkInterfaces();
    const lanIps = [];
    for (const name of Object.keys(interfaces)) {
      for (const net of interfaces[name]) {
        if (net.family === 'IPv4' && !net.internal) {
          lanIps.push({ name, ip: net.address });
        }
      }
    }

    console.log('=====================================================================');
    console.log(`[Backend_DB_Dev]: Servidor PictoAprende CAIMIUP en ejecución.`);
    console.log(`[Frontend_UX_Dev]: Plataforma Web Local: http://localhost:${PORT}`);
    if (lanIps.length > 0) {
      console.log(`[IoT_Hardware_Eng]: Direcciones de Red LAN detectadas:`);
      lanIps.forEach(net => console.log(`   -> http://${net.ip}:${PORT}  (${net.name})`));
    }
    console.log(`[IoT_Hardware_Eng]: Telemetría en http://localhost:${PORT}/api/telemetria/stream`);
    iniciarBeaconAutoDiscovery(lanIps, PORT);
    console.log(`[Pedagogy_PM]: Métricas clínicas y eventos sincronizados.`);
    console.log('=====================================================================');
  });
} else {
  if (!server.listening) {
    server.listen(PORT, () => {}).on('error', (err) => {
      if (err.code !== 'EADDRINUSE') {
        throw err;
      }
    });
  }
}

function gracefulShutdown() {
  console.log('\n[Backend_Server]: Liberando recursos y cerrando servidor PictoAprende...');
  try {
    dbPersistence.guardarInmediato();
    console.log('[Backend_DB_Dev]: ✅ Base de datos y sesiones persistidas exitosamente antes del apagado.');
  } catch (e) {
    console.warn('[Backend_DB_Dev]: Aviso al persistir en apagado:', e.message);
  }
  if (beaconUdpSocket) {
    try { beaconUdpSocket.close(); } catch (e) {}
  }
  for (const client of sseClients) {
    try { client.end(); } catch (e) {}
  }
  sseClients.clear();
  server.close(() => {
    console.log('[Backend_Server]: Servidor cerrado limpiamente.');
  });
}
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

module.exports = { server, store, calcularMetricas };
