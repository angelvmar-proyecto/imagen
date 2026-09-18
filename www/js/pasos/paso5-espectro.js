// ============================================
// PASO 5: ESPECTRO ELECTROMAGNÉTICO (v3.0)
// Cambios de color → celdas con fondo
// ============================================

const PARAMS_PASO5 = {
  UMBRAL_MATIZ: 20,
  UMBRAL_SATURACION: 30,
  ACTIVO: true,
  DISTANCIA_MIN_V: 22,
  DISTANCIA_MIN_H: 24
};

window.MAR = window.MAR || {};
window.MAR.paso5 = { ejecutado: false, verticales: [], horizontales: [], tiempoMs: 0 };

async function ejecutarPaso5() {
  if (!window.MAR.paso2 || !window.MAR.paso2.ejecutado) {
    throw new Error('Ejecuta Paso 2 primero');
  }
  if (!PARAMS_PASO5.ACTIVO) {
    console.log('⏭️ Espectro desactivado');
    window.MAR.paso5.ejecutado = true;
    return window.MAR.paso5;
  }

  if (typeof setProgreso === 'function') setProgreso(10, 'Paso 5: Espectro...');
  const t0 = performance.now();

  const hsv = window.MAR.paso2.hsv;
  const w = hsv.width, h = hsv.height;
  const H = hsv.H, S = hsv.S;

  // Cambios verticales
  const cambiosV = new Array(w).fill(0);
  for (let x = 1; x < w - 1; x++) {
    let suma = 0;
    for (let y = 0; y < h; y++) {
      const iL = y*w+(x-1), iR = y*w+(x+1);
      if (S[iL] > PARAMS_PASO5.UMBRAL_SATURACION || S[iR] > PARAMS_PASO5.UMBRAL_SATURACION) {
        let dH = Math.abs(H[iL] - H[iR]);
        if (dH > 128) dH = 255 - dH;
        if (dH > PARAMS_PASO5.UMBRAL_MATIZ) suma++;
      }
    }
    cambiosV[x] = suma;
  }

  // Cambios horizontales
  const cambiosH = new Array(h).fill(0);
  for (let y = 1; y < h - 1; y++) {
    let suma = 0;
    for (let x = 0; x < w; x++) {
      const iA = (y-1)*w+x, iB = (y+1)*w+x;
      if (S[iA] > PARAMS_PASO5.UMBRAL_SATURACION || S[iB] > PARAMS_PASO5.UMBRAL_SATURACION) {
        let dH = Math.abs(H[iA] - H[iB]);
        if (dH > 128) dH = 255 - dH;
        if (dH > PARAMS_PASO5.UMBRAL_MATIZ) suma++;
      }
    }
    cambiosH[y] = suma;
  }

  // Detectar picos
  const verticales = [];
  let ultima = -9999;
  for (let x = 2; x < w - 2; x++) {
    if (cambiosV[x] > cambiosV[x-1] && cambiosV[x] > cambiosV[x+1] &&
        cambiosV[x] > h * 0.3 && x - ultima >= PARAMS_PASO5.DISTANCIA_MIN_V) {
      verticales.push(x);
      ultima = x;
    }
  }

  const horizontales = [];
  ultima = -9999;
  for (let y = 2; y < h - 2; y++) {
    if (cambiosH[y] > cambiosH[y-1] && cambiosH[y] > cambiosH[y+1] &&
        cambiosH[y] > w * 0.3 && y - ultima >= PARAMS_PASO5.DISTANCIA_MIN_H) {
      horizontales.push(y);
      ultima = y;
    }
  }

  console.log('✅ Espectro v3.0: ' + verticales.length + 'V, ' + horizontales.length + 'H');

  window.MAR.paso5.verticales = verticales.map(v => ({ posicion: v, votos: 1 }));
  window.MAR.paso5.horizontales = horizontales.map(h => ({ posicion: h, votos: 1 }));
  window.MAR.paso5.tiempoMs = Math.round(performance.now() - t0);
  window.MAR.paso5.ejecutado = true;

  if (typeof dibujarLineasPaso === 'function') {
    dibujarLineasPaso(5, verticales, horizontales);
    actualizarContadores(verticales.length, horizontales.length);
  }

  if (typeof setProgreso === 'function') setProgreso(100, '¡Paso 5!');
  return window.MAR.paso5;
}

function debugPaso5() {
  const p = window.MAR.paso5;
  return `PASO 5: ESPECTRO (v3.0)
⏱️ ${p.tiempoMs} ms
📊 Verticales: ${p.verticales.length}
📊 Horizontales: ${p.horizontales.length}
⚙️ Umbral matiz: ${PARAMS_PASO5.UMBRAL_MATIZ}° | Saturación: ${PARAMS_PASO5.UMBRAL_SATURACION}%`;
}
