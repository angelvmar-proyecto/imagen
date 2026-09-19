// ==============================================
// PATCH v10.0.4: Zoom mantiene las líneas
// ==============================================

// Guardar referencias globales
window.lineasHGlobal = [];
window.lineasVGlobal = [];

// Guardar la función original de dibujarTodo
window._dibujarTodoOriginal = dibujarTodo;

// Sobrescribir dibujarTodo para incluir las líneas
dibujarTodo = function() {
  if (!imagenActual) return;

  // Limpiar canvas
  ctx.clearRect(0, 0, lienzo.width, lienzo.height);
  ctx.save();

  // Aplicar zoom y desplazamiento
  ctx.translate(desplazamiento.x, desplazamiento.y);
  ctx.scale(zoom, zoom);

  // Dibujar la imagen base (procesada si existe, sino original)
  const fuente = window.estadoPasos && window.estadoPasos.imagenProcesada 
    ? window.estadoPasos.imagenProcesada 
    : imagenActual;
  
  ctx.drawImage(fuente, 0, 0);

  // ============================================
  // DIBUJAR LAS LÍNEAS SI EXISTEN
  // ============================================
  ctx.lineWidth = CONFIG.ANCHO_LINEA / zoom;

  // Líneas horizontales (rojas)
  if (window.lineasHGlobal && window.lineasHGlobal.length > 0) {
    ctx.strokeStyle = '#ff0000';
    window.lineasHGlobal.forEach(y => {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(fuente.width, y);
      ctx.stroke();
    });
  }

  // Líneas verticales (azules)
  if (window.lineasVGlobal && window.lineasVGlobal.length > 0) {
    ctx.strokeStyle = '#0088ff';
    window.lineasVGlobal.forEach(x => {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, fuente.height);
      ctx.stroke();
    });
  }

  ctx.restore();

  // Actualizar etiqueta de zoom
  const zoomLabel = document.getElementById('zoomLevel');
  if (zoomLabel) zoomLabel.textContent = zoom.toFixed(1) + 'x';
};

// Sobrescribir dibujarLineasEnCanvas para que guarde las líneas globalmente
window._dibujarLineasEnCanvasOriginal = dibujarLineasEnCanvas;

dibujarLineasEnCanvas = function(lineasH, lineasV) {
  // GUARDAR las líneas globalmente
  window.lineasHGlobal = lineasH || [];
  window.lineasVGlobal = lineasV || [];

  // Actualizar estado global
  if (window.estadoPasos) {
    window.estadoPasos.lineasH = window.lineasHGlobal;
    window.estadoPasos.lineasV = window.lineasVGlobal;
  }

  // Llamar a la función original para dibujar
  window._dibujarLineasEnCanvasOriginal(lineasH, lineasV);

  log('   💾 Líneas guardadas globalmente: ' + window.lineasHGlobal.length + 'H, ' + window.lineasVGlobal.length + 'V', 'info');
};

console.log('✅ Patch v10.0.4 cargado: Zoom mantiene las líneas');
