// ============================================
// PASO 3: ÓPTICA AÉREA
// Solo detecta LÍNEAS VISIBLES (50%+ cobertura)
// Siempre añade bordes superior e inferior
// ============================================

const PARAMS_PASO3 = {
  UMBRAL_DENSIDAD: 4,
  DISTANCIA_MIN_V: 22,
  DISTANCIA_MIN_H: 24,
  UMBRAL_CONTINUIDAD: 0.55,
  COBERTURA_MIN: 0.50,
  UMBRAL_OSCURIDAD: 120
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

// Detectar LÍNEAS VERTICALES visibles (cobertura 50%+)
function detectarVerticalesVisibles(grises) {
  const w = grises.width, h = grises.height;
  const data = grises.data;
  const lineas = [];

  for (let x = 2; x < w - 2; x++) {
    let oscuros = 0;
    for (let y = 0; y < h; y++) {
      // Verifica si el píxel y sus vecinos horizontales son oscuros
      const v = data[y * w + x];
      if (v < PARAMS_PASO3.UMBRAL_OSCURIDAD) {
        oscuros++;
      }
    }
    const cobertura = oscuros / h;
    
    // Solo aceptar si tiene 50%+ de cobertura vertical
    if (cobertura >= PARAMS_PASO3.COBERTURA_MIN) {
      lineas.push({ posicion: x, cobertura });
    }
  }

  // Agrupar líneas cercanas (que sean parte de la misma línea gruesa)
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

// Detectar LÍNEAS HORIZONTALES visibles (cobertura 50%+)
function detectarHorizontalesVisibles(grises) {
  const w = grises.width, h = grises.height;
  const data = grises.data;
  const lineas = [];

  for (let y = 2; y < h - 2; y++) {
    let oscuros = 0;
    for (let x = 0; x < w; x++) {
      const v = data[y * w + x];
      if (v < PARAMS_PASO3.UMBRAL_OSCURIDAD) {
        oscuros++;
      }
    }
    const cobertura = oscuros / w;
    
    // Solo aceptar si tiene 50%+ de cobertura horizontal
    if (cobertura >= PARAMS_PASO3.COBERTURA_MIN) {
      lineas.push({ posicion: y, cobertura });
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

// Eliminar líneas muy cercanas (una real + ruido)
function filtrarLineasCercanas(lineas, distanciaMin) {
  if (lineas.length === 0) return [];
  const resultado = [lineas[0]];
  for (let i = 1; i < lineas.length; i++) {
    const ultima = resultado[resultado.length - 1];
    if (lineas[i].posicion - ultima.posicion >= distanciaMin) {
      resultado.push(lineas[i]);
    } else {
      // Quedarse con la de mayor cobertura
      if (lineas[i].cobertura > ultima.cobertura) {
        resultado[resultado.length - 1] = lineas[i];
      }
    }
  }
  return resultado;
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
  const vVisibles = detectarVerticalesVisibles(grises);
  const hVisibles = detectarHorizontalesVisibles(grises);
  console.log('📏 Líneas visibles V:', vVisibles.length, 'H:', hVisibles.length);

  // 2. Filtrar líneas muy cercanas
  const vFiltradas = filtrarLineasCercanas(vVisibles, PARAMS_PASO3.DISTANCIA_MIN_V);
  const hFiltradas = filtrarLineasCercanas(hVisibles, PARAMS_PASO3.DISTANCIA_MIN_H);

  // 3. Construir lista final con bordes
  const verticales = vFiltradas.map(l => l.posicion).sort((a, b) => a - b);
  const horizontales = hFiltradas.map(l => l.posicion).sort((a, b) => a - b);

  // 4. SIEMPRE añadir bordes superior e inferior
  if (!verticales.includes(0)) verticales.unshift(0);
  if (!verticales.includes(w - 1)) verticales.push(w - 1);
  if (!horizontales.includes(0)) horizontales.unshift(0);
  if (!horizontales.includes(h - 1)) horizontales.push(h - 1);

  console.log('✅ Óptica final: ' + verticales.length + 'V, ' + horizontales.length + 'H');

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
  return `PASO 3: ÓPTICA AÉREA
⏱️ ${p.tiempoMs} ms
📊 Verticales visibles: ${p.verticales.length}
📊 Horizontales visibles: ${p.horizontales.length}
⚙️ Cobertura mín: ${PARAMS_PASO3.COBERTURA_MIN * 100}%
⚙️ Umbral oscuridad: ${PARAMS_PASO3.UMBRAL_OSCURIDAD}

📋 Verticales X: ${p.verticales.map(v => v.posicion).join(', ')}
📋 Horizontales Y: ${p.horizontales.map(h => h.posicion).join(', ')}`;
}
