/**
 * =====================================================================
 * PROYECTO CAIMIUP - CATÁLOGO DE PICTOGRAMAS ARASAAC
 * Fase 4: Controlador de Recursos Visuales y Mapeo Físico
 * Agente: Backend_DB_Dev & Pedagogy_PM
 * =====================================================================
 */

const { getStore } = require('../config/db');

exports.getPictogramas = (req, res) => {
  const store = getStore();
  const { categoria, nivel } = req.query;

  let resultado = store.pictogramas.filter(p => p.activo);
  if (categoria) {
    resultado = resultado.filter(p => p.categoria.toLowerCase() === categoria.toLowerCase());
  }
  if (nivel !== null && nivel !== undefined && nivel !== '' && !isNaN(nivel)) {
    const maxNivel = parseInt(nivel, 10);
    resultado = resultado.filter(p => (p.nivel || 1) <= maxNivel);
  }

  // Ordenamiento coherente por tecla / botón físico (P1/T1 a P8/T8)
  resultado.sort((a, b) => {
    const btnA = a.boton_asociado || a.tecla_asociada || '';
    const btnB = b.boton_asociado || b.tecla_asociada || '';
    const numA = parseInt(String(btnA).replace(/\D/g, ''), 10) || 0;
    const numB = parseInt(String(btnB).replace(/\D/g, ''), 10) || 0;
    return numA - numB;
  });

  res.json({
    exito: true,
    total: resultado.length,
    datos: resultado
  });
};

exports.getPictogramaPorTecla = (req, res) => {
  const tecla = req.params.tecla.toUpperCase();
  const store = getStore();
  const picto = store.pictogramas.find(p => p.tecla_asociada.toUpperCase() === tecla);

  if (!picto) {
    return res.status(404).json({ exito: false, mensaje: `No existe pictograma para la tecla ${tecla}` });
  }

  res.json({ exito: true, datos: picto });
};
