// ============================================
// PASO 3: ÓPTICA AÉREA (v9.8)
// Algoritmo fusionado v2.2:
// - Eco con ventana ±5
// - Umbral eco 20
// - Continuidad 70%
// - Distancia H 30
// ============================================

const PARAMS_PASO3 = {
  UMBRAL_V: 42,
  UMBRAL_H: 38,
  DISTANCIA_MIN_V: 22,
  DISTANCIA_MIN_H: 30,
  UMBRAL_CONTINUIDAD: 0.70,
  VENTANA_ECO: 5,
  UMBRAL_ECO: 20,
  BUSQUEDA_BORDE: 80
};

window.MAR = window.MAR || {};
window.MAR.paso3 = { ejecutado: false, verticales: [], horizontales: [], tiempoMs: 0 };

// Convertir imagen a matriz de brillo
function calcularBrillo(grises) {
  const w = grises.width, h = grises.height;
  const data = grises.data;
  const brillo = [];
  for (let y = 0; y < h; y++) {
    brillo[y] = new Uint8Array(w);
    for (let x = 0; x < w; x++) {
      brillo[y][x] = data[y * w + x];
    }
  }
  return brillo;
}

// Calcular eco horizontal (para detectar líneas horizontales)
function calcularEcoH(brillo, w, h, ventana) {
  const ecoH = new Float32Array(h);
  for (let y = 0; y < h; y++) {
    let sumaEco = 0;
    const vInicio = Math.max(0, y - ventana);
    const vFin = Math.min(h - 1, y + ventana);
    for (let x = 0; x < w; x++) {
      let maxDif = 0;
      for (let yy = vInicio; yy <= vFin; yy++) {
        const dif = Math.abs(brillo[y][x] - brillo[yy][x]);
        if (dif > maxDif) maxDif = dif;
      }
      sumaEco += maxDif;
    }
    ecoH[y] = sumaEco / w;
  }
  return ecoH;
}

// Calcular eco vertical (para detectar líneas verticales)
function calcularEcoV(brillo, w, h, ventana) {
  const ecoV = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    let sumaEco = 0;
    const hInicio = Math.max(0, x - ventana);
    const hFin = Math.min(w - 1, x + ventana);
    for (let y = 0; y < h; y++) {
      let maxDif = 0;
      for (let xx = hInicio; xx <= hFin; xx++) {
        const dif = Math.abs(brillo[y][x] - brillo[y][xx]);
        if (dif > maxDif) maxDif = dif;
      }
      sumaEco += maxDif;
    }
    ecoV[x] = sumaEco / h;
  }
  return ecoV;
}

// Buscar línea más cercana al borde
function buscarLineaCercaDe(lineas, posicionObjetivo, rango) {
  let mejor = null;
  let mejorDist = Infinity;
  for (const l of lineas) {
    const dist = Math.abs(l - posicionObjetivo);
    if (dist <= rango && dist < mejorDist) {
      mejorDist = dist;
      mejor = l;
    }
  }
  return mejor;
}

async function ejecutarPaso3() {
  if (!window.MAR.paso2 || !window.MAR.paso2.ejecutado) {
    throw new Error('Ejecuta Paso 2 primero');
  }
  if (typeof setProgreso === 'function') setProgreso(10, 'Paso 3: Óptica (eco v2.2)...');
  const t0 = performance.now();

  const grises = window.MAR.paso2.grises;
  const w = grises.width, h = grises.height;

  // 1. Calcular brillo
  if (typeof setProgreso === 'function') setProgreso(25, 'Calculando brillo...');
  const brillo = calcularBrillo(grises);

  // 2. Calcular eco horizontal
  if (typeof setProgreso === 'function') setProgreso(45, 'Calculando eco horizontal...');
  const ecoH = calcularEcoH(brillo, w, h, PARAMS_PASO3.VENTANA_ECO);

  // 3. Calcular eco vertical
  if (typeof setProgreso === 'function') setProgreso(65, 'Calculando eco vertical...');
  const ecoV = calcularEcoV(brillo, w, h, PARAMS_PASO3.VENTANA_ECO);

  // 4. Detectar líneas horizontales
  if (typeof setProgreso === 'function') setProgreso(75, 'Detectando horizontales...');
  const horizontales = [];
  let ultima = -9999;
  for (let y = 1; y < h - 1; y++) {
    if (ecoH[y] > PARAMS_PASO3.UMBRAL_ECO && (y - ultima) >= PARAMS_PASO3.DISTANCIA_MIN_H) {
      // Verificar continuidad
      let pixelesFuertes = 0;
      for (let x = 0; x < w; x++) {
        let maxDif = 0;
        const y0 = Math.max(0, y - 2);
        const y1 = Math.min(h - 1, y + 2);
        for (let yy = y0; yy <= y1; yy++) {
          const dif = Math.abs(brillo[y][x] - brillo[yy][x]);
          if (dif > maxDif) maxDif = dif;
        }
        if (maxDif > PARAMS_PASO3.UMBRAL_ECO * 0.5) pixelesFuertes++;
      }
      if ((pixelesFuertes / w) >= PARAMS_PASO3.UMBRAL_CONTINUIDAD) {
        horizontales.push(y);
        ultima = y;
      }
    }
  }

  // 5. Detectar líneas verticales
  if (typeof setProgreso === 'function') setProgreso(85, 'Detectando verticales...');
  const verticales = [];
  ultima = -9999;
  for (let x = 1; x < w - 1; x++) {
    if (ecoV[x] > PARAMS_PASO3.UMBRAL_ECO && (x - ultima) >= PARAMS_PASO3.DISTANCIA_MIN_V) {
      let pixelesFuertes = 0;
      for (let y = 0; y < h; y++) {
        let maxDif = 0;
        const x0 = Math.max(0, x - 2);
        const x1 = Math.min(w - 1, x + 2);
        for (let xx = x0; xx <= x1; xx++) {
          const dif = Math.abs(brillo[y][x] - brillo[y][xx]);
          if (dif > maxDif) maxDif = dif;
        }
        if (maxDif > PARAMS_PASO3.UMBRAL_ECO * 0.5) pixelesFuertes++;
      }
      if ((pixelesFuertes / h) >= PARAMS_PASO3.UMBRAL_CONTINUIDAD) {
        verticales.push(x);
        ultima = x;
      }
    }
  }

  // 6. Añadir bordes reales
  const rango = PARAMS_PASO3.BUSQUEDA_BORDE;

  // Borde izquierdo
  const bordeIzq = buscarLineaCercaDe(verticales, 0, rango);
  if (bordeIzq !== null && !verticales.some(v => Math.abs(v - bordeIzq) < 3)) {
    verticales.unshift(bordeIzq);
  } else if (verticales.length === 0 || verticales[0] > 10) {
    verticales.unshift(0);
  }

  // Borde derecho
  const bordeDer = buscarLineaCercaDe(verticales, w - 1, rango);
  if (bordeDer !== null && !verticales.some(v => Math.abs(v - bordeDer) < 3)) {
    verticales.push(bordeDer);
  } else if (verticales.length === 0 || verticales[verticales.length - 1] < w - 10) {
    verticales.push(w - 1);
  }

  // Borde superior
  const bordeSup = buscarLineaCercaDe(horizontales, 0, rango);
  if (bordeSup !== null && !horizontales.some(hh => Math.abs(hh - bordeSup) < 3)) {
    horizontales.unshift(bordeSup);
  } else if (horizontales.length === 0 || horizontales[0] > 10) {
    horizontales.unshift(0);
  }

  // Borde inferior
  const bordeInf = buscarLineaCercaDe(horizontales, h - 1, rango);
  if (bordeInf !== null && !horizontales.some(hh => Math.abs(hh - bordeInf) < 3)) {
    horizontales.push(bordeInf);
  } else if (horizontales.length === 0 || horizontales[horizontales.length - 1] < h - 10) {
    horizontales.push(h - 1);
  }

  console.log('✅ Óptica v9.8: ' + verticales.length + 'V, ' + horizontales.length + 'H');

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
  return `PASO 3: ÓPTICA AÉREA (v9.8 - Algoritmo v2.2)
⏱️ ${p.tiempoMs} ms
📊 Verticales: ${p.verticales.length}
📊 Horizontales: ${p.horizontales.length}

⚙️ PARÁMETROS v2.2:
   • UMBRAL_V: ${PARAMS_PASO3.UMBRAL_V}
   • UMBRAL_H: ${PARAMS_PASO3.UMBRAL_H}
   • Distancia mín V: ${PARAMS_PASO3.DISTANCIA_MIN_V}
   • Distancia mín H: ${PARAMS_PASO3.DISTANCIA_MIN_H}
   • Continuidad: ${PARAMS_PASO3.UMBRAL_CONTINUIDAD * 100}%
   • Ventana eco: ±${PARAMS_PASO3.VENTANA_ECO}
   • Umbral eco: ${PARAMS_PASO3.UMBRAL_ECO}

📋 Verticales X: ${p.verticales.map(v => v.posicion).join(', ')}
📋 Horizontales Y: ${p.horizontales.map(h => h.posicion).join(', ')}`;
}
