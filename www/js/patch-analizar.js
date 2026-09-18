// ==============================================
// PATCH: Integrar preprocesamiento en analizarTodo
// ==============================================

// Guardar la función original
const _analizarTodoOriginal = analizarTodo;

// Sobrescribir con la versión mejorada
analizarTodo = function() {
  if(!imagenActual) { log('⚠️ Carga imagen primero', 'alerta'); return; }
  log('═══════════════════════════════════', 'etapa');
  log('🔬 ANÁLISIS CON PREPROCESAMIENTO v10.0', 'etapa');
  log('═══════════════════════════════════', 'etapa');

  // Crear canvas oculto con la imagen original
  const canvasBase = document.createElement('canvas');
  canvasBase.width = imagenActual.width;
  canvasBase.height = imagenActual.height;
  const ctxBase = canvasBase.getContext('2d');
  ctxBase.drawImage(imagenActual, 0, 0);

  let imageData = ctxBase.getImageData(0, 0, canvasBase.width, canvasBase.height);

  // ============================================
  // FASE 1: PREPROCESAMIENTO
  // ============================================
  log('[PRE 1/3] 🔧 Analizando necesidad de filtros...', 'etapa');

  const necesitaCRR_result = necesitaCRR(imageData);
  const tieneColores_result = tieneColores(imageData);

  log(`   • Ruido detectado: ${necesitaCRR_result ? 'SÍ' : 'NO'}`, 'info');
  log(`   • Colores detectados: ${tieneColores_result ? 'SÍ' : 'NO'}`, 'info');

  // Aplicar CRR si hay ruido
  if (necesitaCRR_result) {
    log('[PRE 2/3] 🎯 Aplicando CRR (eliminar píxeles anómalos)...', 'etapa');
    imageData = aplicarCRR(imageData, 80);
    ctxBase.putImageData(imageData, 0, 0);
    log('   ✅ CRR aplicado', 'exito');
  } else {
    log('[PRE 2/3] ⏭️ CRR no necesario (imagen limpia)', 'info');
  }

  // Aplicar BS si hay colores
  if (tieneColores_result) {
    log('[PRE 3/3] 🎨 Aplicando Background Subtraction...', 'etapa');
    imageData = aplicarBS(imageData, 30);
    ctxBase.putImageData(imageData, 0, 0);
    log('   ✅ BS aplicado', 'exito');
  } else {
    log('[PRE 3/3] ⏭️ BS no necesario (sin colores)', 'info');
  }

  // Actualizar la imagen procesada globalmente
  window.imagenProcesada = canvasBase;

  log('═══════════════════════════════════', 'etapa');
  log('✅ Preprocesamiento completado', 'exito');
  log('📊 Continuando con análisis normal...', 'info');
  log('═══════════════════════════════════', 'etapa');

  // ============================================
  // Llamar al análisis original pero usando la imagen procesada
  // ============================================
  const _imagenOriginal = imagenActual;
  imagenActual = canvasBase;

  try {
    _analizarTodoOriginal();
  } finally {
    // No restaurar imagenActual para que OCR use la procesada
    // imagenActual = _imagenOriginal;
  }
};

console.log('✅ Patch de análisis v10.0 cargado');
