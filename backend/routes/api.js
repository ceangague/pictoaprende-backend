/**
 * =====================================================================
 * PROYECTO CAIMIUP - RUTAS DE LA API REST
 * Fase 4: Enrutamiento Modular del Backend
 * Agente: Backend_DB_Dev
 * =====================================================================
 */

const express = require('express');
const router = express.Router();

const authCtrl = require('../controllers/authController');
const ninosCtrl = require('../controllers/ninosController');
const pictoCtrl = require('../controllers/pictogramasController');
const sesionesCtrl = require('../controllers/sesionesController');
const eventosCtrl = require('../controllers/eventosController');
const metricasCtrl = require('../controllers/metricasController');

// 1. Autenticación y Usuarios
router.post('/auth/login', authCtrl.login);
router.get('/auth/usuarios', authCtrl.getUsuarios);
router.get('/auth/roles', authCtrl.getRoles);

// 2. Niños y Pacientes CAIMIUP
router.get('/ninos', ninosCtrl.getNinos);
router.get('/ninos/:id', ninosCtrl.getNinoById);
router.post('/ninos', ninosCtrl.crearNino);

// 3. Pictogramas ARASAAC
router.get('/pictogramas', pictoCtrl.getPictogramas);
router.get('/pictogramas/tecla/:tecla', pictoCtrl.getPictogramaPorTecla);

// 4. Sesiones Pedagógicas y Telemetría
router.get('/sesiones', sesionesCtrl.getSesiones);
router.get('/sesiones/:id', sesionesCtrl.getSesionById);
router.post('/sesiones/iniciar', sesionesCtrl.iniciarSesion);
router.put('/sesiones/:id/finalizar', sesionesCtrl.finalizarSesion);
router.post('/sesiones/interaccion', sesionesCtrl.registrarInteraccion);

// 5. Gestión de Eventos Institucionales CAIMIUP
router.get('/eventos', eventosCtrl.getEventos);
router.get('/eventos/:id', eventosCtrl.getEventoById);
router.post('/eventos', eventosCtrl.crearEvento);
router.put('/eventos/:id', eventosCtrl.actualizarEvento);
router.delete('/eventos/:id', eventosCtrl.eliminarEvento);

// 6. Métricas y Analítica Pedagógica
router.get('/metricas', metricasCtrl.getMetricasGlobales);

module.exports = router;
