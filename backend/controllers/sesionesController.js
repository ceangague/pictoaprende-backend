/**
 * =====================================================================
 * PROYECTO CAIMIUP - SESIONES DE APRENDIZAJE Y TELEMETRÍA
 * Fase 4: Controlador de Sesiones Interactivas y Flujo Pedagógico
 * Agente: Backend_DB_Dev & Pedagogy_PM
 * =====================================================================
 */

const { getStore } = require('../config/db');
const { enviarComandoTeclado, broadcastWebSocket } = require('../config/mqtt');

exports.getSesiones = (req, res) => {
  const store = getStore();
  const idNino = req.query.id_nino ? parseInt(req.query.id_nino) : null;

  let sesiones = store.sesiones;
  if (idNino) {
    sesiones = sesiones.filter(s => s.id_nino === idNino);
  }

  const enriquecidas = sesiones.map(s => {
    const nino = store.ninos.find(n => n.id_nino === s.id_nino);
    const docente = store.usuarios.find(u => u.id_usuario === s.id_docente);
    return {
      ...s,
      nombre_nino: nino ? nino.nombre_o_pseudonimo : 'Desconocido',
      nombre_docente: docente ? docente.nombre_completo : 'Docente'
    };
  });

  res.json({ exito: true, datos: enriquecidas });
};

exports.getSesionById = (req, res) => {
  const id = parseInt(req.params.id);
  const store = getStore();

  const sesion = store.sesiones.find(s => s.id_sesion === id);
  if (!sesion) {
    return res.status(404).json({ exito: false, mensaje: 'Sesión no encontrada' });
  }

  const interacciones = store.interacciones
    .filter(i => i.id_sesion === id)
    .map(i => {
      const picto = store.pictogramas.find(p => p.id_pictograma === i.id_pictograma);
      return {
        ...i,
        nombre_pictograma: picto ? picto.nombre : 'Desconocido',
        categoria_pictograma: picto ? picto.categoria : 'N/A'
      };
    });

  const nino = store.ninos.find(n => n.id_nino === sesion.id_nino);
  const docente = store.usuarios.find(u => u.id_usuario === sesion.id_docente);

  res.json({
    exito: true,
    datos: {
      ...sesion,
      nombre_nino: nino ? nino.nombre_o_pseudonimo : '',
      nombre_docente: docente ? docente.nombre_completo : '',
      interacciones
    }
  });
};

exports.iniciarSesion = (req, res) => {
  const { id_nino, id_docente, modalidad } = req.body;
  const store = getStore();

  if (!id_nino || !modalidad) {
    return res.status(400).json({ exito: false, mensaje: 'id_nino y modalidad son requeridos.' });
  }

  const nuevaSesion = {
    id_sesion: store.sesiones.length + 1,
    id_nino: parseInt(id_nino),
    id_docente: id_docente ? parseInt(id_docente) : 2,
    modalidad,
    fecha_inicio: new Date().toISOString(),
    fecha_fin: null,
    total_intentos: 0,
    total_aciertos: 0,
    total_errores: 0,
    observacion_docente: ''
  };

  store.sesiones.push(nuevaSesion);

  // Notificar al hardware IoT ESP32 vía MQTT
  enviarComandoTeclado({
    accion: 'INICIAR_SESION',
    id_sesion: nuevaSesion.id_sesion,
    modalidad: nuevaSesion.modalidad,
    nuevo_estimulo: true
  });

  // Notificar a clientes WebSocket
  broadcastWebSocket({
    tipo: 'SESION_INICIADA',
    sesion: nuevaSesion
  });

  res.status(201).json({
    exito: true,
    mensaje: 'Sesión pedagógica iniciada exitosamente',
    datos: nuevaSesion
  });
};

exports.finalizarSesion = (req, res) => {
  const id = parseInt(req.params.id);
  const { observacion_docente } = req.body;
  const store = getStore();

  const sesion = store.sesiones.find(s => s.id_sesion === id);
  if (!sesion) {
    return res.status(404).json({ exito: false, mensaje: 'Sesión no encontrada' });
  }

  sesion.fecha_fin = new Date().toISOString();
  if (observacion_docente) {
    sesion.observacion_docente = observacion_docente;
  }

  broadcastWebSocket({
    tipo: 'SESION_FINALIZADA',
    sesion
  });

  res.json({
    exito: true,
    mensaje: 'Sesión pedagógica finalizada y consolidada',
    datos: sesion
  });
};

exports.registrarInteraccion = (req, res) => {
  const { id_sesion, id_pictograma, tecla_pulsada, tiempo_reaccion_ms, resultado } = req.body;
  const store = getStore();

  const sid = id_sesion ? parseInt(id_sesion) : 1;
  const sesion = store.sesiones.find(s => s.id_sesion === sid);

  const nuevaInteraccion = {
    id_interaccion: store.interacciones.length + 1,
    id_sesion: sid,
    id_pictograma: parseInt(id_pictograma),
    tecla_pulsada: tecla_pulsada || 'T1',
    tiempo_reaccion_ms: parseInt(tiempo_reaccion_ms) || 1200,
    resultado: resultado || 'ACIERTO',
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

  // Notificar clientes en tiempo real
  broadcastWebSocket({
    tipo: 'TELEMETRIA_TECLADO',
    data: nuevaInteraccion
  });

  res.status(201).json({
    exito: true,
    mensaje: 'Interacción registrada',
    datos: nuevaInteraccion
  });
};
