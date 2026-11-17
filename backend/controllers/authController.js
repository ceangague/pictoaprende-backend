/**
 * =====================================================================
 * PROYECTO CAIMIUP - AUTENTICACIÓN Y GESTIÓN DE ROLES
 * Fase 4: Controlador de Usuarios y Accesos
 * Agente: Backend_DB_Dev
 * =====================================================================
 */

const { getStore } = require('../config/db');

exports.login = (req, res) => {
  const { correo, password } = req.body;
  const store = getStore();

  const usuario = store.usuarios.find(u => u.correo === correo);
  if (!usuario) {
    return res.status(401).json({ exito: false, mensaje: 'Credenciales inválidas.' });
  }

  const rol = store.roles.find(r => r.id_rol === usuario.id_rol);

  res.json({
    exito: true,
    mensaje: 'Autenticación exitosa',
    usuario: {
      id_usuario: usuario.id_usuario,
      nombre_completo: usuario.nombre_completo,
      correo: usuario.correo,
      rol: rol ? rol.nombre : 'DOCENTE',
      id_rol: usuario.id_rol
    },
    token: 'jwt-simulado-caimiup-' + usuario.id_usuario
  });
};

exports.getUsuarios = (req, res) => {
  const store = getStore();
  const listado = store.usuarios.map(u => {
    const rol = store.roles.find(r => r.id_rol === u.id_rol);
    return {
      id_usuario: u.id_usuario,
      nombre_completo: u.nombre_completo,
      correo: u.correo,
      telefono: u.telefono,
      rol: rol ? rol.nombre : 'NO_ASIGNADO',
      activo: u.activo
    };
  });
  res.json({ exito: true, datos: listado });
};

exports.getRoles = (req, res) => {
  const store = getStore();
  res.json({ exito: true, datos: store.roles });
};
