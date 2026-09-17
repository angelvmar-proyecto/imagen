const VENTANAS_MEDIANA_P1 = [1, 3, 5, 7];

const PARAMS_PASO1 = {
  INDICE_VENTANA: 0,
  TAMANO_VENTANA: 1
};

window.MAR = window.MAR || {};
window.MAR.paso1 = { ejecutado: false, tiempoMs: 0 };

function aplicarMediana(imageData, tamanoVentana) {
  if (tamanoVentana <= 1) return imageData;

  const w = imageData.width, h = imageData.height;
  const src = imageData.data;
  const dst = new Uint8ClampedArray(src.length);
  const radio = Math.floor(tamanoVentana / 2);
  const tamano = tamanoVentana * tamanoVentana;
  const bR = new Array(tamano), bG = new Array(tamano), bB = new Array(tamano);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let count = 0;
      for (let dy = -radio; dy <= radio; dy++) {
        for (let dx = -radio; dx <= radio; dx++) {
          const nx = Math.min(Math.max(x + dx, 0), w - 1);
          const ny = Math.min(Math.max(y + dy, 0), h - 1);
          const idx = (ny * w + nx) * 4;
          bR[count] = src[idx];
          bG[count] = src[idx + 1];
          bB[count] = src[idx + 2];
          count++;
        }
      }
      const rO = bR.slice(0, count).sort((a, b) => a - b);
      const gO = bG.slice(0, count).sort((a, b) => a - b);
      const bO = bB.slice(0, count).sort((a, b) => a - b);
      const m = Math.floor(count / 2);
      const d = (y * w + x) * 4;
      dst[d] = rO[m]; dst[d+1] = gO[m]; dst[d+2] = bO[m]; dst[d+3] = 255;
    }
  }
  return new ImageData(dst, w, h);
}

async function ejecutarPaso1() {
  if (typeof setProgreso === 'function') setProgreso(10, 'Paso 1: Mediana...');
  const t0 = performance.now();

  if (!window.MAR.imagenOriginal) throw new Error('Carga una imagen primero');

  const ventana = PARAMS_PASO1.TAMANO_VENTANA;

  if (ventana <= 1) {
    // Sin filtro: copiar original
    window.MAR.imagenFiltrada = window.MAR.imagenOriginal;
    window.MAR.imagenFiltradaCanvas = window.MAR.imagenOriginalCanvas;
  } else {
    if (typeof setProgreso === 'function') setProgreso(50, `Aplicando mediana ${ventana}×${ventana}...`);
    const filtrada = aplicarMediana(window.MAR.imagenOriginal, ventana);
    window.MAR.imagenFiltrada = filtrada;
    
    const canvas = document.createElement('canvas');
    canvas.width = filtrada.width;
    canvas.height = filtrada.height;
    canvas.getContext('2d').putImageData(filtrada, 0, 0);
    window.MAR.imagenFiltradaCanvas = canvas;
  }

  window.MAR.paso1.tiempoMs = Math.round(performance.now() - t0);
  window.MAR.paso1.ejecutado = true;

  // Actualizar toggle Ver
  const btnFilt = document.getElementById('btnVerFiltrada');
  if (btnFilt) btnFilt.disabled = false;

  if (typeof setProgreso === 'function') setProgreso(100, '¡Paso 1!');
  return window.MAR.paso1;
}

function debugPaso1() {
  const p = window.MAR.paso1;
  const v = PARAMS_PASO1.TAMANO_VENTANA;
  const nombres = { 1: 'Sin filtro', 3: 'Suave', 5: 'Medio', 7: 'Fuerte' };
  return `PASO 1: MEDIANA
⏱️ ${p.tiempoMs} ms
📊 Ventana: ${v}×${v} (${nombres[v]})
✅ Ambas versiones listas: Original + Filtrada
🔀 Los siguientes pasos pueden elegir su fuente`;
}
