// ============================================
// PASO 7: EDICIÓN MANUAL (placeholder)
// ============================================

window.MAR = window.MAR || {};
window.MAR.paso7 = {
  ejecutado: false,
  lineasFinales: { verticales: [], horizontales: [] }
};

async function ejecutarPaso7() {
  // Por ahora solo copia las líneas del paso 6
  if (!window.MAR.paso6.ejecutado) {
    alert('⚠️ Primero ejecuta el Paso 6 (LIDAR).');
    return null;
  }

  window.MAR.paso7.lineasFinales = {
    verticales: [...window.MAR.paso6.verticales],
    horizontales: [...window.MAR.paso6.horizontales]
  };
  window.MAR.paso7.ejecutado = true;

  if (typeof mostrarStatus === 'function') mostrarStatus('✅ Paso 7: Líneas listas para OCR', 'success');
  actualizarEstadoBoton('paso7', true);
  return window.MAR.paso7;
}

function debugPaso7() {
  const p = window.MAR.paso7;
  if (!p.ejecutado) return '⚠️ Paso 7 no ejecutado';
  return `PASO 7: ${p.lineasFinales.verticales.length}V, ${p.lineasFinales.horizontales.length}H`;
}
