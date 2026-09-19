// ==============================================
// MAR Caribe v10.0.2 - Nueva analizarTodo con preprocesamiento
// Llama a analizarTodoBase() después de preprocesar
// ==============================================

function analizarTodo() {
  if(!imagenActual) { log('⚠️ Carga imagen primero', 'alerta'); return; }
  log('═══════════════════════════════════', 'etapa');
  log('🔬 ANÁLISIS v10.0.2 (Preproc + Análisis)', 'etapa');
  log('═══════════════════════════════════', 'etapa');

  // ============================================
  // FASE 1: PREPROCESAMIENTO CONSERVADOR
  // ============================================
  log('[PRE 1/2] 🔧 Analizando necesidad de filtros...', 'etapa');

  // Crear canvas con la imagen original
  const canvasBase = document.createElement('canvas');
  canvasBase.width = imagenActual.width;
  canvasBase.height = imagenActual.height;
  const ctxBase = canvasBase.getContext('2d');
  ctxBase.drawImage(imagenActual, 0, 0);

  let imageData = ctxBase.getImageData(0, 0, canvasBase.width, canvasBase.height);

  // Detectar colores
  const tieneColores_result = tieneColores(imageData);
  log('   • Colores fuertes: ' + (tieneColores_result ? 'SÍ' : 'NO'), 'info');
  log('   • CRR: DESACTIVADO (puede dañar líneas)', 'alerta');

  // Aplicar BS solo si hay muchos colores
  if (tieneColores_result) {
    log('[PRE 2/2] 🎨 Aplicando Background Subtraction...', 'etapa');
    imageData = aplicarBS(imageData, 30);
    ctxBase.putImageData(imageData, 0, 0);
    log('   ✅ BS aplicado', 'exito');
  } else {
    log('[PRE 2/2] ⏭️ Sin filtros adicionales necesarios', 'info');
  }

  log('═══════════════════════════════════', 'etapa');
  log('✅ Preprocesamiento completado', 'exito');
  log('═══════════════════════════════════', 'etapa');

  // ============================================
  // FASE 2: ANÁLISIS CON IMAGEN PROCESADA
  // ============================================
  log('📊 Ejecutando análisis base...', 'info');

  // Guardar imagen actual y reemplazar con la procesada
  const imagenGuardada = imagenActual;
  imagenActual = canvasBase;

  try {
    // Llamar a la función base
    if (typeof analizarTodoBase === 'function') {
      analizarTodoBase();
    } else {
      throw new Error('analizarTodoBase no está definida');
    }
  } finally {
    // NO restaurar para que el OCR use la imagen procesada
    // imagenActual = imagenGuardada;
    window.imagenProcesada = canvasBase;
  }
}

console.log('✅ analizarTodo v10.0.2 cargada');
