/**
 * =====================================================================
 * PROYECTO CAIMIUP - GESTOR DE PERSISTENCIA Y BASE DE DATOS
 * Fase 2: Diseño de Esquema de Datos y Persistencia
 * Fase 4: Desarrollo de Software (Persistencia Relacional y Local)
 * Agente: Backend_DB_Dev
 * =====================================================================
 * 
 * Este módulo garantiza la persistencia continua y a prueba de reinicios
 * de los datos del sistema CAIMIUP, especialmente:
 *  1. Sesiones de aprendizaje / hardware asociadas al rol de Padres.
 *  2. Sesiones de autenticación de usuarios (login / auth sessions).
 *  3. Telemetría de pulsaciones e interacciones cognitivas.
 *  4. Comunicaciones, eventos y perfiles sincronizados.
 */

const fs = require('fs');
const path = require('path');

// Ruta del archivo principal de almacenamiento persistente
const DB_FILE_PATH = path.join(__dirname, '../../database/caimiup_db_store.json');

// Semilla inicial por defecto (espejo de schema.sql y supabase_schema.sql)
function getDefaultData() {
  const ahora = new Date();
  const hace1Dia = new Date(ahora.getTime() - 86400000).toISOString();
  const hace2Dias = new Date(ahora.getTime() - 86400000 * 2).toISOString();
  const hace3Dias = new Date(ahora.getTime() - 86400000 * 3).toISOString();

  return {
    version: '1.2.0',
    ultima_actualizacion: ahora.toISOString(),
    
    // 1. Sesiones de autenticación de usuario (Padres, Docentes, Administradores)
    sesiones_usuarios: [],

    // 2. Sesiones clínicas y pedagógicas de Hardware / Aprendizaje (Rol de Padres y Docentes)
    sesiones_hardware: [],

    // 3. Telemetría de pulsaciones e interacciones
    metricas_palabras: []
  };
}

class DBPersistence {
  constructor() {
    this.filePath = DB_FILE_PATH;
    this.data = null;
    this.isDirty = false;
    this.inicializar();
  }

  inicializar() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        this.data = JSON.parse(raw);

        // Asegurar que existan las colecciones requeridas
        if (!Array.isArray(this.data.sesiones_hardware)) this.data.sesiones_hardware = [];
        if (!Array.isArray(this.data.sesiones_usuarios)) this.data.sesiones_usuarios = [];
        if (!Array.isArray(this.data.metricas_palabras)) this.data.metricas_palabras = [];

        console.log(`[Backend_DB_Dev]: Base de datos persistente cargada desde ${path.basename(this.filePath)} (${this.data.sesiones_hardware.length} sesiones, ${this.data.sesiones_usuarios.length} sesiones de usuarios).`);
      } else {
        console.log(`[Backend_DB_Dev]: Creando archivo de base de datos persistente ${path.basename(this.filePath)} con datos semilla...`);
        this.data = getDefaultData();
        this.guardarInmediato();
      }
    } catch (err) {
      console.warn(`[Backend_DB_Dev]: Error al leer la base de datos persistente (${err.message}). Restaurando estructura por defecto.`);
      this.data = getDefaultData();
      try { this.guardarInmediato(); } catch (e) {}
    }
  }

  // Guardar en disco de forma síncrona y atómica
  guardarInmediato() {
    if (!this.data) return false;
    try {
      this.data.ultima_actualizacion = new Date().toISOString();
      const tmpPath = this.filePath + '.tmp';
      const serialized = JSON.stringify(this.data, null, 2);
      fs.writeFileSync(tmpPath, serialized, 'utf8');
      fs.renameSync(tmpPath, this.filePath);
      this.isDirty = false;
      return true;
    } catch (err) {
      try {
        // Fallback directo
        fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
        this.isDirty = false;
        return true;
      } catch (err2) {
        console.error('[Backend_DB_Dev]: Error crítico al guardar en base de datos:', err2.message);
        return false;
      }
    }
  }

  // -------------------------------------------------------------------
  // SESIONES DE USUARIO / AUTH (ROL PADRES Y DEMÁS)
  // -------------------------------------------------------------------

  registrarSesionUsuario(usuario, token, metadata = {}) {
    if (!this.data) this.inicializar();
    const roleNormalized = (usuario.role || usuario.rol || 'padre').toLowerCase();

    // Si ya existe una sesión activa para este usuario o token, actualizarla
    const index = this.data.sesiones_usuarios.findIndex(
      s => (token && s.token === token) || (s.email && s.email.toLowerCase() === (usuario.email || '').toLowerCase() && s.activo)
    );

    const sesionObj = {
      id_sesion_usuario: 'ses_usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      id_usuario: usuario.id || usuario.id_usuario || usuario.auth_user_id || 'usr_padre_01',
      auth_user_id: usuario.auth_user_id || usuario.id || 'usr_padre_01',
      email: (usuario.email || usuario.correo || '').toLowerCase(),
      nombre_completo: usuario.nombre_completo || usuario.nombre || 'Acudiente CAIMIUP',
      role: roleNormalized,
      id_nino_asociado: usuario.id_nino_asociado || null,
      token: token || ('token-caimiup-' + roleNormalized + '-' + Date.now()),
      activo: true,
      ip: metadata.ip || '127.0.0.1',
      userAgent: metadata.userAgent || 'Navegador Web CAIMIUP',
      fecha_creacion: new Date().toISOString(),
      ultima_actividad: new Date().toISOString()
    };

    if (index >= 0) {
      // Reemplazar / renovar sesión activa existente
      this.data.sesiones_usuarios[index] = {
        ...this.data.sesiones_usuarios[index],
        ...sesionObj,
        fecha_creacion: this.data.sesiones_usuarios[index].fecha_creacion || sesionObj.fecha_creacion
      };
    } else {
      this.data.sesiones_usuarios.unshift(sesionObj);
    }

    this.guardarInmediato();
    console.log(`[Backend_DB_Dev]: Sesión de usuario guardada en base de datos para "${sesionObj.email}" (Rol: ${sesionObj.role}).`);
    return sesionObj;
  }

  obtenerSesionUsuario(tokenOId, email = null) {
    if (!this.data) this.inicializar();
    if (!tokenOId && !email) return null;

    const sesion = this.data.sesiones_usuarios.find(s => {
      if (!s.activo) return false;
      if (tokenOId && (s.token === tokenOId || s.id_sesion_usuario === tokenOId || s.id_usuario === tokenOId || s.auth_user_id === tokenOId)) return true;
      if (email && s.email && s.email.toLowerCase() === email.toLowerCase()) return true;
      return false;
    });

    if (sesion) {
      // Actualizar timestamp de última actividad
      sesion.ultima_actividad = new Date().toISOString();
      this.guardarInmediato();
    }

    return sesion || null;
  }

  cerrarSesionUsuario(tokenOId, email = null) {
    if (!this.data) this.inicializar();
    let cerradas = 0;

    this.data.sesiones_usuarios.forEach(s => {
      let match = false;
      if (tokenOId && (s.token === tokenOId || s.id_sesion_usuario === tokenOId || s.id_usuario === tokenOId)) match = true;
      if (email && s.email && s.email.toLowerCase() === email.toLowerCase()) match = true;
      if (match) {
        s.activo = false;
        s.fecha_cierre = new Date().toISOString();
        cerradas++;
      }
    });

    if (cerradas > 0) {
      this.guardarInmediato();
      console.log(`[Backend_DB_Dev]: ${cerradas} sesión(es) de usuario cerrada(s) y persistida(s) en BD.`);
    }
    return cerradas > 0;
  }

  getSesionesUsuariosActivas(role = null) {
    if (!this.data) this.inicializar();
    let lista = this.data.sesiones_usuarios.filter(s => s.activo);
    if (role) {
      const r = role.toLowerCase();
      lista = lista.filter(s => (s.role || '').toLowerCase() === r);
    }
    return lista;
  }

  // -------------------------------------------------------------------
  // SESIONES DE APRENDIZAJE Y TELEMETRÍA (ROL PADRES Y NIÑOS)
  // -------------------------------------------------------------------

  guardarSesionHardware(sesion) {
    if (!this.data) this.inicializar();
    if (!sesion || !sesion.id_sesion) return null;

    const index = this.data.sesiones_hardware.findIndex(s => s.id_sesion === sesion.id_sesion);
    if (index >= 0) {
      this.data.sesiones_hardware[index] = { ...this.data.sesiones_hardware[index], ...sesion };
    } else {
      this.data.sesiones_hardware.unshift(sesion);
    }

    this.guardarInmediato();
    console.log(`[Backend_DB_Dev]: Sesión de hardware ${sesion.id_sesion} (Nivel ${sesion.nivel_evaluado || 1}) guardada en base de datos.`);
    return sesion;
  }

  obtenerSesionesHardwarePorNino(idNino) {
    if (!this.data) this.inicializar();
    if (!idNino) return [...this.data.sesiones_hardware];
    return this.data.sesiones_hardware.filter(s => s.id_nino === idNino);
  }

  obtenerTodasSesionesHardware() {
    if (!this.data) this.inicializar();
    return [...this.data.sesiones_hardware];
  }

  guardarMetricaPalabra(metrica) {
    if (!this.data) this.inicializar();
    if (!metrica) return null;

    if (!metrica.id_metrica) {
      metrica.id_metrica = this.data.metricas_palabras.length + 1;
    }
    if (!metrica.created_at) {
      metrica.created_at = new Date().toISOString();
    }

    this.data.metricas_palabras.push(metrica);

    // Actualizar sesión asociada si existe
    if (metrica.id_sesion) {
      const sesion = this.data.sesiones_hardware.find(s => s.id_sesion === metrica.id_sesion);
      if (sesion) {
        sesion.total_intentos = (sesion.total_intentos || 0) + 1;
        if (metrica.resultado === 'ACIERTO') {
          sesion.total_aciertos = (sesion.total_aciertos || 0) + 1;
        } else if (metrica.resultado === 'ERROR') {
          sesion.total_errores = (sesion.total_errores || 0) + 1;
        }
      }
    }

    this.guardarInmediato();
    return metrica;
  }

  obtenerMetricasPalabras(idNino = null) {
    if (!this.data) this.inicializar();
    if (!idNino) return [...this.data.metricas_palabras];
    return this.data.metricas_palabras.filter(m => m.id_nino === idNino);
  }

  // Obtener estado general de la BD
  getEstadisticas() {
    if (!this.data) this.inicializar();
    return {
      archivo_bd: this.filePath,
      ultima_actualizacion: this.data.ultima_actualizacion,
      total_sesiones_hardware: this.data.sesiones_hardware.length,
      total_sesiones_usuarios: this.data.sesiones_usuarios.length,
      sesiones_usuarios_activas: this.data.sesiones_usuarios.filter(s => s.activo).length,
      total_metricas: this.data.metricas_palabras.length
    };
  }
}

// Instancia única (Singleton) para todo el backend
const persistenceInstance = new DBPersistence();

module.exports = persistenceInstance;
