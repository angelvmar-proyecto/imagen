const PARAMS_PASO3 = {
  UMBRAL_DENSIDAD: 4,
  DISTANCIA_MIN_V: 22,
  DISTANCIA_MIN_H: 24,
  UMBRAL_CONTINUIDAD: 0.55
};

window.MAR = window.MAR || {};
window.MAR.paso3 = { ejecutado: false, verticales: [], horizontales: [], tiempoMs: 0, fuente: 'original' };

function suavizar3(arr, ventana) {
  const r = new Array(arr.length);
  const mitad = Math.floor(ventana / 2);
  for (let i = 0; i < arr.length; i++) {
    let s = 0, c = 0;
    for (let j = -mitad; j <= mitad; j++) {
      const idx = i + j;
      if (idx >= 0 && idx < arr.length) { s += arr[idx]; c++; }
    }
    r[i] = s / c;
  }
  return r;
}

function detectarValles3(arr, umbral, distanciaMin) {
  const valles = [];
  for (let i = 2; i < arr.length - 2; i++) {
    if (arr[i] < umbral && arr[i] <= arr[i-1] && arr[i] <= arr[i+1] &&
        arr[i] < arr[i-2] && arr[i] < arr[i+2]) {
      if (valles.length === 0 || i - valles[valles.length-1] >= distanciaMin) {
        valles.push(i);
      } else if (arr[i] < arr[valles[valles.length-1]]) {
        valles[valles.length-1] = i;
      }
    }
  }
  return valles;
}

async function ejecutarPaso3() {
  if (!window.MAR.paso2 || !window.MAR.paso2.ejecutado) throw new Error('Ejecuta Paso 2 primero');
  if (typeof setProgreso === 'function') setProgreso(10, 'Paso 3: Óptica...');
  const t0 = performance.now();

  const fuente = (window.MAR.fuentes && window.MAR.fuentes.paso3) || 'original';
  window.MAR.paso3.fuente = fuente;

  // Usar la imagen fuente elegida
  const imgFuente = obtenerImagenFuente(3);
  const grises = rgbAGrises2(imgFuente);
  const w = grises.width, h = grises.height, data = grises.data;

  const perfilV = new Array(w).fill(0);
  const perfilH = new Array(h).fill(0);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (data[y*w+x] < 128) { perfilV[x]++; perfilH[y]++; }
  }
  const pv = suavizar3(perfilV, 3);
  const ph = suavizar3(perfilH, 3);

  const maxV = Math.max(...pv), maxH = Math.max(...ph);
  const umbralV = Math.max(PARAMS_PASO3.UMBRAL_DENSIDAD, maxV * 0.25);
  const umbralH = Math.max(PARAMS_PASO3.UMBRAL_DENSIDAD, maxH * 0.25);

  const verticales = detectarValles3(pv, umbralV, PARAMS_PASO3.DISTANCIA_MIN_V);
  const horizontales = detectarValles3(ph, umbralH, PARAMS_PASO3.DISTANCIA_MIN_H);

  window.MAR.paso3.verticales = verticales.map(v => ({ posicion: v, votos: 1 }));
  window.MAR.paso3.horizontales = horizontales.map(h => ({ posicion: h, votos: 1 }));
  window.MAR.paso3.tiempoMs = Math.round(performance.now() - t0);
  window.MAR.paso3.ejecutado = true;

  if (typeof dibujarLineasPaso === 'function') {
    dibujarLineasPaso(3, verticales, horizontales);
    actualizarContadores(verticales.length, horizontales.length);
  }

  if (typeof setProgreso === 'function') setProgreso(100, '¡Paso 3!');
  return window.MAR.paso3;
}

function debugPaso3() {
  const p = window.MAR.paso3;
  return `PASO 3: ÓPTICA AÉREA
⏱️ ${p.tiempoMs} ms
📊 Fuente: ${p.fuente === 'original' ? '⚪ Original' : '⚫ Filtrada'}
📊 Verticales: ${p.verticales.length}
📊 Horizontales: ${p.horizontales.length}
⚙️ Umbral: ${PARAMS_PASO3.UMBRAL_DENSIDAD}, DistV: ${PARAMS_PASO3.DISTANCIA_MIN_V}, DistH: ${PARAMS_PASO3.DISTANCIA_MIN_H}`;
}
