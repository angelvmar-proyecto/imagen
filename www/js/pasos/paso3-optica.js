// ============================================
// PASO 3: ÓPTICA AÉREA (v9.6)
// - Cobertura 40% (antes 50%)
// - Umbral oscuridad 150 (antes 120)
// - Búsqueda de bordes reales (primeros/últimos 25px)
// - Distancias mínimas: 22 y 24 (originales)
// ============================================

const PARAMS_PASO3 = {
  UMBRAL_DENSIDAD: 4,
  DISTANCIA_MIN_V: 22,
  DISTANCIA_MIN_H: 24,
  UMBRAL_CONTINUIDAD: 0.55,
  COBERTURA_MIN: 0.40,
  UMBRAL_OSCURIDAD: 150,
  BUSQUEDA_BORDE: 25
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

// Detectar líneas verticales visibles con cobertura mínima
function detectarVerticales(grises) {
  const w = grises.width, h = grises.height;
  const data = grises.data;
  const lineas = [];

  for (let x = 1; x < w - 1; x++) {
    let oscuros = 0;
    for (let y = 0; y < h; y++) {
      if (data[y * w + x] < PARAMS_PASO3.UMBRAL_OSCURIDAD) oscuros++;
    }
    const cobertura = oscuros / h;
    if (cobertura >= PARAMS_PASO3.COBERTURA_MIN) {
      lineas.push({ posicion: x, cobertura });
    }
  }

  // Agrupar
  const agrupadas = [];
  for (const l of lineas) {
    if (agrupadas.length === 0 || l.posicion - agrupadas[agrupadas.length - 1].posicion > 3) {
      agrupadas.push({ posicion: l.posicion, cobertura: l.cobertura });
    } else {
      const prev = agrupadas[agrupadas.length - 1];
      prev.posicion = Math.round((prev.posicion + l.posicion) / 2);
      prev.cobertura = Math.max(prev.cobertura, l.cobertura);
    }
  }
  return agrupadas;
}

// Detectar líneas horizontales visibles
function detectarHorizontales(grises) {
  const w = grises.width, h = grises.height;
  const data = grises.data;
  const lineas = [];

  for (let y = 1; y < h - 1; y++) {
    let oscuros = 0;
    for (let x = 0; x < w; x++) {
      if (data[y * w + x] < PARAMS_PASO3.UMBRAL_OSCURIDAD) oscuros++;
    }
    const cobertura = oscuros / w;
    if (cobertura >= PARAMS_PASO3.COBERTURA_MIN) {
      lineas.push({ posicion: y, cobertura });
    }
  }

  const agrupadas = [];
  for (const l of lineas) {
    if (agrupadas.length === 0 || l.posicion - agrupadas[agrupadas.length - 1].posicion > 3) {
      agrupadas.push({ posicion: l.posicion, cobertura: l.cobertura });
    } else {
      const prev = agrupadas[agrupadas.length - 1];
      prev.posicion = Math.round((prev.posicion + l.posicion) / 2);
      prev.cobertura = Math.max(prev.cobertura, l.cobertura);
    }
  }
  return agrupadas;
}

// Filtrar líneas muy cercanas
function filtrarCercanas(lineas, distanciaMin) {
  if (lineas.length === 0) return [];
  const resultado = [lineas[0]];
  for (let i = 1; i < lineas.length; i++) {
    const ultima = resultado[resultado.length - 1];
    if (lineas[i].posicion - ultima.posicion >= distanciaMin) {
      resultado.push(lineas[i]);
    } else if (lineas[i].cobertura > ultima.cobertura) {
      resultado[resultado.length - 1] = lineas[i];
    }
  }
  return resultado;
}

// Buscar línea más cercana al borde dentro de un rango
function buscarLineaCercaDe(lineas, posicionObjetivo, rango) {
  let mejor = null;
  let mejorDist = Infinity;
  for (const l of lineas) {
    const dist = Math.abs(l.posicion - posicionObjetivo);
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
  if (typeof setProgreso === 'function') setProgreso(10, 'Paso 3: Óptica...');
  const t0 = performance.now();

  const grises = window.MAR.paso2.grises;
  const w = grises.width, h = grises.height;

  // 1. Detectar líneas visibles
  const vVisibles = detectarVerticales(grises);
  const hVisibles = detectarHorizontales(grises);

  console.log('📏 Visibles V:', vVisibles.length, 'H:', hVisibles.length);

  // 2. Filtrar líneas muy cercanas entre sí
  const vFiltradas = filtrarCercanas(vVisibles, PARAMS_PASO3.DISTANCIA_MIN_V);
  const hFiltradas = filtrarCercanas(hVisibles, PARAMS_PASO3.DISTANCIA_MIN_H);

  // 3. Construir lista final
  const verticales = vFiltradas.map(l => l.posicion).sort((a, b) => a - b);
  const horizontales = hFiltradas.map(l => l.posicion).sort((a, b) => a - b);

  // 4. Buscar bordes reales antes de añadir ciego
  const rango = PARAMS_PASO3.BUSQUEDA_BORDE;

  // Borde izquierdo
  const bordeIzq = buscarLineaCercaDe(vFiltradas, 0, rango);
  if (bordeIzq && !verticales.some(v => Math.abs(v - bordeIzq.posicion) < 3)) {
    verticales.unshift(bordeIzq.posicion);
    console.log('✅ Borde izquierdo real en x=' + bordeIzq.posicion);
  } else if (verticales.length === 0 || verticales[0] > 10) {
    verticales.unshift(0);
    console.log('⚠️ Borde izquierdo ciego en x=0');
  }

  // Borde derecho
  const bordeDer = buscarLineaCercaDe(vFiltradas, w - 1, rango);
  if (bordeDer && !verticales.some(v => Math.abs(v - bordeDer.posicion) < 3)) {
    verticales.push(bordeDer.posicion);
    console.log('✅ Borde derecho real en x=' + bordeDer.posicion);
  } else if (verticales.length === 0 || verticales[verticales.length - 1] < w - 10) {
    verticales.push(w - 1);
    console.log('⚠️ Borde derecho ciego en x=' + (w - 1));
  }

  // Borde superior
  const bordeSup = buscarLineaCercaDe(hFiltradas, 0, rango);
  if (bordeSup && !horizontales.some(h => Math.abs(h - bordeSup.posicion) < 3)) {
    horizontales.unshift(bordeSup.posicion);
    console.log('✅ Borde superior real en y=' + bordeSup.posicion);
  } else if (horizontales.length === 0 || horizontales[0] > 10) {
    horizontales.unshift(0);
    console.log('⚠️ Borde superior ciego en y=0');
  }

  // Borde inferior
  const bordeInf = buscarLineaCercaDe(hFiltradas, h - 1, rango);
  if (bordeInf && !horizontales.some(hh => Math.abs(hh - bordeInf.posicion) < 3)) {
    horizontales.push(bordeInf.posicion);
    console.log('✅ Borde inferior real en y=' + bordeInf.posicion);
  } else if (horizontales.length === 0 || horizontales[horizontales.length - 1] < h - 10) {
    horizontales.push(h - 1);
    console.log('⚠️ Borde inferior ciego en y=' + (h - 1));
  }

  console.log('✅ Óptica final: ' + verticales.length + 'V, ' + horizontales.length + 'H');
  console.log('📋 Verticales: ' + verticales.join(', '));
  console.log('📋 Horizontales: ' + horizontales.join(', '));

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
  return `PASO 3: ÓPTICA AÉREA (v9.6)
⏱️ ${p.tiempoMs} ms
📊 Verticales: ${p.verticales.length}
📊 Horizontales: ${p.horizontales.length}
⚙️ Cobertura: ${PARAMS_PASO3.COBERTURA_MIN * 100}%
⚙️ Umbral oscuridad: ${PARAMS_PASO3.UMBRAL_OSCURIDAD}
⚙️ Búsqueda borde: ${PARAMS_PASO3.BUSQUEDA_BORDE}px

📋 Verticales X: ${p.verticales.map(v => v.posicion).join(', ')}
📋 Horizontales Y: ${p.horizontales.map(h => h.posicion).join(', ')}`;
}
