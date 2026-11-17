/**
 * =====================================================================
 * PROYECTO CAIMIUP - PERSISTENCIA Y REPOSITORIO DE DATOS
 * Fase 2 & Fase 4: Conector de Base de Datos (MySQL con Respaldo Integrado)
 * Agente: Backend_DB_Dev
 * =====================================================================
 */

let mysql = null;
try {
  mysql = require('mysql2/promise');
} catch (e) {
  // Operación autónoma en memoria (fallback)
}
const fs = require('fs');
const path = require('path');

// Configuración de conexión MySQL
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'caimiup_pictoaprende',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

let pool = null;
let useFallback = false;

// Almacén en memoria de datos precargados conforme a seed.sql
const store = {
  roles: [
    { id_rol: 1, nombre: 'ADMINISTRADOR', descripcion: 'Personal administrativo CAIMIUP' },
    { id_rol: 2, nombre: 'DOCENTE', descripcion: 'Docentes y terapeutas especializados' },
    { id_rol: 3, nombre: 'ACUDIENTE', descripcion: 'Padres de familia y tutores legales' }
  ],
  usuarios: [
    { id_usuario: 1, id_rol: 1, nombre_completo: 'Administrador PictoAprende', correo: 'admipictoaprende@gmail.com', password: 'AdmiPictoaprende2026', password_hash: 'AdmiPictoaprende2026', telefono: '', activo: true }
  ],
  ninos: [],
  pictogramas: [
    { id_pictograma: 1, codigo_arasaac: 2237, nombre: 'Agua', categoria: 'NECESIDAD', nivel: 1, boton_asociado: 'P1', tecla_asociada: 'T1', ruta_imagen: '/assets/pictograms/agua.svg', audio_refuerzo: 'Agua. Quiero agua fresca.', activo: true },
    { id_pictograma: 2, codigo_arasaac: 2463, nombre: 'Comida', categoria: 'NECESIDAD', nivel: 1, boton_asociado: 'P2', tecla_asociada: 'T2', ruta_imagen: '/assets/pictograms/comida.svg', audio_refuerzo: 'Comida. Hora de comer.', activo: true },
    { id_pictograma: 3, codigo_arasaac: 2844, nombre: 'Baño', categoria: 'NECESIDAD', nivel: 1, boton_asociado: 'P3', tecla_asociada: 'T3', ruta_imagen: '/assets/pictograms/bano.svg', audio_refuerzo: 'Baño. Necesito ir al baño.', activo: true },
    { id_pictograma: 4, codigo_arasaac: 3002, nombre: 'Feliz', categoria: 'EMOCION', nivel: 2, boton_asociado: 'P4', tecla_asociada: 'T4', ruta_imagen: '/assets/pictograms/feliz.svg', audio_refuerzo: 'Feliz. Me siento muy contento.', activo: true },
    { id_pictograma: 5, codigo_arasaac: 3005, nombre: 'Triste', categoria: 'EMOCION', nivel: 2, boton_asociado: 'P5', tecla_asociada: 'T5', ruta_imagen: '/assets/pictograms/triste.svg', audio_refuerzo: 'Triste. Necesito un abrazo.', activo: true },
    { id_pictograma: 6, codigo_arasaac: 6542, nombre: 'Jugar', categoria: 'RUTINA', nivel: 3, boton_asociado: 'P6', tecla_asociada: 'T6', ruta_imagen: '/assets/pictograms/jugar.svg', audio_refuerzo: 'Jugar. Vamos a divertirnos.', activo: true },
    { id_pictograma: 7, codigo_arasaac: 7011, nombre: 'Guardar', categoria: 'RUTINA', nivel: 3, boton_asociado: 'P7', tecla_asociada: 'T7', ruta_imagen: '/assets/pictograms/guardar.svg', audio_refuerzo: 'Guardar. Hora de ordenar los juguetes.', activo: true },
    { id_pictograma: 8, codigo_arasaac: 8120, nombre: 'Descansar', categoria: 'RUTINA', nivel: 3, boton_asociado: 'P8', tecla_asociada: 'T8', ruta_imagen: '/assets/pictograms/descansar.svg', audio_refuerzo: 'Descansar. Momento de estar en calma.', activo: true }
  ],
  sesiones: [
    { id_sesion: 1, id_nino: 1, id_docente: 2, modalidad: 'IDENTIFICACION_GUIADA', fecha_inicio: new Date(Date.now() - 86400000 * 2).toISOString(), fecha_fin: new Date(Date.now() - 86400000 * 2 + 900000).toISOString(), total_intentos: 12, total_aciertos: 10, total_errores: 2, observacion_docente: 'Excelente atención sostenida. Identificó rápidamente los pictogramas de agua y juego.' },
    { id_sesion: 2, id_nino: 1, id_docente: 2, modalidad: 'RUTINA_SECUENCIA', fecha_inicio: new Date(Date.now() - 86400000).toISOString(), fecha_fin: new Date(Date.now() - 86400000 + 1200000).toISOString(), total_intentos: 10, total_aciertos: 8, total_errores: 2, observacion_docente: 'Comprendió la transición de Guardar -> Descansar.' }
  ],
  interacciones: [
    { id_interaccion: 1, id_sesion: 1, id_pictograma: 1, tecla_pulsada: 'T1', tiempo_reaccion_ms: 1250, resultado: 'ACIERTO', timestamp_interaccion: new Date(Date.now() - 86400000 * 2).toISOString() },
    { id_interaccion: 2, id_sesion: 1, id_pictograma: 1, tecla_pulsada: 'T1', tiempo_reaccion_ms: 1100, resultado: 'ACIERTO', timestamp_interaccion: new Date(Date.now() - 86400000 * 2).toISOString() },
    { id_interaccion: 3, id_sesion: 1, id_pictograma: 2, tecla_pulsada: 'T2', tiempo_reaccion_ms: 1800, resultado: 'ACIERTO', timestamp_interaccion: new Date(Date.now() - 86400000 * 2).toISOString() },
    { id_interaccion: 4, id_sesion: 1, id_pictograma: 3, tecla_pulsada: 'T3', tiempo_reaccion_ms: 2400, resultado: 'ACIERTO', timestamp_interaccion: new Date(Date.now() - 86400000 * 2).toISOString() },
    { id_interaccion: 5, id_sesion: 1, id_pictograma: 4, tecla_pulsada: 'T4', tiempo_reaccion_ms: 1600, resultado: 'ACIERTO', timestamp_interaccion: new Date(Date.now() - 86400000 * 2).toISOString() },
    { id_interaccion: 6, id_sesion: 1, id_pictograma: 5, tecla_pulsada: 'T5', tiempo_reaccion_ms: 3200, resultado: 'ERROR', timestamp_interaccion: new Date(Date.now() - 86400000 * 2).toISOString() },
    { id_interaccion: 7, id_sesion: 1, id_pictograma: 6, tecla_pulsada: 'T6', tiempo_reaccion_ms: 950, resultado: 'ACIERTO', timestamp_interaccion: new Date(Date.now() - 86400000 * 2).toISOString() },
    { id_interaccion: 8, id_sesion: 1, id_pictograma: 6, tecla_pulsada: 'T6', tiempo_reaccion_ms: 890, resultado: 'ACIERTO', timestamp_interaccion: new Date(Date.now() - 86400000 * 2).toISOString() },
    { id_interaccion: 9, id_sesion: 1, id_pictograma: 7, tecla_pulsada: 'T7', tiempo_reaccion_ms: 2100, resultado: 'ACIERTO', timestamp_interaccion: new Date(Date.now() - 86400000 * 2).toISOString() },
    { id_interaccion: 10, id_sesion: 1, id_pictograma: 8, tecla_pulsada: 'T8', tiempo_reaccion_ms: 2900, resultado: 'ERROR', timestamp_interaccion: new Date(Date.now() - 86400000 * 2).toISOString() }
  ],
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

async function initDB() {
  if (!mysql) {
    useFallback = true;
    return;
  }
  try {
    pool = mysql.createPool(dbConfig);
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    console.log('[Backend_DB_Dev]: Conectado exitosamente al servidor MySQL (caimiup_pictoaprende)');
    useFallback = false;
  } catch (err) {
    console.warn(`[Backend_DB_Dev]: MySQL no disponible en localhost:3306 (${err.code || err.message}).`);
    console.log('[Backend_DB_Dev]: Activando repositorio de datos integrado en memoria/persistencia local.');
    useFallback = true;
  }
}

// Inicializar de inmediato
initDB();

module.exports = {
  getStore: () => store,
  isFallback: () => useFallback,
  getPool: () => pool
};
