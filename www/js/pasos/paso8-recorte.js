// ============================================
// PASO 8: RECORTE DE CELDAS
// ============================================

window.MAR = window.MAR || {};
window.MAR.paso8 = {
  ejecutado: false,
  celdas: [],
  numFilas: 0,
  numColumnas: 0,
  tiempoMs: 0
};

async function ejecutarPaso8() {
  if (!window.MAR.paso7.ejecutado) {
    alert('⚠️ Primero ejecuta el Paso 7.');
    return null;
  }

  if (typeof setProgreso === 'function') setProgreso(10, 'Paso 8: Recortando celdas...');
  const t0 = performance.now();

  const img = document.getElementById('imgPreview');
  const verticales = window.MAR.paso7.lineasFinales.verticales.map(v => v.posicion);
  const horizontales = window.MAR.paso7.lineasFinales.horizontales.map(h => h.posicion);

  // Añadir bordes
  verticales.unshift(0);
  verticales.push(img.naturalWidth);
  horizontales.unshift(0);
  horizontales.push(img.naturalHeight);

  verticales.sort((a, b) => a - b);
  horizontales.sort((a, b) => a - b);

  const numFilas = horizontales.length - 1;
  const numColumnas = verticales.length - 1;

  if (typeof setProgreso === 'function') setProgreso(50, `Recortando ${numFilas}×${numColumnas} = ${numFilas * numColumnas} celdas...`);

  const celdas = [];
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.getContext('2d').drawImage(img, 0, 0);

  for (let i = 0; i < numFilas; i++) {
    for (let j = 0; j < numColumnas; j++) {
      const x = verticales[j];
      const y = horizontales[i];
      const w = verticales[j + 1] - x;
      const h = horizontales[i + 1] - y;

      const celdaCanvas = document.createElement('canvas');
      celdaCanvas.width = w;
      celdaCanvas.height = h;
      celdaCanvas.getContext('2d').drawImage(
        canvas,
        x, y, w, h,
        0, 0, w, h
      );

      celdas.push({
        fila: i,
        columna: j,
        x, y, width: w, height: h,
        canvas: celdaCanvas,
        dataUrl: celdaCanvas.toDataURL('image/png')
      });
    }
  }

  window.MAR.paso8.celdas = celdas;
  window.MAR.paso8.numFilas = numFilas;
  window.MAR.paso8.numColumnas = numColumnas;

  const t1 = performance.now();
  window.MAR.paso8.tiempoMs = Math.round(t1 - t0);
  window.MAR.paso8.ejecutado = true;

  if (typeof setProgreso === 'function') setProgreso(100, '¡Paso 8 completado!');
  if (typeof mostrarStatus === 'function') mostrarStatus(`✅ Paso 8: ${celdas.length} celdas recortadas`, 'success');

  actualizarEstadoBoton('paso8', true);
  return window.MAR.paso8;
}

function debugPaso8() {
  const p = window.MAR.paso8;
  if (!p.ejecutado) return '⚠️ Paso 8 no ejecutado';
  return `
═══════════════════════════════════════
PASO 8: RECORTE DE CELDAS
═══════════════════════════════════════

⏱️ TIEMPO:
   - Ejecución: ${p.tiempoMs} ms

📈 RESULTADO:
   - Filas: ${p.numFilas}
   - Columnas: ${p.numColumnas}
   - Celdas totales: ${p.celdas.length}
═══════════════════════════════════════`;
}
