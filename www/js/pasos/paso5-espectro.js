// ============================================
// PASO 5: ESPECTRO ELECTROMAGNÉTICO
// Detección por matiz (H de HSV)
// ============================================

const PARAMS_PASO5 = {
  UMBRAL_MATIZ: 20,
  UMBRAL_SATURACION: 30,
  CANALES_ACTIVOS: 'HSV'
};

window.MAR = window.MAR || {};
window.MAR.paso5 = {
  ejecutado: false,
  verticales: [],
  horizontales: [],
  tiempoMs: 0
};

async function ejecutarPaso5() {
  if (!window.MAR.paso2.ejecutado) {
    alert('⚠️ Primero ejecuta el Paso 2 (Canales).');
    return null;
  }

  if (typeof setProgreso === 'function') setProgreso(10, 'Paso 5: Espectro HSV...');
  const t0 = performance.now();

  const hsv = window.MAR.paso2.hsv;
  const w = hsv.width;
  const h = hsv.height;
  const H = hsv.H;
  const S = hsv.S;

  if (typeof setProgreso === 'function') setProgreso(30, 'Analizando matiz...');

  const cambiosV = new Array(w).fill(0);
  const cambiosH = new Array(h).fill(0);

  // Detectar cambios de matiz entre píxeles vecinos
  for (let x = 1; x < w - 1; x++) {
    let suma = 0;
    for (let y = 0; y < h; y++) {
      const idxIzq = y * w + (x - 1);
      const idxDer = y * w + (x + 1);

      // Solo considerar píxeles con saturación significativa
      if (S[idxIzq] > PARAMS_PASO5.UMBRAL_SATURACION ||
          S[idxDer] > PARAMS_PASO5.UMBRAL_SATURACION) {
        let difH = Math.abs(H[idxIzq] - H[idxDer]);
        if (difH > 128) difH = 255 - difH; // wrap around
        if (difH > PARAMS_PASO5.UMBRAL_MATIZ) suma++;
      }
    }
    cambiosV[x] = suma;
  }

  for (let y = 1; y < h - 1; y++) {
    let suma = 0;
    for (let x = 0; x < w; x++) {
      const idxArr = (y - 1) * w + x;
      const idxAbj = (y + 1) * w + x;

      if (S[idxArr] > PARAMS_PASO5.UMBRAL_SATURACION ||
          S[idxAbj] > PARAMS_PASO5.UMBRAL_SATURACION) {
        let difH = Math.abs(H[idxArr] - H[idxAbj]);
        if (difH > 128) difH = 255 - difH;
        if (difH > PARAMS_PASO5.UMBRAL_MATIZ) suma++;
      }
    }
    cambiosH[y] = suma;
  }

  const cambiosVSuave = suavizar3(cambiosV, 3);
  const cambiosHSuave = suavizar3(cambiosH, 3);

  const umbralV = h * 0.3;
  const umbralH = w * 0.3;

  const detectarPicos5 = (arr, umbral, distanciaMin) => {
    const picos = [];
    for (let i = 2; i < arr.length - 2; i++) {
      if (arr[i] > umbral &&
          arr[i] >= arr[i - 1] && arr[i] >= arr[i + 1]) {
        if (picos.length === 0 || i - picos[picos.length - 1] >= distanciaMin) {
          picos.push(i);
        }
      }
    }
    return picos;
  };

  const verticales = detectarPicos5(cambiosVSuave, umbralV, PARAMS_PASO3.DISTANCIA_MIN_V);
  const horizontales = detectarPicos5(cambiosHSuave, umbralH, PARAMS_PASO3.DISTANCIA_MIN_H);

  window.MAR.paso5.verticales = verticales;
  window.MAR.paso5.horizontales = horizontales;

  const t1 = performance.now();
  window.MAR.paso5.tiempoMs = Math.round(t1 - t0);
  window.MAR.paso5.ejecutado = true;

  if (typeof setProgreso === 'function') setProgreso(100, '¡Paso 5 completado!');
  if (typeof mostrarStatus === 'function') mostrarStatus(`✅ Paso 5: ${verticales.length}V, ${horizontales.length}H`, 'success');

  actualizarEstadoBoton('paso5', true);
  return window.MAR.paso5;
}

function debugPaso5() {
  const p = window.MAR.paso5;
  if (!p.ejecutado) return '⚠️ Paso 5 no ejecutado aún';

  return `
═══════════════════════════════════════
PASO 5: ESPECTRO ELECTROMAGNÉTICO
═══════════════════════════════════════

📊 ENTRADA:
   - Canal: HSV (Matiz + Saturación)

⚙️ PARÁMETROS:
   - Umbral matiz: ${PARAMS_PASO5.UMBRAL_MATIZ}°
   - Umbral saturación: ${PARAMS_PASO5.UMBRAL_SATURACION}%

⏱️ TIEMPO:
   - Ejecución: ${p.tiempoMs} ms

📈 RESULTADO:
   - Verticales: ${p.verticales.length}
   - Horizontales: ${p.horizontales.length}

💡 NOTA:
   Este paso detecta cambios de color que los otros no ven.
   Útil para celdas con fondo de color (amarillo, verde, etc.)
═══════════════════════════════════════`;
}
