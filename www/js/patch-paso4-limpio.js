// ==============================================
// PATCH v10.0.9: Paso 4 limpia canvas (sin acumular)
// ==============================================

// Guardar función original
window._ejecutarPaso4Original = ejecutarPaso4Ecografia;

// Sobrescribir paso 4 para que limpie antes de dibujar
ejecutarPaso4Ecografia = async function() {
  log('🔊 PASO 4: Ecografía (Detección de líneas)', 'etapa');

  if(!window.estadoPasos.ecoH || !window.estadoPasos.ecoV) {
    log('⚠️ Primero ejecuta el paso 3 (Óptica)', 'alerta');
    alert('⚠️ Primero ejecuta el paso 3 (Óptica)');
    return;
  }

  // Usar los valles de Óptica (ya calculados)
  const lineasH = window.lineasOpticaH || [];
  const lineasV = window.lineasOpticaV || [];

  log('   📊 Ecografía usa los valles de Óptica', 'info');
  log('   ✅ Líneas H: ' + lineasH.length, 'exito');
  log('   ✅ Líneas V: ' + lineasV.length, 'exito');

  // Guardar como líneas de Ecografía
  window.lineasEcografiaH = lineasH;
  window.lineasEcografiaV = lineasV;
  window.estadoPasos.lineasH = lineasH;
  window.estadoPasos.lineasV = lineasV;
  window.estadoPasos.paso4Completado = true;

  // ============================================
  // LIMPIAR CANVAS Y DIBUJAR SOLO ECOGRAFÍA
  // ============================================
  const fuente = window.estadoPasos.imagenProcesada || imagenActual;

  lienzo.width = fuente.width;
  lienzo.height = fuente.height;
  ctx.clearRect(0, 0, lienzo.width, lienzo.height);

  ctx.save();
  ctx.translate(desplazamiento.x, desplazamiento.y);
  ctx.scale(zoom, zoom);
  ctx.drawImage(fuente, 0, 0);

  // Líneas rojas (H) y azules (V) de Ecografía
  ctx.strokeStyle = '#FF0000';
  ctx.lineWidth = 2;
  lineasH.forEach(y => {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(lienzo.width, y);
    ctx.stroke();
  });

  ctx.strokeStyle = '#0088FF';
  ctx.lineWidth = 2;
  lineasV.forEach(x => {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, lienzo.height);
    ctx.stroke();
  });

  ctx.restore();

  marcarPasoCompletado(4);
  actualizarProgreso(44);

  log('✅ PASO 4 COMPLETADO', 'exito');
  log('   🔴 Rojo = ' + lineasH.length + ' líneas H', 'info');
  log('   🔵 Azul = ' + lineasV.length + ' líneas V', 'info');
  log('   → Puedes continuar con el paso 6 (LIDAR)', 'info');
};

console.log('✅ Patch v10.0.9 cargado: Paso 4 limpia canvas');
