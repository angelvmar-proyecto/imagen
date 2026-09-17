// ============================================
// PASO 2: CANALES (Grises + HSV)
// Lee de window.MAR.imagenOriginal
// ============================================

window.MAR = window.MAR || {};
window.MAR.paso2 = { ejecutado: false, tiempoMs: 0 };

function rgbAGrises2(imageData) {
  const w = imageData.width, h = imageData.height;
  const src = imageData.data;
  const grises = new Uint8Array(w * h);
  for (let i = 0; i < src.length; i += 4) {
    grises[i / 4] = Math.round(0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2]);
  }
  return { data: grises, width: w, height: h };
}

function rgbAHSV2(imageData) {
  const w = imageData.width, h = imageData.height;
  const src = imageData.data;
  const H = new Uint8Array(w * h), S = new Uint8Array(w * h), V = new Uint8Array(w * h);
  for (let i = 0; i < src.length; i += 4) {
    const r = src[i]/255, g = src[i+1]/255, b = src[i+2]/255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min;
    let hh = 0;
    if (d !== 0) {
      if (max === r) hh = ((g-b)/d) % 6;
      else if (max === g) hh = (b-r)/d + 2;
      else hh = (r-g)/d + 4;
    }
    hh = Math.round(hh * 60);
    if (hh < 0) hh += 360;
    const ss = max === 0 ? 0 : Math.round((d/max)*100);
    const vv = Math.round(max*100);
    const idx = i/4;
    H[idx] = Math.round(hh/360*255);
    S[idx] = Math.round(ss/100*255);
    V[idx] = Math.round(vv/100*255);
  }
  return { H, S, V, width: w, height: h };
}

async function ejecutarPaso2() {
  if (typeof setProgreso === 'function') setProgreso(10, 'Paso 2: Canales...');
  const t0 = performance.now();

  // Verificar que la imagen original existe
  if (!window.MAR.imagenOriginal) {
    throw new Error('No hay imagen. Carga una imagen primero.');
  }

  // Leer DIRECTAMENTE de la imagen original
  const imageData = window.MAR.imagenOriginal;

  window.MAR.paso2.grises = rgbAGrises2(imageData);
  window.MAR.paso2.hsv = rgbAHSV2(imageData);
  window.MAR.paso2.rgb = imageData;

  window.MAR.paso2.tiempoMs = Math.round(performance.now() - t0);
  window.MAR.paso2.ejecutado = true;

  if (typeof setProgreso === 'function') setProgreso(100, '¡Paso 2!');
  return window.MAR.paso2;
}

function debugPaso2() {
  const p = window.MAR.paso2;
  return `PASO 2: CANALES
⏱️ ${p.tiempoMs} ms
✅ Grises: ${p.grises.width}×${p.grises.height}
✅ HSV: H, S, V preparados`;
}
