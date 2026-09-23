// ==============================================
// Retina (contraste local + realce de bordes)
// Adaptado de MAR Caribe para app OCR Timeshare
// ==============================================

function calcularDensidadContraste(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const datos = imageData.data;
  const w = canvas.width, h = canvas.height;
  let sumaVar = 0, count = 0;

  for (let y = 2; y < h - 2; y += 4) {
    for (let x = 2; x < w - 2; x += 4) {
      const idx = (y * w + x) * 4;
      const brillo = (datos[idx] + datos[idx + 1] + datos[idx + 2]) / 3;
      const idxDer = (y * w + (x + 2)) * 4;
      const brilloDer = (datos[idxDer] + datos[idxDer + 1] + datos[idxDer + 2]) / 3;
      sumaVar += Math.abs(brillo - brilloDer);
      count++;
    }
  }
  return count > 0 ? sumaVar / count : 0;
}

function ajusteContrasteLocal(canvas, radio, fuerza) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const datos = imageData.data;
  const w = canvas.width, h = canvas.height;
  const salida = new Uint8ClampedArray(datos.length);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const brillo = (datos[idx] + datos[idx + 1] + datos[idx + 2]) / 3;

      let suma = 0, count = 0;
      const x0 = Math.max(0, x - radio);
      const x1 = Math.min(w - 1, x + radio);
      const y0 = Math.max(0, y - radio);
      const y1 = Math.min(h - 1, y + radio);

      for (let yy = y0; yy <= y1; yy += 3) {
        for (let xx = x0; xx <= x1; xx += 3) {
          const nIdx = (yy * w + xx) * 4;
          suma += (datos[nIdx] + datos[nIdx + 1] + datos[nIdx + 2]) / 3;
          count++;
        }
      }
      const promedioLocal = suma / count;
      const dif = brillo - promedioLocal;
      const ajustado = clamp(brillo + dif * fuerza, 0, 255);

      salida[idx] = ajustado;
      salida[idx + 1] = ajustado;
      salida[idx + 2] = ajustado;
      salida[idx + 3] = 255;
    }
  }
  ctx.putImageData(new ImageData(salida, w, h), 0, 0);
  return canvas;
}

function realzarBordes(canvas, fuerza) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const datos = imageData.data;
  const w = canvas.width, h = canvas.height;
  const salida = new Uint8ClampedArray(datos.length);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) {
        salida[idx] = datos[idx];
        salida[idx + 1] = datos[idx + 1];
        salida[idx + 2] = datos[idx + 2];
        salida[idx + 3] = datos[idx + 3];
        continue;
      }
      const idxArriba = ((y - 1) * w + x) * 4;
      const idxAbajo = ((y + 1) * w + x) * 4;
      const idxIzq = (y * w + (x - 1)) * 4;
      const idxDer = (y * w + (x + 1)) * 4;

      const v = datos[idx] * 5
        - datos[idxArriba]
        - datos[idxAbajo]
        - datos[idxIzq]
        - datos[idxDer];

      const mezclado = datos[idx] * (1 - fuerza) + v * fuerza;
      salida[idx] = clamp(mezclado, 0, 255);
      salida[idx + 1] = clamp(mezclado, 0, 255);
      salida[idx + 2] = clamp(mezclado, 0, 255);
      salida[idx + 3] = 255;
    }
  }
  ctx.putImageData(new ImageData(salida, w, h), 0, 0);
  return canvas;
}

// ============================================
// Retina GLOBAL (unsharp masking, rápido con blur nativo)
// ============================================
function aplicarRetinaGlobal(canvas) {
  const fuerza = window.PREPROC.RETINA_GLOBAL_FUERZA || 1.0;
  const radio = window.PREPROC.RETINA_GLOBAL_RADIO || 25;
  const w = canvas.width, h = canvas.height;
  if (w === 0 || h === 0) return canvas;

  const blur = document.createElement('canvas');
  blur.width = w;
  blur.height = h;
  const ctxB = blur.getContext('2d');
  ctxB.filter = 'blur(' + radio + 'px)';
  ctxB.drawImage(canvas, 0, 0);
  ctxB.filter = 'none';

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const orig = ctx.getImageData(0, 0, w, h);
  const blurd = ctxB.getImageData(0, 0, w, h);
  const dO = orig.data, dB = blurd.data;

  for (let i = 0; i < dO.length; i += 4) {
    const g  = (dO[i]     + dO[i + 1]     + dO[i + 2])     / 3;
    const gb = (dB[i]     + dB[i + 1]     + dB[i + 2])     / 3;
    const ajuste = (g - gb) * fuerza;
    dO[i]     = clamp(dO[i]     + ajuste, 0, 255);
    dO[i + 1] = clamp(dO[i + 1] + ajuste, 0, 255);
    dO[i + 2] = clamp(dO[i + 2] + ajuste, 0, 255);
  }
  ctx.putImageData(orig, 0, 0);
  return canvas;
}

console.log('✅ Retina cargada');
