// ============================================
// PASO 1: FILTRO DE MEDIANA
// Quita manchas, polvo, ruido
// ============================================

const PARAMS_PASO1 = {
  TAMANO_VENTANA: 3,
  MODO: 'normal'
};

// Estado global compartido
window.MAR = window.MAR || {};
window.MAR.paso1 = {
  ejecutado: false,
  imagenOriginal: null,
  imagenMediana: null,
  tiempoMs: 0
};

// Aplicar filtro de mediana
function aplicarMediana(imageData, tamanoVentana) {
  const w = imageData.width;
  const h = imageData.height;
  const src = imageData.data;
  const dst = new Uint8ClampedArray(src.length);
  const radio = Math.floor(tamanoVentana / 2);
  const tamano = tamanoVentana * tamanoVentana;

  const bufferR = new Array(tamano);
  const bufferG = new Array(tamano);
  const bufferB = new Array(tamano);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let count = 0;

      for (let dy = -radio; dy <= radio; dy++) {
        for (let dx = -radio; dx <= radio; dx++) {
          const nx = Math.min(Math.max(x + dx, 0), w - 1);
          const ny = Math.min(Math.max(y + dy, 0), h - 1);
          const idx = (ny * w + nx) * 4;
          bufferR[count] = src[idx];
          bufferG[count] = src[idx + 1];
          bufferB[count] = src[idx + 2];
          count++;
        }
      }

      // Ordenar para encontrar la mediana
      const rOrd = bufferR.slice(0, count).sort((a, b) => a - b);
      const gOrd = bufferG.slice(0, count).sort((a, b) => a - b);
      const bOrd = bufferB.slice(0, count).sort((a, b) => a - b);

      const medio = Math.floor(count / 2);
      const dstIdx = (y * w + x) * 4;
      dst[dstIdx] = rOrd[medio];
      dst[dstIdx + 1] = gOrd[medio];
      dst[dstIdx + 2] = bOrd[medio];
      dst[dstIdx + 3] = 255;
    }
  }

  return new ImageData(dst, w, h);
}

// Ejecutar paso 1
async function ejecutarPaso1() {
  if (typeof setProgreso === 'function') setProgreso(10, 'Paso 1: Filtro de Mediana...');
  
  const t0 = performance.now();

  const img = document.getElementById('imgPreview');
  if (!img || !img.naturalWidth) {
    alert('📷 Carga una imagen primero.');
    return null;
  }

  // Crear canvas con la imagen original
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  window.MAR.paso1.imagenOriginal = imageData;

  if (typeof setProgreso === 'function') setProgreso(50, 'Aplicando mediana...');

  // Aplicar filtro
  const mediana = aplicarMediana(imageData, PARAMS_PASO1.TAMANO_VENTANA);
  window.MAR.paso1.imagenMediana = mediana;

  // Guardar en canvas para los siguientes pasos
  const canvasMediana = document.createElement('canvas');
  canvasMediana.width = canvas.width;
  canvasMediana.height = canvas.height;
  canvasMediana.getContext('2d').putImageData(mediana, 0, 0);
  window.MAR.imagenMedianaCanvas = canvasMediana;

  const t1 = performance.now();
  window.MAR.paso1.tiempoMs = Math.round(t1 - t0);
  window.MAR.paso1.ejecutado = true;

  // Actualizar el preview
  document.getElementById('imgPreview').src = canvasMediana.toDataURL('image/png');

  if (typeof setProgreso === 'function') setProgreso(100, '¡Paso 1 completado!');
  if (typeof mostrarStatus === 'function') mostrarStatus('✅ Paso 1: Mediana aplicada', 'success');
  
  // Actualizar botón
  actualizarEstadoBoton('paso1', true);

  return window.MAR.paso1;
}

// Obtener debug del paso 1
function debugPaso1() {
  const p = window.MAR.paso1;
  if (!p.ejecutado) return '⚠️ Paso 1 no ejecutado aún';
  
  return `
═══════════════════════════════════════
PASO 1: FILTRO DE MEDIANA
═══════════════════════════════════════

📊 ENTRADA:
   - Imagen: ${p.imagenOriginal ? p.imagenOriginal.width + ' × ' + p.imagenOriginal.height + ' px' : 'N/A'}
   - Tipo: RGB

⚙️ PARÁMETROS:
   - Tamaño ventana: ${PARAMS_PASO1.TAMANO_VENTANA}×${PARAMS_PASO1.TAMANO_VENTANA}
   - Modo: ${PARAMS_PASO1.MODO}

⏱️ TIEMPO:
   - Ejecución: ${p.tiempoMs} ms

✅ RESULTADO:
   - Imagen limpia sin ruido
   - Manchas eliminadas
   - Bordes preservados
═══════════════════════════════════════`;
}
