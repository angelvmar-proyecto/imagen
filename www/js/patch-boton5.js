// ==============================================
// PATCH v10.2: Botón 5 ejecuta A3 (no Espectro)
// ==============================================

// Sobrescribir la función ejecutarPasoIndividual
window._ejecutarPasoIndividualOriginal = ejecutarPasoIndividual;

ejecutarPasoIndividual = async function(numPaso) {
  if(!imagenActual) {
    log('⚠️ Carga una imagen primero', 'alerta');
    alert('⚠️ Primero carga una imagen');
    return;
  }

  log('═══════════════════════════════════', 'etapa');
  log('🎯 EJECUTANDO PASO ' + numPaso + ' INDIVIDUALMENTE', 'etapa');
  log('═══════════════════════════════════', 'etapa');

  try {
    switch(numPaso) {
      case 1: await ejecutarPaso1Preproc(); break;
      case 2: await ejecutarPaso2Canales(); break;
      case 3: await ejecutarPaso3Optica(); break;
      case 4: await ejecutarPaso4Ecografia(); break;
      case 5: 
        // ✅ ARREGLADO: Ejecutar A3 en lugar de Espectro
        log('🟣 PASO 5: Ejecutando A3 Ortogonalidad', 'info');
        await ejecutarPaso5A3(); 
        break;
      case 6: await ejecutarPaso6Lidar(); break;
      case 7: await ejecutarPaso7Editar(); break;
      case 8: await ejecutarPaso8Recortar(); break;
      case 9: await ejecutarPaso9OCR(); break;
      default:
        log('❌ Paso ' + numPaso + ' no implementado', 'error');
    }
  } catch(e) {
    log('❌ Error en paso ' + numPaso + ': ' + e.message, 'error');
    console.error(e);
  }
};

console.log('✅ Patch v10.2 cargado: Botón 5 ejecuta A3');
