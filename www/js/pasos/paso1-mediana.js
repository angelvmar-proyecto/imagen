// ============================================
// PASO 1: FILTRO DE MEDIANA
// Slider 0-3 mapea a ventanas 1, 3, 5, 7
// ============================================

const VENTANAS_MEDIANA = [1, 3, 5, 7];

const PARAMS_PASO1 = {
  INDICE_VENTANA: 0,       // 0 → 1 (sin filtro)
  TAMANO_VENTANA: 1
};

window.MAR = window.MAR || {};
window.MAR.paso1 = {
  ejecutado: false,
  imagenOriginal: null,
  imagenMediana: null,
  tiempoMs: 0
};

// Aplicar filtro de mediana
function aplicarMediana(imageData, tamanoVentana) {
  // Si tamanoVentana === 1 → sin filtro
  if (tamanoVentana <= 1) {
    return imageData;
  }

  const w = imageData.width;
  const h = imageData.height;
  const src = imageData.data;
  const dst = new Uint8ClampedArray(src.length);
  const radio = Math.floor(tamanoVentana / 2);

  const bufferR = new Array(tamanoVentana * tamanoVentana);
  const bufferG = new Array(tamanoVentana * tamanoVentana);
  const bufferB = new Array(tamanoVentana * tamanoVentana);

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

async function ejecutarPaso1() {
  if (typeof setProgreso === 'function') setProgreso(10, 'Paso 1: Mediana...');
  const t0 = performance.now();

  const img = document.getElementById('imgPreview');
  if (!img || !img.naturalWidth) {
    throw new Error('Carga una imagen primero');
  }

  // Usar la imagen ORIGINAL guardada (no la que está en pantalla)
  let imageData;
  if (window.MAR.imagenOriginalGuardada) {
    imageData = window.MAR.imagenOriginalGuardada;
  } else {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    window.MAR.imagenOriginalGuardada = imageData;
  }

  window.MAR.paso1.imagenOriginal = imageData;

  const ventana = PARAMS_PASO1.TAMANO_VENTANA;
  if (typeof setProgreso === 'function') setProgreso(50, `Aplicando mediana ${ventana}×${ventana}...`);

  const mediana = aplicarMediana(imageData, ventana);
  window.MAR.paso1.imagenMediana = mediana;

  const canvasMediana = document.createElement('canvas');
  canvasMediana.width = imageData.width;
  canvasMediana.height = imageData.height;
  canvasMediana.getContext('2d').putImageData(mediana, 0, 0);
  window.MAR.imagenMedianaCanvas = canvasMediana;

  window.MAR.paso1.tiempoMs = Math.round(performance.now() - t0);
  window.MAR.paso1.ejecutado = true;

  // Actualizar el preview
  document.getElementById('imgPreview').src = canvasMediana.toDataURL('image/png');

  if (typeof setProgreso === 'function') setProgreso(100, '¡Paso 1!');
  return window.MAR.paso1;
}

function debugPaso1() {
  const p = window.MAR.paso1;
  const ventana = PARAMS_PASO1.TAMANO_VENTANA;
  const nombres = { 1: 'Sin filtro', 3: 'Suave', 5: 'Medio', 7: 'Fuerte' };
  return `PASO 1: MEDIANA
⏱️ ${p.tiempoMs} ms
📊 Ventana: ${ventana}×${ventana} (${nombres[ventana]})
📊 Imagen: ${p.imagenOriginal.width} × ${p.imagenOriginal.height}`;
}
