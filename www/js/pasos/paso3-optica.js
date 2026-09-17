// ============================================
// PASO 3: ÓPTICA AÉREA (Perfil de Intensidad)
// Detecta filas y columnas por valles de densidad
// ============================================

const PARAMS_PASO3 = {
  UMBRAL_DENSIDAD: 4,
  DISTANCIA_MIN_V: 22,
  DISTANCIA_MIN_H: 24,
  UMBRAL_CONTINUIDAD: 0.55
};

window.MAR = window.MAR || {};
window.MAR.paso3 = {
  ejecutado: false,
  verticales: [],
  horizontales: [],
  perfiles: null,
  tiempoMs: 0
};

// Suavizar array
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

// Detectar valles
function detectarValles3(arr, umbral, distanciaMin) {
  const valles = [];
  for (let i = 2; i < arr.length - 2; i++) {
    if (arr[i] < umbral &&
        arr[i] <= arr[i - 1] && arr[i] <= arr[i + 1] &&
        arr[i] < arr[i - 2] && arr[i] < arr[i + 2]) {
      if (valles.length === 0 || i - valles[valles.length - 1] >= distanciaMin) {
        valles.push(i);
      } else {
        if (arr[i] < arr[valles[valles.length - 1]]) {
          valles[valles.length - 1] = i;
        }
      }
    }
  }
  return valles;
}

async function ejecutarPaso3() {
  if (!window.MAR.paso2.ejecutado) {
    alert('⚠️ Primero ejecuta el Paso 2 (Canales).');
    return null;
  }

  if (typeof setProgreso === 'function') setProgreso(10, 'Paso 3: Óptica Aérea...');
  const t0 = performance.now();

  const grises = window.MAR.paso2.grises;
  const w = grises.width;
  const h = grises.height;
  const data = grises.data;

  if (typeof setProgreso === 'function') setProgreso(30, 'Calculando perfiles...');

  // Perfil vertical (columnas)
  const perfilV = new Array(w).fill(0);
  const perfilH = new Array(h).fill(0);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[y * w + x] < 128) {
        perfilV[x]++;
        perfilH[y]++;
      }
    }
  }

  const perfilVSuave = suavizar3(perfilV, 3);
  const perfilHSuave = suavizar3(perfilH, 3);

  if (typeof setProgreso === 'function') setProgreso(60, 'Detectando valles...');

  // Usar UMBRAL_DENSIDAD para filtrar valles
  const maxV = Math.max(...perfilVSuave);
  const maxH = Math.max(...perfilHSuave);

  // Ajuste: umbral más bajo = más sensible
  const umbralV = Math.max(PARAMS_PASO3.UMBRAL_DENSIDAD, maxV * 0.25);
  const umbralH = Math.max(PARAMS_PASO3.UMBRAL_DENSIDAD, maxH * 0.25);

  const verticales = detectarValles3(perfilVSuave, umbralV, PARAMS_PASO3.DISTANCIA_MIN_V);
  const horizontales = detectarValles3(perfilHSuave, umbralH, PARAMS_PASO3.DISTANCIA_MIN_H);

  window.MAR.paso3.verticales = verticales;
  window.MAR.paso3.horizontales = horizontales;
  window.MAR.paso3.perfiles = { perfilV: perfilVSuave, perfilH: perfilHSuave };

  const t1 = performance.now();
  window.MAR.paso3.tiempoMs = Math.round(t1 - t0);
  window.MAR.paso3.ejecutado = true;

  if (typeof setProgreso === 'function') setProgreso(100, '¡Paso 3 completado!');
  if (typeof mostrarStatus === 'function') mostrarStatus(`✅ Paso 3: ${verticales.length}V, ${horizontales.length}H`, 'success');

  actualizarEstadoBoton('paso3', true);
  return window.MAR.paso3;
}

function debugPaso3() {
  const p = window.MAR.paso3;
  if (!p.ejecutado) return '⚠️ Paso 3 no ejecutado aún';

  return `
═══════════════════════════════════════
PASO 3: ÓPTICA AÉREA
═══════════════════════════════════════

📊 ENTRADA:
   - Imagen: ${window.MAR.paso2.grises.width} × ${window.MAR.paso2.grises.height} px
   - Canal: Grises

⚙️ PARÁMETROS:
   - Umbral densidad: ${PARAMS_PASO3.UMBRAL_DENSIDAD}
   - Distancia mín V: ${PARAMS_PASO3.DISTANCIA_MIN_V} px
   - Distancia mín H: ${PARAMS_PASO3.DISTANCIA_MIN_H} px
   - Umbral continuidad: ${PARAMS_PASO3.UMBRAL_CONTINUIDAD * 100}%

⏱️ TIEMPO:
   - Ejecución: ${p.tiempoMs} ms

📈 RESULTADO:
   - Verticales detectadas: ${p.verticales.length}
     [${p.verticales.slice(0, 10).join(', ')}${p.verticales.length > 10 ? ', ...' : ''}]
   
   - Horizontales detectadas: ${p.horizontales.length}
     [${p.horizontales.slice(0, 10).join(', ')}${p.horizontales.length > 10 ? ', ...' : ''}]

💡 ESPERADO (según tu tabla):
   - 21 columnas → ~22 verticales
   - 10 filas → ~11 horizontales
═══════════════════════════════════════`;
}
