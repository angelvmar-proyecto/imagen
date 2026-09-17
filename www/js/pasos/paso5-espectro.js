// ============================================
// PASO 5: ESPECTRO ELECTROMAGNÉTICO
// Parámetros ORIGINALES del usuario
// Canales: H + S + V
// ============================================

const PARAMS_PASO5 = {
  UMBRAL_MATIZ: 20,
  UMBRAL_SATURACION: 30
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

  const cV = new Array(w).fill(0);
  for (let x = 1; x < w-1; x++) {
    let s = 0;
    for (let y = 0; y < h; y++) {
      const iL = y*w+(x-1), iR = y*w+(x+1);
      // Usa H + S + V
      if (S[iL] > PARAMS_PASO5.UMBRAL_SATURACION || S[iR] > PARAMS_PASO5.UMBRAL_SATURACION) {
        let dH = Math.abs(H[iL] - H[iR]);
        if (dH > 128) dH = 255 - dH;
        const dV = Math.abs(V[iL] - V[iR]);
        if (dH > PARAMS_PASO5.UMBRAL_MATIZ || dV > 30) s++;
      }
    }
    cV[x] = s;
  }
  const cH = new Array(h).fill(0);
  for (let y = 1; y < h-1; y++) {
    let s = 0;
    for (let x = 0; x < w; x++) {
      const iA = (y-1)*w+x, iB = (y+1)*w+x;
      if (S[iA] > PARAMS_PASO5.UMBRAL_SATURACION || S[iB] > PARAMS_PASO5.UMBRAL_SATURACION) {
        let dH = Math.abs(H[iA] - H[iB]);
        if (dH > 128) dH = 255 - dH;
        const dV = Math.abs(V[iA] - V[iB]);
        if (dH > PARAMS_PASO5.UMBRAL_MATIZ || dV > 30) s++;
      }
    }
    cH[y] = s;
  }

  const cvS = suavizar3(cV, 3);
  const chS = suavizar3(cH, 3);

  const picos = (arr, umbral, distMin) => {
    const p = [];
    for (let i = 2; i < arr.length-2; i++) {
      if (arr[i] > umbral && arr[i] >= arr[i-1] && arr[i] >= arr[i+1]) {
        if (p.length === 0 || i - p[p.length-1] >= distMin) p.push(i);
      }
    }
    return p;
  };

  const verticales = picos(cvS, h * 0.3, PARAMS_PASO3.DISTANCIA_MIN_V);
  const horizontales = picos(chS, w * 0.3, PARAMS_PASO3.DISTANCIA_MIN_H);

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
  return `PASO 5: ESPECTRO
⏱️ ${p.tiempoMs} ms
📊 Verticales: ${p.verticales.length}
📊 Horizontales: ${p.horizontales.length}
⚙️ Matiz: ${PARAMS_PASO5.UMBRAL_MATIZ}°, Sat: ${PARAMS_PASO5.UMBRAL_SATURACION}%`;
}
