/**
 * =====================================================================
 * PROYECTO CAIMIUP - GESTIÓN DE EVENTOS INSTITUCIONALES
 * Fase 4: Controlador del Módulo de Eventos CAIMIUP
 * Agente: Backend_DB_Dev
 * =====================================================================
 */

const { getStore } = require('../config/db');

exports.getEventos = (req, res) => {
  const store = getStore();
  const { dirigido_a, estado } = req.query;

  let eventos = [...store.eventos];

  if (dirigido_a && dirigido_a !== 'TODOS') {
    eventos = eventos.filter(e => e.dirigido_a === dirigido_a || e.dirigido_a === 'TODOS');
  }

  if (estado) {
    eventos = eventos.filter(e => e.estado === estado);
  }

  // Ordenar por fecha_inicio ascendente
  eventos.sort((a, b) => new Date(a.fecha_inicio) - new Date(b.fecha_inicio));

  res.json({
    exito: true,
    total: eventos.length,
    datos: eventos
  });
};

exports.getEventoById = (req, res) => {
  const id = parseInt(req.params.id);
  const store = getStore();
  const evento = store.eventos.find(e => e.id_evento === id);

  if (!evento) {
    return res.status(404).json({ exito: false, mensaje: 'Evento no encontrado' });
  }

  res.json({ exito: true, datos: evento });
};

exports.crearEvento = (req, res) => {
  const { titulo, descripcion, tipo_evento, fecha_inicio, fecha_fin, lugar, dirigido_a, capacidad_maxima, creado_por } = req.body;
  const store = getStore();

  if (!titulo || !fecha_inicio || !fecha_fin) {
    return res.status(400).json({ exito: false, mensaje: 'Título, fecha de inicio y fecha de fin son obligatorios.' });
  }

  const nuevoEvento = {
    id_evento: store.eventos.length + 1,
    titulo,
    descripcion: descripcion || '',
    tipo_evento: tipo_evento || 'TALLER_PADRES',
    fecha_inicio,
    fecha_fin,
    lugar: lugar || 'Sede CAIMIUP - Universidad de Pamplona',
    dirigido_a: dirigido_a || 'TODOS',
    capacidad_maxima: capacidad_maxima ? parseInt(capacidad_maxima) : 30,
    estado: 'PROGRAMADO',
    creado_por: creado_por ? parseInt(creado_por) : 1,
    creado_en: new Date().toISOString()
  };

  store.eventos.push(nuevoEvento);

  res.status(201).json({
    exito: true,
    mensaje: 'Evento institucional creado exitosamente',
    datos: nuevoEvento
  });
};

exports.actualizarEvento = (req, res) => {
  const id = parseInt(req.params.id);
  const store = getStore();
  const evento = store.eventos.find(e => e.id_evento === id);

  if (!evento) {
    return res.status(404).json({ exito: false, mensaje: 'Evento no encontrado' });
  }

  const { titulo, descripcion, tipo_evento, fecha_inicio, fecha_fin, lugar, dirigido_a, capacidad_maxima, estado } = req.body;

  if (titulo !== undefined) evento.titulo = titulo;
  if (descripcion !== undefined) evento.descripcion = descripcion;
  if (tipo_evento !== undefined) evento.tipo_evento = tipo_evento;
  if (fecha_inicio !== undefined) evento.fecha_inicio = fecha_inicio;
  if (fecha_fin !== undefined) evento.fecha_fin = fecha_fin;
  if (lugar !== undefined) evento.lugar = lugar;
  if (dirigido_a !== undefined) evento.dirigido_a = dirigido_a;
  if (capacidad_maxima !== undefined) evento.capacidad_maxima = parseInt(capacidad_maxima);
  if (estado !== undefined) evento.estado = estado;

  res.json({
    exito: true,
    mensaje: 'Evento actualizado exitosamente',
    datos: evento
  });
};

exports.eliminarEvento = (req, res) => {
  const id = parseInt(req.params.id);
  const store = getStore();
  const index = store.eventos.findIndex(e => e.id_evento === id);

  if (index === -1) {
    return res.status(404).json({ exito: false, mensaje: 'Evento no encontrado' });
  }

  const eliminado = store.eventos.splice(index, 1);
  res.json({
    exito: true,
    mensaje: 'Evento eliminado correctamente',
    datos: eliminado[0]
  });
};
