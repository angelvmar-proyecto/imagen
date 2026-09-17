// ============================================
// PASO 2: PREPARAR CANALES (Grises + RGB + HSV)
// No pierde información: mantiene 3 versiones
// ============================================

window.MAR = window.MAR || {};
window.MAR.paso2 = {
  ejecutado: false,
  grises: null,
  rgb: null,
  hsv: null,
  tiempoMs: 0
};

// Convertir RGB a Grises
function rgbAGrises(imageData) {
  const w = imageData.width;
  const h = imageData.height;
  const src = imageData.data;
  const grises = new Uint8Array(w * h);

  for (let i = 0; i < src.length; i += 4) {
    grises[i / 4] = Math.round(0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2]);
  }
  return { data: grises, width: w, height: h };
}

// Convertir RGB a HSV
function rgbAHSV(imageData) {
  const w = imageData.width;
  const h = imageData.height;
  const src = imageData.data;

  const H = new Uint8Array(w * h);
  const S = new Uint8Array(w * h);
  const V = new Uint8Array(w * h);

  for (let i = 0; i < src.length; i += 4) {
    const r = src[i] / 255;
    const g = src[i + 1] / 255;
    const b = src[i + 2] / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;

    let hh = 0;
    if (d !== 0) {
      if (max === r) hh = ((g - b) / d) % 6;
      else if (max === g) hh = (b - r) / d + 2;
      else hh = (r - g) / d + 4;
    }
    hh = Math.round(hh * 60);
    if (hh < 0) hh += 360;

    const ss = max === 0 ? 0 : Math.round((d / max) * 100);
    const vv = Math.round(max * 100);

    const idx = i / 4;
    H[idx] = Math.round(hh / 360 * 255);
    S[idx] = Math.round(ss / 100 * 255);
    V[idx] = Math.round(vv / 100 * 255);
  }

  return { H, S, V, width: w, height: h };
}

// Ejecutar paso 2
async function ejecutarPaso2() {
  if (!window.MAR.paso1.ejecutado) {
    alert('⚠️ Primero ejecuta el Paso 1 (Mediana).');
    return null;
  }

  if (typeof setProgreso === 'function') setProgreso(10, 'Paso 2: Preparando canales...');
  
  const t0 = performance.now();

  const mediana = window.MAR.paso1.imagenMediana;

  if (typeof setProgreso === 'function') setProgreso(30, 'Convirtiendo a grises...');
  const grises = rgbAGrises(mediana);
  window.MAR.paso2.grises = grises;

  if (typeof setProgreso === 'function') setProgreso(60, 'Convirtiendo a HSV...');
  const hsv = rgbAHSV(mediana);
  window.MAR.paso2.hsv = hsv;

  window.MAR.paso2.rgb = mediana;

  const t1 = performance.now();
  window.MAR.paso2.tiempoMs = Math.round(t1 - t0);
  window.MAR.paso2.ejecutado = true;

  if (typeof setProgreso === 'function') setProgreso(100, '¡Paso 2 completado!');
  if (typeof mostrarStatus === 'function') mostrarStatus('✅ Paso 2: Canales preparados', 'success');

  actualizarEstadoBoton('paso2', true);

  return window.MAR.paso2;
}

// Debug
function debugPaso2() {
  const p = window.MAR.paso2;
  if (!p.ejecutado) return '⚠️ Paso 2 no ejecutado aún';

  return `
═══════════════════════════════════════
PASO 2: PREPARAR CANALES
═══════════════════════════════════════

📊 ENTRADA:
   - Imagen: ${p.rgb.width} × ${p.rgb.height} px

⚙️ PARÁMETROS:
   - Canales: Grises, RGB, HSV
   - Conversión: estándar

⏱️ TIEMPO:
   - Ejecución: ${p.tiempoMs} ms

✅ RESULTADO:
   - Grises: ${p.grises.width} × ${p.grises.height} px (Uint8Array)
   - HSV: H, S, V separados (3 × Uint8Array)
   - RGB: preservado (ImageData)

💡 NOTA:
   Durante todo el procesamiento se mantienen los 3 canales.
   La conversión a grises solo se usa para análisis de brillo.
   HSV se usa para detectar celdas con color.
   NADA se pierde hasta el paso final (OCR).
═══════════════════════════════════════`;
}
