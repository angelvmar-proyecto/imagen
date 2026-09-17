// ============================================
// PASO 3: ÓPTICA AÉREA (v9.3)
// - Filtro de anchura mínima del valle (5px)
// - Umbral de valle 0.10
// - Detección de líneas reales (cobertura 60%)
// - Siempre añadir bordes
// - Ignora valles finos (texto centrado)
// ============================================

const PARAMS_PASO3 = {
  UMBRAL_DENSIDAD: 4,
  DISTANCIA_MIN_V: 22,
  DISTANCIA_MIN_H: 30,
  UMBRAL_VALLE: 0.10,
  ANCHURA_MIN_VALLE: 5,
  COBERTURA_MIN_LINEA: 0.60,
  UMBRAL_OSCURIDAD: 100
};

window.MAR = window.MAR || {};
window.MAR.paso3 = { ejecutado: false, verticales: [], horizontales: [], tiempoMs: 0 };

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

// Detectar valles con anchura mínima
function detectarVallesConAnchura(arr, umbral, distanciaMin, anchuraMin) {
  const valles = [];
  let i = 2;
  while (i < arr.length - 2) {
    if (arr[i] < umbral && arr[i] <= arr[i-1] && arr[i] <= arr[i+1]) {
      // Encontrar el inicio y fin del valle
      let inicio = i;
      let fin = i;
      while (inicio > 0 && arr[inicio-1] < umbral) inicio--;
      while (fin < arr.length-1 && arr[fin+1] < umbral) fin++;
      
      const anchura = fin - inicio;
      
      // Solo aceptar si la anchura es mayor al mínimo
      if (anchura >= anchuraMin) {
        // Centro del valle
        const centro = Math.round((inicio + fin) / 2);
        
        if (valles.length === 0 || centro - valles[valles.length-1] >= distanciaMin) {
          valles.push(centro);
        } else if (arr[centro] < arr[valles[valles.length-1]]) {
          valles[valles.length-1] = centro;
        }
      }
      
      i = fin + 1;
    } else {
      i++;
    }
  }
  return valles;
}

// Detectar líneas horizontales reales (con cobertura alta)
function detectarLineasHorizontalesReales(grises) {
  const w = grises.width, h = grises.height;
  const data = grises.data;
  const lineas = [];

  for (let y = 2; y < h - 2; y++) {
    let oscuros = 0;
    let consecutivosMax = 0;
    let consecutivosActual = 0;
    
    for (let x = 0; x < w; x++) {
      if (data[y * w + x] < PARAMS_PASO3.UMBRAL_OSCURIDAD) {
        oscuros++;
        consecutivosActual++;
        if (consecutivosActual > consecutivosMax) {
          consecutivosMax = consecutivosActual;
        }
      } else {
        consecutivosActual = 0;
      }
    }

    const ratioConsecutivos = consecutivosMax / w;
    const ratioOscuros = oscuros / w;

    if (ratioConsecutivos > PARAMS_PASO3.COBERTURA_MIN_LINEA && ratioOscuros > 0.55) {
      lineas.push({ posicion: y, cobertura: ratioConsecutivos });
    }
  }

  // Agrupar
  const agrupadas = [];
  for (const l of lineas) {
    if (agrupadas.length === 0 || l.posicion - agrupadas[agrupadas.length - 1].posicion > 3) {
      agrupadas.push(l);
    } else {
      const prev = agrupadas[agrupadas.length - 1];
      prev.posicion = Math.round((prev.posicion + l.posicion) / 2);
      prev.cobertura = Math.max(prev.cobertura, l.cobertura);
    }
  }

  return agrupadas;
}

// Detectar líneas verticales reales
function detectarLineasVerticalesReales(grises) {
  const w = grises.width, h = grises.height;
  const data = grises.data;
  const lineas = [];

  for (let x = 2; x < w - 2; x++) {
    let oscuros = 0;
    let consecutivosMax = 0;
    let consecutivosActual = 0;
    
    for (let y = 0; y < h; y++) {
      if (data[y * w + x] < PARAMS_PASO3.UMBRAL_OSCURIDAD) {
        oscuros++;
        consecutivosActual++;
        if (consecutivosActual > consecutivosMax) {
          consecutivosMax = consecutivosActual;
        }
      } else {
        consecutivosActual = 0;
      }
    }

    const ratioConsecutivos = consecutivosMax / h;
    const ratioOscuros = oscuros / h;

    if (ratioConsecutivos > PARAMS_PASO3.COBERTURA_MIN_LINEA && ratioOscuros > 0.55) {
      lineas.push({ posicion: x, cobertura: ratioConsecutivos });
    }
  }

  const agrupadas = [];
  for (const l of lineas) {
    if (agrupadas.length === 0 || l.posicion - agrupadas[agrupadas.length - 1].posicion > 3) {
      agrupadas.push(l);
    } else {
      const prev = agrupadas[agrupadas.length - 1];
      prev.posicion = Math.round((prev.posicion + l.posicion) / 2);
      prev.cobertura = Math.max(prev.cobertura, l.cobertura);
    }
  }

  return agrupadas;
}

async function ejecutarPaso3() {
  if (!window.MAR.paso2 || !window.MAR.paso2.ejecutado) {
    throw new Error('Ejecuta Paso 2 primero');
  }
  if (typeof setProgreso === 'function') setProgreso(10, 'Paso 3: Óptica...');
  const t0 = performance.now();

  const grises = window.MAR.paso2.grises;
  const w = grises.width, h = grises.height, data = grises.data;

  // 1. Detectar LÍNEAS REALES
  const lineasHReales = detectarLineasHorizontalesReales(grises);
  const lineasVReales = detectarLineasVerticalesReales(grises);
  console.log('📏 Líneas reales H:', lineasHReales.length, 'V:', lineasVReales.length);

  // 2. Detectar valles profundos
  const perfilV = new Array(w).fill(0);
  const perfilH = new Array(h).fill(0);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[y*w+x] < 128) { perfilV[x]++; perfilH[y]++; }
    }
  }
  const pv = suavizar3(perfilV, 3);
  const ph = suavizar3(perfilH, 3);

  const maxV = Math.max(...pv), maxH = Math.max(...ph);
  const umbralV = Math.max(PARAMS_PASO3.UMBRAL_DENSIDAD, maxV * PARAMS_PASO3.UMBRAL_VALLE);
  const umbralH = Math.max(PARAMS_PASO3.UMBRAL_DENSIDAD, maxH * PARAMS_PASO3.UMBRAL_VALLE);

  const vallesV = detectarVallesConAnchura(pv, umbralV, PARAMS_PASO3.DISTANCIA_MIN_V, PARAMS_PASO3.ANCHURA_MIN_VALLE);
  const vallesH = detectarVallesConAnchura(ph, umbralH, PARAMS_PASO3.DISTANCIA_MIN_H, PARAMS_PASO3.ANCHURA_MIN_VALLE);
  console.log('📏 Valles anchos V:', vallesV.length, 'H:', vallesH.length);

  // 3. Combinar
  const verticalesSet = new Set();
  lineasVReales.forEach(l => verticalesSet.add(l.posicion));
  vallesV.forEach(v => {
    let cerca = false;
    for (const p of verticalesSet) {
      if (Math.abs(p - v) < 6) { cerca = true; break; }
    }
    if (!cerca) verticalesSet.add(v);
  });

  const horizontalesSet = new Set();
  lineasHReales.forEach(l => horizontalesSet.add(l.posicion));
  vallesH.forEach(v => {
    let cerca = false;
    for (const p of horizontalesSet) {
      if (Math.abs(p - v) < 6) { cerca = true; break; }
    }
    if (!cerca) horizontalesSet.add(v);
  });

  // 4. SIEMPRE añadir bordes
  verticalesSet.add(0);
  verticalesSet.add(w - 1);
  horizontalesSet.add(0);
  horizontalesSet.add(h - 1);

  const verticales = Array.from(verticalesSet).sort((a, b) => a - b);
  const horizontales = Array.from(horizontalesSet).sort((a, b) => a - b);

  window.MAR.paso3.verticales = verticales.map(v => ({ posicion: v, votos: 1 }));
  window.MAR.paso3.horizontales = horizontales.map(h => ({ posicion: h, votos: 1 }));
  window.MAR.paso3.tiempoMs = Math.round(performance.now() - t0);
  window.MAR.paso3.ejecutado = true;

  console.log('✅ Total Óptica: ' + verticales.length + 'V, ' + horizontales.length + 'H');

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
  return `PASO 3: ÓPTICA AÉREA
⏱️ ${p.tiempoMs} ms
📊 Verticales: ${p.verticales.length}
📊 Horizontales: ${p.horizontales.length}
⚙️ Umbral valle: ${PARAMS_PASO3.UMBRAL_VALLE}, Anchura min: ${PARAMS_PASO3.ANCHURA_MIN_VALLE}px
📏 Horizontales Y: ${p.horizontales.map(h => h.posicion).join(', ')}`;
}
