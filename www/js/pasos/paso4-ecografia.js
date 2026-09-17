// ============================================
// PASO 4: ECOGRAFÍA - Detección de Bordes
// Cambios bruscos de tono = bordes
// ============================================

const PARAMS_PASO4 = {
  UMBRAL_CONTRASTE: 38,
  UMBRAL_CONTRASTE_V: 42,
  LONGITUD_MIN_BORDE: 0.15
};

window.MAR = window.MAR || {};
window.MAR.paso4 = {
  ejecutado: false,
  verticales: [],
  horizontales: [],
  tiempoMs: 0
};

async function ejecutarPaso4() {
  if (!window.MAR.paso2.ejecutado) {
    alert('⚠️ Primero ejecuta el Paso 2 (Canales).');
    return null;
  }

  if (typeof setProgreso === 'function') setProgreso(10, 'Paso 4: Ecografía...');
  const t0 = performance.now();

  const grises = window.MAR.paso2.grises;
  const w = grises.width;
  const h = grises.height;
  const data = grises.data;

  if (typeof setProgreso === 'function') setProgreso(30, 'Calculando gradientes...');

  // Gradiente horizontal (bordes verticales)
  const gradX = new Array(w).fill(0);
  for (let x = 1; x < w - 1; x++) {
    let suma = 0;
    for (let y = 0; y < h; y++) {
      const dif = Math.abs(data[y * w + (x + 1)] - data[y * w + (x - 1)]);
      if (dif > PARAMS_PASO4.UMBRAL_CONTRASTE_V) suma++;
    }
    gradX[x] = suma;
  }

  // Gradiente vertical (bordes horizontales)
  const gradY = new Array(h).fill(0);
  for (let y = 1; y < h - 1; y++) {
    let suma = 0;
    for (let x = 0; x < w; x++) {
      const dif = Math.abs(data[(y + 1) * w + x] - data[(y - 1) * w + x]);
      if (dif > PARAMS_PASO4.UMBRAL_CONTRASTE) suma++;
    }
    gradY[y] = suma;
  }

  const gradXSuave = suavizar3(gradX, 3);
  const gradYSuave = suavizar3(gradY, 3);

  if (typeof setProgreso === 'function') setProgreso(70, 'Detectando picos...');

  // Longitud mínima de borde
  const umbralX = h * PARAMS_PASO4.LONGITUD_MIN_BORDE;
  const umbralY = w * PARAMS_PASO4.LONGITUD_MIN_BORDE;

  const detectarPicos4 = (arr, umbral, distanciaMin) => {
    const picos = [];
    for (let i = 2; i < arr.length - 2; i++) {
      if (arr[i] > umbral &&
          arr[i] >= arr[i - 1] && arr[i] >= arr[i + 1] &&
          arr[i] > arr[i - 2] && arr[i] > arr[i + 2]) {
        if (picos.length === 0 || i - picos[picos.length - 1] >= distanciaMin) {
          picos.push(i);
        }
      }
    }
    return picos;
  };

  const verticales = detectarPicos4(gradXSuave, umbralX, PARAMS_PASO3.DISTANCIA_MIN_V);
  const horizontales = detectarPicos4(gradYSuave, umbralY, PARAMS_PASO3.DISTANCIA_MIN_H);

  window.MAR.paso4.verticales = verticales;
  window.MAR.paso4.horizontales = horizontales;

  const t1 = performance.now();
  window.MAR.paso4.tiempoMs = Math.round(t1 - t0);
  window.MAR.paso4.ejecutado = true;

  if (typeof setProgreso === 'function') setProgreso(100, '¡Paso 4 completado!');
  if (typeof mostrarStatus === 'function') mostrarStatus(`✅ Paso 4: ${verticales.length}V, ${horizontales.length}H`, 'success');

  actualizarEstadoBoton('paso4', true);
  return window.MAR.paso4;
}

function debugPaso4() {
  const p = window.MAR.paso4;
  if (!p.ejecutado) return '⚠️ Paso 4 no ejecutado aún';

  return `
═══════════════════════════════════════
PASO 4: ECOGRAFÍA (Bordes)
═══════════════════════════════════════

📊 ENTRADA:
   - Canal: Grises

⚙️ PARÁMETROS:
   - Umbral contraste V: ${PARAMS_PASO4.UMBRAL_CONTRASTE_V}
   - Umbral contraste H: ${PARAMS_PASO4.UMBRAL_CONTRASTE}
   - Longitud mín borde: ${PARAMS_PASO4.LONGITUD_MIN_BORDE * 100}%

⏱️ TIEMPO:
   - Ejecución: ${p.tiempoMs} ms

📈 RESULTADO:
   - Verticales detectadas: ${p.verticales.length}
   - Horizontales detectadas: ${p.horizontales.length}
═══════════════════════════════════════`;
}
