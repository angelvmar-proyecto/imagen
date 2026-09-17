const PARAMS_PASO4 = {
  UMBRAL_CONTRASTE: 38,
  UMBRAL_CONTRASTE_V: 42,
  LONGITUD_MIN_BORDE: 0.15
};

window.MAR = window.MAR || {};
window.MAR.paso4 = { ejecutado: false, verticales: [], horizontales: [], tiempoMs: 0 };

async function ejecutarPaso4() {
  if (!window.MAR.paso2.ejecutado) throw new Error('Ejecuta Paso 2 primero');
  if (typeof setProgreso === 'function') setProgreso(10, 'Paso 4...');
  const t0 = performance.now();
  const grises = window.MAR.paso2.grises;
  const w = grises.width, h = grises.height, data = grises.data;

  const gradX = new Array(w).fill(0);
  for (let x = 1; x < w-1; x++) {
    let s = 0;
    for (let y = 0; y < h; y++) {
      const dif = Math.abs(data[y*w+(x+1)] - data[y*w+(x-1)]);
      if (dif > PARAMS_PASO4.UMBRAL_CONTRASTE_V) s++;
    }
    gradX[x] = s;
  }
  const gradY = new Array(h).fill(0);
  for (let y = 1; y < h-1; y++) {
    let s = 0;
    for (let x = 0; x < w; x++) {
      const dif = Math.abs(data[(y+1)*w+x] - data[(y-1)*w+x]);
      if (dif > PARAMS_PASO4.UMBRAL_CONTRASTE) s++;
    }
    gradY[y] = s;
  }

  const gx = suavizar3(gradX, 3);
  const gy = suavizar3(gradY, 3);

  const umbralX = h * PARAMS_PASO4.LONGITUD_MIN_BORDE;
  const umbralY = w * PARAMS_PASO4.LONGITUD_MIN_BORDE;

  const picos = (arr, umbral, distMin) => {
    const p = [];
    for (let i = 2; i < arr.length-2; i++) {
      if (arr[i] > umbral && arr[i] >= arr[i-1] && arr[i] >= arr[i+1]) {
        if (p.length === 0 || i - p[p.length-1] >= distMin) p.push(i);
      }
    }
    return p;
  };

  const verticales = picos(gx, umbralX, PARAMS_PASO3.DISTANCIA_MIN_V);
  const horizontales = picos(gy, umbralY, PARAMS_PASO3.DISTANCIA_MIN_H);

  window.MAR.paso4.verticales = verticales.map(v => ({ posicion: v, votos: 1 }));
  window.MAR.paso4.horizontales = horizontales.map(h => ({ posicion: h, votos: 1 }));
  window.MAR.paso4.tiempoMs = Math.round(performance.now() - t0);
  window.MAR.paso4.ejecutado = true;

  dibujarLineasPaso(4, verticales, horizontales);
  actualizarContadores(verticales.length, horizontales.length);

  if (typeof setProgreso === 'function') setProgreso(100, '¡Paso 4!');
  return window.MAR.paso4;
}

function debugPaso4() {
  const p = window.MAR.paso4;
  return `PASO 4: ECOGRAFÍA
⏱️ ${p.tiempoMs} ms
📊 Verticales: ${p.verticales.length}
📊 Horizontales: ${p.horizontales.length}
⚙️ Contraste V: ${PARAMS_PASO4.UMBRAL_CONTRASTE_V}, H: ${PARAMS_PASO4.UMBRAL_CONTRASTE}`;
}
