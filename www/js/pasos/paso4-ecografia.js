// ============================================
// PASO 4: ECOGRAFÍA / ULTRASONIDO (v3.0 oficial)
// Cambios de brillo → refinar bordes
// ============================================

const PARAMS_PASO4 = {
  ECO_VENTANA: 3,
  ECO_UMBRAL: 25,
  ECO_UMBRAL_V: 42,
  ECO_UMBRAL_H: 38,
  UMBRAL_CONTINUIDAD: 0.55
};

window.MAR = window.MAR || {};
window.MAR.paso4 = { ejecutado: false, verticales: [], horizontales: [], tiempoMs: 0 };

async function ejecutarPaso4() {
  if (!window.MAR.paso2 || !window.MAR.paso2.ejecutado) {
    throw new Error('Ejecuta Paso 2 primero');
  }
  if (typeof setProgreso === 'function') setProgreso(10, 'Paso 4: Ecografía...');
  const t0 = performance.now();

  const grises = window.MAR.paso2.grises;
  const w = grises.width, h = grises.height, data = grises.data;

  // Calcular eco horizontal (cambios de brillo en Y)
  const ecoH = new Array(h).fill(0);
  for (let y = 0; y < h; y++) {
    let suma = 0;
    const y0 = Math.max(0, y - PARAMS_PASO4.ECO_VENTANA);
    const y1 = Math.min(h - 1, y + PARAMS_PASO4.ECO_VENTANA);
    for (let x = 0; x < w; x++) {
      let maxDif = 0;
      for (let yy = y0; yy <= y1; yy++) {
        const dif = Math.abs(data[y*w+x] - data[yy*w+x]);
        if (dif > maxDif) maxDif = dif;
      }
      suma += maxDif;
    }
    ecoH[y] = suma / w;
  }

  // Calcular eco vertical (cambios de brillo en X)
  const ecoV = new Array(w).fill(0);
  for (let x = 0; x < w; x++) {
    let suma = 0;
    const x0 = Math.max(0, x - PARAMS_PASO4.ECO_VENTANA);
    const x1 = Math.min(w - 1, x + PARAMS_PASO4.ECO_VENTANA);
    for (let y = 0; y < h; y++) {
      let maxDif = 0;
      for (let xx = x0; xx <= x1; xx++) {
        const dif = Math.abs(data[y*w+x] - data[y*w+xx]);
        if (dif > maxDif) maxDif = dif;
      }
      suma += maxDif;
    }
    ecoV[x] = suma / h;
  }

  // Detectar horizontales
  const horizontales = [];
  let ultima = -9999;
  for (let y = 1; y < h - 1; y++) {
    if (ecoH[y] > PARAMS_PASO4.ECO_UMBRAL_H && (y - ultima) >= PARAMS_PASO3.DISTANCIA_MIN_H) {
      horizontales.push(y);
      ultima = y;
    }
  }

  // Detectar verticales
  const verticales = [];
  ultima = -9999;
  for (let x = 1; x < w - 1; x++) {
    if (ecoV[x] > PARAMS_PASO4.ECO_UMBRAL_V && (x - ultima) >= PARAMS_PASO3.DISTANCIA_MIN_V) {
      verticales.push(x);
      ultima = x;
    }
  }

  console.log('✅ Ecografía v3.0: ' + verticales.length + 'V, ' + horizontales.length + 'H');

  window.MAR.paso4.verticales = verticales.map(v => ({ posicion: v, votos: 1 }));
  window.MAR.paso4.horizontales = horizontales.map(h => ({ posicion: h, votos: 1 }));
  window.MAR.paso4.tiempoMs = Math.round(performance.now() - t0);
  window.MAR.paso4.ejecutado = true;

  if (typeof dibujarLineasPaso === 'function') {
    dibujarLineasPaso(4, verticales, horizontales);
    actualizarContadores(verticales.length, horizontales.length);
  }

  if (typeof setProgreso === 'function') setProgreso(100, '¡Paso 4!');
  return window.MAR.paso4;
}

function debugPaso4() {
  const p = window.MAR.paso4;
  return `PASO 4: ECOGRAFÍA (v3.0)
⏱️ ${p.tiempoMs} ms
📊 Verticales: ${p.verticales.length}
📊 Horizontales: ${p.horizontales.length}
⚙️ Ventana eco: ±${PARAMS_PASO4.ECO_VENTANA}
⚙️ Umbral eco V: ${PARAMS_PASO4.ECO_UMBRAL_V} | H: ${PARAMS_PASO4.ECO_UMBRAL_H}`;
}
