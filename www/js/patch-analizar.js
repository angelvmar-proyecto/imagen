// ==============================================
// PATCH v10.0.1: Preprocesamiento CONSERVADOR
// CRR desactivado, BS solo con colores muy fuertes
// ==============================================

analizarTodo = function() {
  if(!imagenActual) { log('⚠️ Carga imagen primero', 'alerta'); return; }
  log('═══════════════════════════════════', 'etapa');
  log('🔬 ANÁLISIS v10.0.1 (Preproc conservador)', 'etapa');
  log('═══════════════════════════════════', 'etapa');

  // Crear canvas oculto con la imagen original
  const canvasBase = document.createElement('canvas');
  canvasBase.width = imagenActual.width;
  canvasBase.height = imagenActual.height;
  const ctxBase = canvasBase.getContext('2d');
  ctxBase.drawImage(imagenActual, 0, 0);

  let imageData = ctxBase.getImageData(0, 0, canvasBase.width, canvasBase.height);

  // ============================================
  // PREPROCESAMIENTO CONSERVADOR
  // ============================================
  log('[PRE 1/2] 🔧 Analizando...', 'etapa');

  const tieneColores_result = tieneColores(imageData);

  log(`   • Colores fuertes: ${tieneColores_result ? 'SÍ' : 'NO'}`, 'info');
  log(`   • CRR: DESACTIVADO (puede dañar líneas)`, 'alerta');

  // CRR DESACTIVADO
  log('[PRE 2/2] ⏭️ CRR desactivado', 'info');
  log('[PRE 2/2] ⏭️ BS: solo si colores > 30%', 'info');

  // BS solo si hay MUCHOS colores
  if (tieneColores_result) {
    log('[PRE 2/2] 🎨 Aplicando BS...', 'etapa');
    imageData = aplicarBS(imageData, 30);
    ctxBase.putImageData(imageData, 0, 0);
    log('   ✅ BS aplicado', 'exito');
  } else {
    log('   ⏭️ BS no necesario', 'info');
  }

  log('═══════════════════════════════════', 'etapa');
  log('✅ Preprocesamiento conservador OK', 'exito');
  log('═══════════════════════════════════', 'etapa');

  // Guardar imagen procesada
  window.imagenProcesada = canvasBase;

  // Llamar análisis original
  const _imagenOriginal = imagenActual;
  imagenActual = canvasBase;

  try {
    _analizarTodoOriginal();
  } catch(e) {
    log('❌ Error: ' + e.message, 'error');
  }
};

console.log('✅ Patch v10.0.1 cargado (CRR desactivado)');
