// ==============================================
// Config de detección — Ajustada para tabla densa
// ==============================================

const CONFIG_DEFAULTS = {
  CRR_ACTIVO: false,
  CRR_UMBRAL: 80,
  BS_ACTIVO: true,
  BS_TAMANIO_BLOQUE: 30,
  BS_UMBRAL_SATURACION: 0.20,

  // Óptica
  OPTICA_UMBRAL_ADAPTATIVO: 0.30,
  OPTICA_DISTANCIA_MIN_H: 15,
  OPTICA_DISTANCIA_MIN_V: 12,
  OPTICA_SUAVIZADO: 5,

  // Ecografía
  ECO_VENTANA: 3,
  ECO_UMBRAL_H: 42,
  ECO_UMBRAL_V: 42,
  ECO_CONTINUIDAD: 0.55,
  ECO_DISTANCIA_MIN_H: 22,
  ECO_DISTANCIA_MIN_V: 20,

  // A3 (subido para no detectar tanto ruido)
  A3_UMBRAL_MAGNITUD: 160,
  A3_UMBRAL_ORTOGONALIDAD: 0.80,
  A3_COBERTURA_MINIMA: 0.30,
  A3_DISTANCIA_MIN: 12,

  RANGO_AJUSTE: 2,

  // LIDAR (más estricto)
  LIDAR_VOTOS_MINIMOS: 2,
  LIDAR_ECO_ALTO: 60,
  LIDAR_ECO_BAJO: 30,
  LIDAR_AGRUPAR_DIST: 5,
  LIDAR_MARGEN_BORDE: 8,

  RETINA_GLOBAL_ACTIVO: true,
  RETINA_GLOBAL_FUERZA: 1.0,
  RETINA_GLOBAL_RADIO: 25
};

let CONFIG = JSON.parse(JSON.stringify(CONFIG_DEFAULTS));

(function cargarAjustesGuardados() {
  try {
    const guardados = localStorage.getItem('ocr_timeshare_config');
    if (guardados) {
      const ajustes = JSON.parse(guardados);
      Object.keys(ajustes).forEach(k => {
        if (CONFIG[k] !== undefined) CONFIG[k] = ajustes[k];
      });
    }
  } catch (e) {}
})();

console.log('✅ Config de detección cargada');
