// ============================================
// PASO 3: ÓPTICA AÉREA (v3.0 oficial)
// Perfiles de densidad → líneas preliminares
// ============================================

const PARAMS_PASO3 = {
  UMBRAL_DENSIDAD: 4,
  DISTANCIA_MIN_V: 22,
  DISTANCIA_MIN_H: 24,
  UMBRAL_CONTINUIDAD: 0.55,
  UMBRAL_OSCURIDAD: 128
};

window.MAR = window.MAR || {};
window.MAR.paso3 = { ejecutado: false, verticales: [], horizontales: [], tiempoMs: 0 };

// Suavizar array
function suavizarOptica(arr, ventana) {
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

// Detectar valles (espacios vacíos = separadores)
function detectarVallesOptica(arr, umbral, distanciaMin) {
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

// Validar continuidad de línea horizontal
function validarContinuidadH(grises, y) {
  const w = grises.width;
  const data = grises.data;
  let oscuros = 0;
  for (let x = 0; x < w; x++) {
    if (data[y * w + x] < PARAMS_PASO3.UMBRAL_OSCURIDAD) oscuros++;
  }
  return oscuros / w;
}

// Validar continuidad de línea vertical
function validarContinuidadV(grises, x) {
  const w = grises.width, h = grises.height;
  const data = grises.data;
  let oscuros = 0;
  for (let y = 0; y < h; y++) {
    if (data[y * w + x] < PARAMS_PASO3.UMBRAL_OSCURIDAD) oscuros++;
  }
  return oscuros / h;
}

async function ejecutarPaso3() {
  if (!window.MAR.paso2 || !window.MAR.paso2.ejecutado) {
    throw new Error('Ejecuta Paso 2 primero');
  }
  if (typeof setProgreso === 'function') setProgreso(10, 'Paso 3: Óptica...');
  const t0 = performance.now();

  const grises = window.MAR.paso2.grises;
  const w = grises.width, h = grises.height, data = grises.data;

  // 1. Calcular perfiles de densidad
  const perfilV = new Array(w).fill(0);
  const perfilH = new Array(h).fill(0);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[y*w+x] < PARAMS_PASO3.UMBRAL_OSCURIDAD) {
        perfilV[x]++;
        perfilH[y]++;
      }
    }
  }

  // 2. Suavizar
  const pv = suavizarOptica(perfilV, 3);
  const ph = suavizarOptica(perfilH, 3);

  // 3. Detectar valles
  const maxV = Math.max(...pv), maxH = Math.max(...ph);
  const umbralV = Math.max(PARAMS_PASO3.UMBRAL_DENSIDAD, maxV * 0.25);
  const umbralH = Math.max(PARAMS_PASO3.UMBRAL_DENSIDAD, maxH * 0.25);

  const vallesV = detectarVallesOptica(pv, umbralV, PARAMS_PASO3.DISTANCIA_MIN_V);
  const vallesH = detectarVallesOptica(ph, umbralH, PARAMS_PASO3.DISTANCIA_MIN_H);

  // 4. Validar continuidad
  const verticales = vallesV.filter(x => validarContinuidadV(grises, x) >= PARAMS_PASO3.UMBRAL_CONTINUIDAD);
  const horizontales = vallesH.filter(y => validarContinuidadH(grises, y) >= PARAMS_PASO3.UMBRAL_CONTINUIDAD);

  console.log('✅ Óptica v3.0: ' + verticales.length + 'V, ' + horizontales.length + 'H');

  window.MAR.paso3.verticales = verticales.map(v => ({ posicion: v, votos: 1 }));
  window.MAR.paso3.horizontales = horizontales.map(h => ({ posicion: h, votos: 1 }));
  window.MAR.paso3.tiempoMs = Math.round(performance.now() - t0);
  window.MAR.paso3.ejecutado = true;

  if (typeof dibujarLineasPaso === 'function') {
    const img = document.getElementById('imgPreview');
    const canvas = document.getElementById('deteccionCanvas');
    if (canvas && img) {
      canvas.width = img.clientWidth;
      canvas.height = img.clientHeight;
    }
    dibujarLineasPaso(3, verticales, horizontales);
    actualizarContadores(verticales.length, horizontales.length);
  }

  if (typeof setProgreso === 'function') setProgreso(100, '¡Paso 3!');
  return window.MAR.paso3;
}

function debugPaso3() {
  const p = window.MAR.paso3;
  return `PASO 3: ÓPTICA AÉREA (v3.0)
⏱️ ${p.tiempoMs} ms
📊 Verticales: ${p.verticales.length}
📊 Horizontales: ${p.horizontales.length}
⚙️ Umbral densidad: ${PARAMS_PASO3.UMBRAL_DENSIDAD}
⚙️ Continuidad: ${PARAMS_PASO3.UMBRAL_CONTINUIDAD * 100}%
⚙️ Distancia V: ${PARAMS_PASO3.DISTANCIA_MIN_V} | H: ${PARAMS_PASO3.DISTANCIA_MIN_H}`;
}
