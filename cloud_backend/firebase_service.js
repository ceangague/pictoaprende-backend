/**
 * =====================================================================
 * PROYECTO CAIMIUP - SERVICIO DE CLOUD Y FIRESTORE (RBAC 4 ROLES)
 * Arquitectura Híbrida: Sincronización Edge IoT (RPi) + Web Dashboard
 * Agente: Backend_Cloud_Dev
 * =====================================================================
 */

const fs = require('fs');
const path = require('path');

// Base de datos de prueba pre-poblada con datos iniciales de Firestore
const initialFirestoreDB = {
  usuarios: [
    { uid: 'usr_admin_01', email: 'admipictoaprende@gmail.com', password: 'AdmiPictoaprende2026', nombre_completo: 'Administrador PictoAprende', role: 'admin', activo: true, creado_en: '2026-09-01T08:00:00Z' }
  ],
  ninos: [],
  pictogramas_catalogo: [
    { id_pictograma: 'pic_01', nombre: 'Agua', categoria: 'NECESIDAD', nivel: 1, boton_asociado: 'P1', url_imagen: '/assets/pictograms/agua.svg', hash_version: 'v1.0', audio_texto: 'Agua. Quiero agua fresca.', activo: true },
    { id_pictograma: 'pic_02', nombre: 'Comida', categoria: 'NECESIDAD', nivel: 1, boton_asociado: 'P2', url_imagen: '/assets/pictograms/comida.svg', hash_version: 'v1.0', audio_texto: 'Comida. Hora de comer.', activo: true },
    { id_pictograma: 'pic_03', nombre: 'Baño', categoria: 'NECESIDAD', nivel: 1, boton_asociado: 'P3', url_imagen: '/assets/pictograms/bano.svg', hash_version: 'v1.0', audio_texto: 'Baño. Necesito ir al baño.', activo: true },
    { id_pictograma: 'pic_04', nombre: 'Feliz', categoria: 'EMOCION', nivel: 2, boton_asociado: 'P4', url_imagen: '/assets/pictograms/feliz.svg', hash_version: 'v1.0', audio_texto: 'Feliz. Me siento contento.', activo: true },
    { id_pictograma: 'pic_05', nombre: 'Triste', categoria: 'EMOCION', nivel: 2, boton_asociado: 'P5', url_imagen: '/assets/pictograms/triste.svg', hash_version: 'v1.0', audio_texto: 'Triste. Necesito calma y apoyo.', activo: true },
    { id_pictograma: 'pic_06', nombre: 'Jugar', categoria: 'RUTINA', nivel: 3, boton_asociado: 'P6', url_imagen: '/assets/pictograms/jugar.svg', hash_version: 'v1.0', audio_texto: 'Jugar. Vamos a divertirnos.', activo: true },
    { id_pictograma: 'pic_07', nombre: 'Guardar', categoria: 'RUTINA', nivel: 3, boton_asociado: 'P7', url_imagen: '/assets/pictograms/guardar.svg', hash_version: 'v1.0', audio_texto: 'Guardar. Hora de organizar.', activo: true },
    { id_pictograma: 'pic_08', nombre: 'Descansar', categoria: 'RUTINA', nivel: 3, boton_asociado: 'P8', url_imagen: '/assets/pictograms/descansar.svg', hash_version: 'v1.0', audio_texto: 'Descansar. Momento de relajación.', activo: true }
  ],
  sesiones_hardware: [
    {
      id_sesion: 'ses_hw_101',
      id_nino: 'nin_01',
      id_docente: 'usr_docente_01',
      dispositivo_edge: 'RPI_CAIMIUP_01',
      nivel_evaluado: 1,
      fecha_inicio: '2026-10-18T09:00:00Z',
      fecha_fin: '2026-10-18T09:15:00Z',
      total_intentos: 15,
      total_aciertos: 13,
      total_errores: 2,
      observacion_docente: 'Sesión local en pantalla HDMI. Alta fijación visual con botón P1 (Agua).'
    }
  ],
  metricas_palabras: [
    { id_metrica: 'm_01', id_sesion: 'ses_hw_101', id_nino: 'nin_01', palabra: 'Agua', boton_presionado: 'P1', boton_esperado: 'P1', tiempo_reaccion_ms: 950, resultado: 'ACIERTO', timestamp: '2026-10-18T09:02:10Z' },
    { id_metrica: 'm_02', id_sesion: 'ses_hw_101', id_nino: 'nin_01', palabra: 'Agua', boton_presionado: 'P1', boton_esperado: 'P1', tiempo_reaccion_ms: 880, resultado: 'ACIERTO', timestamp: '2026-10-18T09:04:30Z' },
    { id_metrica: 'm_03', id_sesion: 'ses_hw_101', id_nino: 'nin_01', palabra: 'Comida', boton_presionado: 'P2', boton_esperado: 'P2', tiempo_reaccion_ms: 1450, resultado: 'ACIERTO', timestamp: '2026-10-18T09:07:15Z' },
    { id_metrica: 'm_04', id_sesion: 'ses_hw_101', id_nino: 'nin_01', palabra: 'Baño', boton_presionado: 'P3', boton_esperado: 'P3', tiempo_reaccion_ms: 1620, resultado: 'ACIERTO', timestamp: '2026-10-18T09:09:40Z' },
    { id_metrica: 'm_05', id_sesion: 'ses_hw_101', id_nino: 'nin_01', palabra: 'Comida', boton_presionado: 'P3', boton_esperado: 'P2', tiempo_reaccion_ms: 2900, resultado: 'ERROR', timestamp: '2026-10-18T09:11:00Z' },
    { id_metrica: 'm_06', id_sesion: 'ses_hw_101', id_nino: 'nin_01', palabra: 'Agua', boton_presionado: 'P1', boton_esperado: 'P1', tiempo_reaccion_ms: 910, resultado: 'ACIERTO', timestamp: '2026-10-18T09:13:20Z' }
  ],
  sync_control: {
    id_dispositivo: 'RPI_CAIMIUP_01',
    version_catalogo: 1,
    ultima_actualizacion: new Date().toISOString(),
    estudiante_activo_id: 'nin_01',
    nivel_activo: 1,
    comando_pendiente: 'NONE' // UPDATE_PICTOGRAMS, CHANGE_LEVEL, RESET_SESSION
  },
  eventos_caimiup: [
    {
      id_evento: 'ev_01',
      titulo: 'Taller de Estrategias TEACCH en el Hogar',
      descripcion: 'Orientaciones prácticas a padres para sincronizar las rutinas del centro con el entorno familiar.',
      tipo_evento: 'TALLER_PADRES',
      dirigido_a: 'TODOS',
      fecha_inicio: '2026-10-25T14:00:00Z',
      fecha_fin: '2026-10-25T16:00:00Z',
      lugar: 'Auditorio CAIMIUP - Unipamplona',
      estado: 'PROGRAMADO'
    },
    {
      id_evento: 'ev_02',
      titulo: 'Jornada de Integración Sensorial y Motriz',
      descripcion: 'Espacio lúdico presencial para niños y acudientes.',
      tipo_evento: 'JORNADA_LUDICA',
      dirigido_a: 'ACUDIENTES',
      fecha_inicio: '2026-10-30T09:00:00Z',
      fecha_fin: '2026-10-30T12:00:00Z',
      lugar: 'Gimnasio Terapéutico CAIMIUP',
      estado: 'PROGRAMADO'
    }
  ]
};

class FirebaseService {
  constructor() {
    this.db = initialFirestoreDB;
    this.currentUser = initialFirestoreDB.usuarios[0]; // Admin por defecto
    this.listeners = {
      sync: new Set(),
      telemetria: new Set()
    };
  }

  // --- 1. AUTENTICACIÓN Y ROLES (RBAC) ---
  login(email, role = null) {
    let user = this.db.usuarios.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user && role) {
      user = this.db.usuarios.find(u => u.role.toLowerCase() === role.toLowerCase());
    }
    if (!user) {
      user = this.db.usuarios[0]; // fallback
    }
    this.currentUser = user;
    return { exito: true, usuario: user };
  }

  getCurrentUser() {
    return this.currentUser;
  }

  cambiarRol(roleName) {
    const user = this.db.usuarios.find(u => u.role.toLowerCase() === roleName.toLowerCase());
    if (user) {
      this.currentUser = user;
      return user;
    }
    return this.currentUser;
  }

  // --- 2. GESTIÓN DE NIÑOS (PROTEGIDO POR ROL) ---
  getNinos(requestingUser = this.currentUser) {
    if (requestingUser.role === 'admin' || requestingUser.role === 'docente') {
      return this.db.ninos;
    }
    if (requestingUser.role === 'padre') {
      // Un padre solo puede ver a su hijo asignado
      return this.db.ninos.filter(n => n.id_acudiente === requestingUser.uid || n.id_nino === requestingUser.id_nino_asociado);
    }
    // Guest no tiene acceso a datos de niños (Habeas Data)
    return [];
  }

  // Docente actualiza el nivel pedagógico del niño
  actualizarNivelNino(idNino, nuevoNivel, requestingUser = this.currentUser) {
    if (requestingUser.role !== 'admin' && requestingUser.role !== 'docente') {
      throw new Error('Permiso denegado: Solo el Docente o Admin puede modificar niveles pedagógicos.');
    }
    const nino = this.db.ninos.find(n => n.id_nino === idNino);
    if (!nino) throw new Error('Estudiante no encontrado.');

    nino.nivel_actual = parseInt(nuevoNivel);

    // Sincronizar de inmediato con el hardware local (RPi)
    this.db.sync_control.nivel_activo = nino.nivel_actual;
    this.db.sync_control.comando_pendiente = 'CHANGE_LEVEL';
    this.db.sync_control.ultima_actualizacion = new Date().toISOString();
    this.notificarSync('CHANGE_LEVEL', { idNino, nuevoNivel });

    return { exito: true, nino, sync: this.db.sync_control };
  }

  // --- 3. CATÁLOGO DE PICTOGRAMAS Y ACTUALIZACIONES OTA AL HARDWARE ---
  getPictogramas(nivel = null) {
    let pictos = this.db.pictogramas_catalogo.filter(p => p.activo);
    if (nivel !== null && nivel !== undefined && nivel !== '' && !isNaN(nivel)) {
      const maxNivel = parseInt(nivel, 10);
      pictos = pictos.filter(p => p.nivel <= maxNivel);
    }
    // Ordenamiento estricto por boton_asociado (P1, P2, P3, ..., P8)
    pictos.sort((a, b) => {
      const numA = parseInt(String(a.boton_asociado).replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(String(b.boton_asociado).replace(/\D/g, ''), 10) || 0;
      return numA - numB;
    });
    return pictos;
  }

  // Admin inyecta un nuevo pictograma hacia Firebase Storage y la RPi
  inyectarNuevoPictograma(nuevoPicto, requestingUser = this.currentUser) {
    if (requestingUser.role !== 'admin') {
      throw new Error('Permiso denegado: Solo el Administrador puede inyectar nuevos pictogramas hacia el hardware físico.');
    }

    const id = 'pic_' + String(this.db.pictogramas_catalogo.length + 1).padStart(2, '0');
    const registro = {
      id_pictograma: id,
      nombre: nuevoPicto.nombre,
      categoria: nuevoPicto.categoria || 'NECESIDAD',
      nivel: parseInt(nuevoPicto.nivel) || 1,
      boton_asociado: nuevoPicto.boton_asociado || 'P1',
      url_imagen: nuevoPicto.url_imagen || `/assets/pictograms/${nuevoPicto.nombre.toLowerCase()}.svg`,
      hash_version: 'v' + (this.db.sync_control.version_catalogo + 1) + '.0',
      audio_texto: nuevoPicto.audio_texto || `${nuevoPicto.nombre}. Nuevo recurso pedagógico.`,
      activo: true
    };

    // Actualizar catálogo
    this.db.pictogramas_catalogo.push(registro);

    // Notificar al hardware Raspberry Pi
    this.db.sync_control.version_catalogo += 1;
    this.db.sync_control.comando_pendiente = 'UPDATE_PICTOGRAMS';
    this.db.sync_control.ultima_actualizacion = new Date().toISOString();
    this.notificarSync('UPDATE_PICTOGRAMS', registro);

    return { exito: true, pictograma: registro, version_catalogo: this.db.sync_control.version_catalogo };
  }

  // --- 4. TELEMETRÍA DESDE EL HARDWARE (ESP32/RPi -> FIRESTORE) ---
  registrarInteraccionHardware(data) {
    const idMetrica = 'm_' + String(this.db.metricas_palabras.length + 1).padStart(2, '0');
    const metrica = {
      id_metrica: idMetrica,
      id_sesion: data.id_sesion || 'ses_hw_101',
      id_nino: data.id_nino || 'nin_01',
      palabra: data.palabra || 'Agua',
      boton_presionado: data.boton_presionado || 'P1',
      boton_esperado: data.boton_esperado || 'P1',
      tiempo_reaccion_ms: parseInt(data.tiempo_reaccion_ms) || 1000,
      resultado: data.resultado || (data.boton_presionado === data.boton_esperado ? 'ACIERTO' : 'ERROR'),
      timestamp: new Date().toISOString()
    };

    this.db.metricas_palabras.push(metrica);

    // Actualizar resumen en sesión hardware
    const sesion = this.db.sesiones_hardware.find(s => s.id_sesion === metrica.id_sesion);
    if (sesion) {
      sesion.total_intentos = (sesion.total_intentos || 0) + 1;
      if (metrica.resultado === 'ACIERTO') sesion.total_aciertos = (sesion.total_aciertos || 0) + 1;
      else sesion.total_errores = (sesion.total_errores || 0) + 1;
    }

    this.notificarTelemetria(metrica);
    return metrica;
  }

  // --- 5. REPORTES E HISTOGRAMAS PARA PADRES Y DOCENTES ---
  obtenerMetricasAnaliticas(idNino = 'nin_01', requestingUser = this.currentUser) {
    // Verificación RBAC: Si es padre, validar que corresponda a su hijo
    if (requestingUser.role === 'padre') {
      const hijos = this.getNinos(requestingUser);
      if (!hijos.some(h => h.id_nino === idNino)) {
        throw new Error('Permiso denegado: No puede consultar las métricas de otro menor.');
      }
    } else if (requestingUser.role === 'guest') {
      throw new Error('Acceso restringido: Los invitados no tienen acceso a registros clínicos.');
    }

    const metricasNino = this.db.metricas_palabras.filter(m => m.id_nino === idNino);
    const sesionesNino = this.db.sesiones_hardware.filter(s => s.id_nino === idNino);

    // Cálculo de histogramas por palabra (duración en ms / distribución)
    const histogramaPorPalabra = {};
    const palabrasUnicas = [...new Set(metricasNino.map(m => m.palabra))];

    palabrasUnicas.forEach(palabra => {
      const registros = metricasNino.filter(m => m.palabra === palabra);
      const tiempos = registros.map(r => r.tiempo_reaccion_ms);
      const aciertos = registros.filter(r => r.resultado === 'ACIERTO').length;
      const errores = registros.filter(r => r.resultado === 'ERROR').length;
      const promedioMs = Math.round(tiempos.reduce((a, b) => a + b, 0) / tiempos.length);

      // Distribución en bins para histograma
      const bins = {
        rapido_menor_1s: registros.filter(r => r.tiempo_reaccion_ms < 1000).length,
        medio_1s_a_2s: registros.filter(r => r.tiempo_reaccion_ms >= 1000 && r.tiempo_reaccion_ms < 2000).length,
        lento_2s_a_3s: registros.filter(r => r.tiempo_reaccion_ms >= 2000 && r.tiempo_reaccion_ms < 3000).length,
        muy_lento_mayor_3s: registros.filter(r => r.tiempo_reaccion_ms >= 3000).length
      };

      histogramaPorPalabra[palabra] = {
        total_repeticiones: registros.length,
        aciertos,
        errores,
        tasa_acierto_pct: Number(((aciertos / registros.length) * 100).toFixed(1)),
        tiempo_promedio_ms: promedioMs,
        tiempo_promedio_seg: Number((promedioMs / 1000).toFixed(2)),
        distribucion_bins: bins
      };
    });

    return {
      id_nino: idNino,
      total_sesiones: sesionesNino.length,
      total_interacciones: metricasNino.length,
      histogramas: histogramaPorPalabra,
      sesiones_recientes: sesionesNino
    };
  }

  // --- 6. EVENTOS Y SINCRONIZACIÓN EN TIEMPO REAL ---
  onSync(callback) {
    this.listeners.sync.add(callback);
    return () => this.listeners.sync.delete(callback);
  }

  onTelemetria(callback) {
    this.listeners.telemetria.add(callback);
    return () => this.listeners.telemetria.delete(callback);
  }

  notificarSync(tipo, data) {
    for (const cb of this.listeners.sync) cb({ tipo, data, timestamp: Date.now() });
  }

  notificarTelemetria(metrica) {
    for (const cb of this.listeners.telemetria) cb(metrica);
  }
}

// Instancia única (Singleton)
const firebaseServiceInstance = new FirebaseService();
module.exports = firebaseServiceInstance;
