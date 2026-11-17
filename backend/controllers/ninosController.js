/**
 * =====================================================================
 * PROYECTO CAIMIUP - GESTIÓN DE PACIENTES / NIÑOS
 * Fase 4: Controlador de Niños con Protección de Datos (Habeas Data)
 * Agente: Backend_DB_Dev
 * =====================================================================
 */

const { getStore } = require('../config/db');

exports.getNinos = (req, res) => {
  const store = getStore();
  const ninos = store.ninos.map(n => {
    const acudiente = store.usuarios.find(u => u.id_usuario === n.id_acudiente);
    return {
      ...n,
      nombre_acudiente: acudiente ? acudiente.nombre_completo : 'No asignado'
    };
  });
  res.json({ exito: true, datos: ninos });
};

exports.getNinoById = (req, res) => {
  const id = parseInt(req.params.id);
  const store = getStore();
  const nino = store.ninos.find(n => n.id_nino === id);
  if (!nino) {
    return res.status(404).json({ exito: false, mensaje: 'Niño no encontrado' });
  }
  const acudiente = store.usuarios.find(u => u.id_usuario === n.id_acudiente);
  res.json({
    exito: true,
    datos: {
      ...nino,
      nombre_acudiente: acudiente ? acudiente.nombre_completo : 'No asignado'
    }
  });
};

exports.crearNino = (req, res) => {
  const { codigo_estudiante, nombre_o_pseudonimo, fecha_nacimiento, id_acudiente, observaciones_terapeuticas } = req.body;
  const store = getStore();

  if (!codigo_estudiante || !nombre_o_pseudonimo) {
    return res.status(400).json({ exito: false, mensaje: 'Código y seudónimo son obligatorios.' });
  }

  const nuevoNino = {
    id_nino: store.ninos.length + 1,
    codigo_estudiante,
    nombre_o_pseudonimo,
    fecha_nacimiento: fecha_nacimiento || '2021-01-01',
    id_acudiente: id_acudiente ? parseInt(id_acudiente) : null,
    observaciones_terapeuticas: observaciones_terapeuticas || '',
    activo: true,
    creado_en: new Date().toISOString()
  };

  store.ninos.push(nuevoNino);
  res.status(201).json({ exito: true, mensaje: 'Niño registrado exitosamente', datos: nuevoNino });
};
