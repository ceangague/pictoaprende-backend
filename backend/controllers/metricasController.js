/**
 * =====================================================================
 * PROYECTO CAIMIUP - MÉTRICAS Y ALGORITMOS PEDAGÓGICOS
 * Fase 2 & Fase 4: Cálculo de Índices de Interés, Dificultad y Desempeño
 * Agente: Backend_DB_Dev & Pedagogy_PM
 * =====================================================================
 */

const { getStore } = require('../config/db');

const T_MAXIMO_MS = 5000; // Constante de tiempo de reacción máximo de referencia

exports.getMetricasGlobales = (req, res) => {
  const store = getStore();
  const idNino = req.query.id_nino ? parseInt(req.query.id_nino) : null;

  // Filtrar sesiones del niño si aplica
  let sesiones = store.sesiones;
  let interacciones = store.interacciones;

  if (idNino) {
    sesiones = sesiones.filter(s => s.id_nino === idNino);
    const sesionIds = new Set(sesiones.map(s => s.id_sesion));
    interacciones = interacciones.filter(i => sesionIds.has(i.id_sesion));
  }

  const totalSesiones = sesiones.length;
  const totalIntentos = interacciones.length;
  const totalAciertos = interacciones.filter(i => i.resultado === 'ACIERTO').length;
  const totalErrores = interacciones.filter(i => i.resultado === 'ERROR').length;

  const tasaAciertos = totalIntentos > 0 ? ((totalAciertos / totalIntentos) * 100).toFixed(1) : '0.0';

  const sumaTiempoReaccion = interacciones.reduce((acc, curr) => acc + (curr.tiempo_reaccion_ms || 0), 0);
  const tiempoPromedioReaccionMs = totalIntentos > 0 ? Math.round(sumaTiempoReaccion / totalIntentos) : 0;
  const tiempoPromedioReaccionSeg = (tiempoPromedioReaccionMs / 1000).toFixed(2);

  // --- CÁLCULO DE ÍNDICE DE INTERÉS Y DIFICULTAD POR PICTOGRAMA ---
  const analisisPictogramas = store.pictogramas.map(picto => {
    const interaccionesPicto = interacciones.filter(i => i.id_pictograma === picto.id_pictograma);
    const pulsaciones = interaccionesPicto.length;
    const aciertos = interaccionesPicto.filter(i => i.resultado === 'ACIERTO').length;
    const errores = interaccionesPicto.filter(i => i.resultado === 'ERROR').length;

    // Fórmula 1: Índice de Interés (%)
    const indiceInteres = totalIntentos > 0 
      ? Number(((pulsaciones / totalIntentos) * 100).toFixed(1))
      : 0;

    // Media de tiempo de reacción para este pictograma
    const sumaTiempo = interaccionesPicto.reduce((a, b) => a + (b.tiempo_reaccion_ms || 0), 0);
    const mediaTiempoMs = pulsaciones > 0 ? Math.round(sumaTiempo / pulsaciones) : 0;

    // Fórmula 2: Índice de Dificultad (0 a 1 normalizado, ponderación 60% tasa de error, 40% latencia)
    let indiceDificultad = 0;
    if (pulsaciones > 0) {
      const componenteError = (errores / pulsaciones) * 0.6;
      const latenciaNormalizada = Math.min(mediaTiempoMs, T_MAXIMO_MS) / T_MAXIMO_MS;
      const componenteTiempo = latenciaNormalizada * 0.4;
      indiceDificultad = Number(((componenteError + componenteTiempo) * 10).toFixed(2)); // Escala de 0 a 10
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

  // Ordenar para encontrar el pictograma de mayor preferencia e interés
  const pictogramasOrdenadosPorInteres = [...analisisPictogramas].sort((a, b) => b.indice_interes_pct - a.indice_interes_pct);
  const pictogramasOrdenadosPorDificultad = [...analisisPictogramas].sort((a, b) => b.indice_dificultad - a.indice_dificultad);

  const pictogramaMayorInteres = pictogramasOrdenadosPorInteres.length > 0 ? pictogramasOrdenadosPorInteres[0] : null;
  const pictogramaMayorDificultad = pictogramasOrdenadosPorDificultad.length > 0 ? pictogramasOrdenadosPorDificultad[0] : null;

  res.json({
    exito: true,
    resumen: {
      total_sesiones: totalSesiones,
      total_intentos: totalIntentos,
      total_aciertos: totalAciertos,
      total_errores: totalErrores,
      tasa_aciertos_pct: parseFloat(tasaAciertos),
      tiempo_promedio_reaccion_ms: tiempoPromedioReaccionMs,
      tiempo_promedio_reaccion_seg: parseFloat(tiempoPromedioReaccionSeg),
      pictograma_mayor_interes: pictogramaMayorInteres,
      pictograma_mayor_dificultad: pictogramaMayorDificultad
    },
    analisis_pictogramas: analisisPictogramas,
    sesiones_recientes: sesiones.slice(-5).reverse()
  });
};
