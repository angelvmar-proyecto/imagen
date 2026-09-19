// ==============================================
// PATCH v10.0.6: Visualización de líneas POR ALGORITMO
// Cada paso muestra sus líneas en color diferente
// ==============================================

// Guardar las líneas de cada algoritmo por separado
window.lineasOpticaH = [];
window.lineasOpticaV = [];
window.lineasEcografiaH = [];
window.lineasEcografiaV = [];
window.lineasEspectroH = [];
window.lineasEspectroV = [];

// ============================================
// FUNCIÓN: DIBUJAR TODAS LAS LÍNEAS CON COLORES
// ============================================
function dibujarTodasLasLineas() {
  const fuente = window.estadoPasos.imagenProcesada || imagenActual;
  if (!fuente) return;

  // Limpiar
  lienzo.width = fuente.width;
  lienzo.height = fuente.height;
  ctx.clearRect(0, 0, lienzo.width, lienzo.height);

  // Aplicar zoom y desplazamiento
  ctx.save();
  ctx.translate(desplazamiento.x, desplazamiento.y);
  ctx.scale(zoom, zoom);

  // Dibujar imagen base
  ctx.drawImage(fuente, 0, 0);

  // ============================================
  // DIBUJAR LÍNEAS POR ALGORITMO
  // ============================================

  // PASO 3: Óptica (eco) - AMARILLO
  if (window.lineasOpticaH.length > 0) {
    ctx.strokeStyle = '#FFD700';  // Amarillo
    ctx.lineWidth = 3;
    window.lineasOpticaH.forEach(y => {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(lienzo.width, y);
      ctx.stroke();
    });
  }
  if (window.lineasOpticaV.length > 0) {
    ctx.strokeStyle = '#FFD700';  // Amarillo
    ctx.lineWidth = 3;
    window.lineasOpticaV.forEach(x => {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, lienzo.height);
      ctx.stroke();
    });
  }

  // PASO 4: Ecografía - ROJO (H) + AZUL (V)
  if (window.lineasEcografiaH.length > 0) {
    ctx.strokeStyle = '#FF0000';  // Rojo
    ctx.lineWidth = 2;
    window.lineasEcografiaH.forEach(y => {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(lienzo.width, y);
      ctx.stroke();
    });
  }
  if (window.lineasEcografiaV.length > 0) {
    ctx.strokeStyle = '#0088FF';  // Azul
    ctx.lineWidth = 2;
    window.lineasEcografiaV.forEach(x => {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, lienzo.height);
      ctx.stroke();
    });
  }

  // PASO 5: Espectro - VERDE
  if (window.lineasEspectroH.length > 0) {
    ctx.strokeStyle = '#00FF00';  // Verde
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    window.lineasEspectroH.forEach(y => {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(lienzo.width, y);
      ctx.stroke();
    });
  }
  if (window.lineasEspectroV.length > 0) {
    ctx.strokeStyle = '#00FF00';  // Verde
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    window.lineasEspectroV.forEach(x => {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, lienzo.height);
      ctx.stroke();
    });
  }
  ctx.setLineDash([]);

  // PASO 6: LIDAR (finales) - NEGRO
  if (window.lineasHGlobal.length > 0) {
    ctx.strokeStyle = '#000000';  // Negro
    ctx.lineWidth = 1;
    window.lineasHGlobal.forEach(y => {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(lienzo.width, y);
      ctx.stroke();
    });
  }
  if (window.lineasVGlobal.length > 0) {
    ctx.strokeStyle = '#000000';  // Negro
    ctx.lineWidth = 1;
    window.lineasVGlobal.forEach(x => {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, lienzo.height);
      ctx.stroke();
    });
  }

  ctx.restore();

  // Actualizar etiqueta de zoom
  const zoomLabel = document.getElementById('zoomLevel');
  if (zoomLabel) zoomLabel.textContent = zoom.toFixed(1) + 'x';
}

// ============================================
// SOBRESCRIBIR dibujarTodo PARA USAR LA NUEVA
// ============================================
dibujarTodo = function() {
  dibujarTodasLasLineas();
};

// ============================================
// SOBRESCRIBIR dibujarLineasEnCanvas
// ============================================
window._dibujarLineasEnCanvasOriginal = dibujarLineasEnCanvas;

dibujarLineasEnCanvas = function(lineasH, lineasV) {
  // Guardar las líneas finales (LIDAR)
  window.lineasHGlobal = lineasH || [];
  window.lineasVGlobal = lineasV || [];

  // Actualizar estado global
  if (window.estadoPasos) {
    window.estadoPasos.lineasH = window.lineasHGlobal;
    window.estadoPasos.lineasV = window.lineasVGlobal;
  }

  // Redibujar TODO con la nueva función
  dibujarTodasLasLineas();

  log('   🎨 Líneas dibujadas: ' + window.lineasHGlobal.length + 'H, ' + window.lineasVGlobal.length + 'V', 'info');
  log('   🟡 Amarillo = Óptica | 🔴 Rojo = Ecografía H | 🔵 Azul = Ecografía V | ⚫ Negro = LIDAR', 'info');
};

console.log('✅ Patch v10.0.6 cargado: Visualización por colores');
