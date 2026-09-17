// ============================================
// PASO 3: ÓPTICA AÉREA (mejorado)
// Detecta solo bordes REALES de la tabla
// No confunde celdas con doble renglón con filas
// ============================================

const PARAMS_PASO3 = {
  UMBRAL_DENSIDAD: 4,
  DISTANCIA_MIN_V: 22,
  DISTANCIA_MIN_H: 30,
  UMBRAL_CONTINUIDAD: 0.60,
  COBERTURA_MIN_LINEA: 0.75,  // 75% del ancho/alto para ser línea real
  MARGEN_BORDE: 15
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

// Detectar líneas horizontales REALES (con cobertura alta)
function detectarLineasHorizontalesReales(grises) {
  const w = grises.width, h = grises.height;
  const data = grises.data;
  const lineas = [];

  // Para cada fila Y, contar cuántos píxeles oscuros HAY consecutivos
  for (let y = 2; y < h - 2; y++) {
    let oscuros = 0;
    let consecutivosMax = 0;
    let consecutivosActual = 0;
    
    for (let x = 0; x < w; x++) {
      if (data[y * w + x] < 100) {
        oscuros++;
        consecutivosActual++;
        if (consecutivosActual > consecutivosMax) {
          consecutivosMax = consecutivosActual;
        }
      } else {
        consecutivosActual = 0;
      }
    }

    // Una línea horizontal real tiene MUCHOS píxeles oscuros consecutivos
    const ratioConsecutivos = consecutivosMax / w;
    const ratioOscuros = oscuros / w;

    // Debe tener al menos el 60% de la fila con oscuros consecutivos
    if (ratioConsecutivos > 0.60 && ratioOscuros > 0.55) {
      lineas.push({ posicion: y, cobertura: ratioConsecutivos });
    }
  }

  // Agrupar líneas cercanas
  const agrupadas = [];
  for (const l of lineas) {
    if (agrupadas.length === 0 || l.posicion - agrupadas[agrupadas.length - 1].posicion > 3) {
      agrupadas.push(l);
    } else {
      // Promediar
      const prev = agrupadas[agrupadas.length - 1];
      prev.posicion = Math.round((prev.posicion + l.posicion) / 2);
      prev.cobertura = Math.max(prev.cobertura, l.cobertura);
    }
  }

  return agrupadas;
}

// Detectar líneas verticales REALES
function detectarLineasVerticalesReales(grises) {
  const w = grises.width, h = grises.height;
  const data = grises.data;
  const lineas = [];

  for (let x = 2; x < w - 2; x++) {
    let oscuros = 0;
    let consecutivosMax = 0;
    let consecutivosActual = 0;
    
    for (let y = 0; y < h; y++) {
      if (data[y * w + x] < 100) {
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

    if (ratioConsecutivos > 0.60 && ratioOscuros > 0.55) {
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

// Detectar valles (para filas internas)
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
  if (!window.MAR.paso2 || !window.MAR.paso2.ejecutado) {
    throw new Error('Ejecuta Paso 2 primero');
  }
  if (typeof setProgreso === 'function') setProgreso(10, 'Paso 3: Óptica...');
  const t0 = performance.now();

  const grises = window.MAR.paso2.grises;
  const w = grises.width, h = grises.height, data = grises.data;

  // 1. Detectar LÍNEAS HORIZONTALES REALES (bordes)
  const lineasHReales = detectarLineasHorizontalesReales(grises);
  console.log('📏 Líneas horizontales reales:', lineasHReales.length);

  // 2. Detectar LÍNEAS VERTICALES REALES (bordes)
  const lineasVReales = detectarLineasVerticalesReales(grises);
  console.log('📏 Líneas verticales reales:', lineasVReales.length);

  // 3. Detectar valles (para complementar)
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
  const umbralV = Math.max(PARAMS_PASO3.UMBRAL_DENSIDAD, maxV * 0.15);
  const umbralH = Math.max(PARAMS_PASO3.UMBRAL_DENSIDAD, maxH * 0.15);

  const vallesV = detectarValles3(pv, umbralV, PARAMS_PASO3.DISTANCIA_MIN_V);
  const vallesH = detectarValles3(ph, umbralH, PARAMS_PASO3.DISTANCIA_MIN_H);

  // 4. Combinar: líneas reales + valles, dando prioridad a las reales
  const verticalesFinal = new Set();
  lineasVReales.forEach(l => verticalesFinal.add(l.posicion));
  vallesV.forEach(v => {
    // Solo añadir si no está muy cerca de una línea real
    let cerca = false;
    for (const p of verticalesFinal) {
      if (Math.abs(p - v) < 8) { cerca = true; break; }
    }
    if (!cerca) verticalesFinal.add(v);
  });

  const horizontalesFinal = new Set();
  lineasHReales.forEach(l => horizontalesFinal.add(l.posicion));
  vallesH.forEach(v => {
    let cerca = false;
    for (const p of horizontalesFinal) {
      if (Math.abs(p - v) < 8) { cerca = true; break; }
    }
    if (!cerca) horizontalesFinal.add(v);
  });

  // 5. Añadir bordes superior e inferior
  horizontalesFinal.add(0);
  horizontalesFinal.add(h - 1);

  // 6. Ordenar
  const verticales = Array.from(verticalesFinal).sort((a, b) => a - b);
  const horizontales = Array.from(horizontalesFinal).sort((a, b) => a - b);

  window.MAR.paso3.verticales = verticales.map(v => ({ posicion: v, votos: 1 }));
  window.MAR.paso3.horizontales = horizontales.map(h => ({ posicion: h, votos: 1 }));
  window.MAR.paso3.tiempoMs = Math.round(performance.now() - t0);
  window.MAR.paso3.ejecutado = true;

  console.log('✅ Total: ' + verticales.length + 'V, ' + horizontales.length + 'H');

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
⚙️ Umbral: ${PARAMS_PASO3.UMBRAL_DENSIDAD}, DistV: ${PARAMS_PASO3.DISTANCIA_MIN_V}, DistH: ${PARAMS_PASO3.DISTANCIA_MIN_H}
📏 Líneas horizontales: ${p.horizontales.map(h => h.posicion).join(', ')}`;
}
