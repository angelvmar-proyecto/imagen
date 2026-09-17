// ============================================
// PASO 5: ESPECTRO ELECTROMAGNÉTICO
// Canales: H + S + V con validación de cobertura
// ============================================

const PARAMS_PASO5 = {
  UMBRAL_MATIZ: 20,
  UMBRAL_SATURACION: 30,
  UMBRAL_VALOR: 30,
  COBERTURA_MIN: 0.50
};

window.MAR = window.MAR || {};
window.MAR.paso5 = { ejecutado: false, verticales: [], horizontales: [], tiempoMs: 0 };

async function ejecutarPaso5() {
  if (!window.MAR.paso2 || !window.MAR.paso2.ejecutado) {
    throw new Error('Ejecuta Paso 2 primero');
  }
  if (typeof setProgreso === 'function') setProgreso(10, 'Paso 5: Espectro...');
  const t0 = performance.now();

  const hsv = window.MAR.paso2.hsv;
  const w = hsv.width, h = hsv.height;
  const H = hsv.H, S = hsv.S, V = hsv.V;

  // Cambios verticales
  const cV = new Array(w).fill(0);
  for (let x = 1; x < w-1; x++) {
    let s = 0;
    for (let y = 0; y < h; y++) {
      const iL = y*w+(x-1), iR = y*w+(x+1);
      if (S[iL] > PARAMS_PASO5.UMBRAL_SATURACION || S[iR] > PARAMS_PASO5.UMBRAL_SATURACION) {
        let dH = Math.abs(H[iL] - H[iR]);
        if (dH > 128) dH = 255 - dH;
        const dV = Math.abs(V[iL] - V[iR]);
        if (dH > PARAMS_PASO5.UMBRAL_MATIZ || dV > PARAMS_PASO5.UMBRAL_VALOR) s++;
      }
    }
    cV[x] = s;
  }

  // Cambios horizontales
  const cH = new Array(h).fill(0);
  for (let y = 1; y < h-1; y++) {
    let s = 0;
    for (let x = 0; x < w; x++) {
      const iA = (y-1)*w+x, iB = (y+1)*w+x;
      if (S[iA] > PARAMS_PASO5.UMBRAL_SATURACION || S[iB] > PARAMS_PASO5.UMBRAL_SATURACION) {
        let dH = Math.abs(H[iA] - H[iB]);
        if (dH > 128) dH = 255 - dH;
        const dV = Math.abs(V[iA] - V[iB]);
        if (dH > PARAMS_PASO5.UMBRAL_MATIZ || dV > PARAMS_PASO5.UMBRAL_VALOR) s++;
      }
    }
    cH[y] = s;
  }

  const cvS = suavizar3(cV, 3);
  const chS = suavizar3(cH, 3);

  // Picos con validación de cobertura
  const picos = (arr, distMin, total) => {
    const p = [];
    for (let i = 2; i < arr.length-2; i++) {
      if (arr[i] >= arr[i-1] && arr[i] >= arr[i+1]) {
        const cobertura = arr[i] / total;
        if (cobertura >= PARAMS_PASO5.COBERTURA_MIN) {
          if (p.length === 0 || i - p[p.length-1] >= distMin) p.push(i);
        }
      }
    }
    return p;
  };

  const verticales = picos(cvS, PARAMS_PASO3.DISTANCIA_MIN_V, h);
  const horizontales = picos(chS, PARAMS_PASO3.DISTANCIA_MIN_H, w);

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
  return `PASO 5: ESPECTRO (H+S+V)
⏱️ ${p.tiempoMs} ms
📊 Verticales: ${p.verticales.length}
📊 Horizontales: ${p.horizontales.length}
⚙️ Cobertura mín: ${PARAMS_PASO5.COBERTURA_MIN * 100}%`;
}
