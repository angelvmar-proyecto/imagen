const PARAMS_PASO5 = {
  UMBRAL_MATIZ: 20,
  UMBRAL_SATURACION: 30,
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
  const H = hsv.H, S = hsv.S;

  const verticales = [];
  for (let x = 1; x < w-1; x++) {
    let contador = 0;
    for (let y = 0; y < h; y++) {
      const iL = y*w+(x-1), iR = y*w+(x+1);
      if (S[iL] > PARAMS_PASO5.UMBRAL_SATURACION || S[iR] > PARAMS_PASO5.UMBRAL_SATURACION) {
        let d = Math.abs(H[iL] - H[iR]);
        if (d > 128) d = 255 - d;
        if (d > PARAMS_PASO5.UMBRAL_MATIZ) contador++;
      }
    }
    if (contador / h > PARAMS_PASO5.COBERTURA_MIN) {
      verticales.push({ posicion: x, votos: 1 });
    }
  }

  const horizontales = [];
  for (let y = 1; y < h-1; y++) {
    let contador = 0;
    for (let x = 0; x < w; x++) {
      const iA = (y-1)*w+x, iB = (y+1)*w+x;
      if (S[iA] > PARAMS_PASO5.UMBRAL_SATURACION || S[iB] > PARAMS_PASO5.UMBRAL_SATURACION) {
        let d = Math.abs(H[iA] - H[iB]);
        if (d > 128) d = 255 - d;
        if (d > PARAMS_PASO5.UMBRAL_MATIZ) contador++;
      }
    }
    if (contador / w > PARAMS_PASO5.COBERTURA_MIN) {
      horizontales.push({ posicion: y, votos: 1 });
    }
  }

  window.MAR.paso5.verticales = verticales;
  window.MAR.paso5.horizontales = horizontales;
  window.MAR.paso5.tiempoMs = Math.round(performance.now() - t0);
  window.MAR.paso5.ejecutado = true;

  if (typeof dibujarLineasPaso === 'function') {
    dibujarLineasPaso(5, verticales.map(v => v.posicion), horizontales.map(h => h.posicion));
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
📊 Horizontales: ${p.horizontales.length}`;
}
