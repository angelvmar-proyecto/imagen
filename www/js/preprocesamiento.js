// ==============================================
// Preprocesamiento OCR — CRR + BS
// Adaptado de MAR Caribe para app OCR Timeshare
// ==============================================

// Config por defecto (se puede sobrescribir desde app.js)
window.PREPROC = {
  CRR_ACTIVO: true,
  CRR_UMBRAL: 80,
  BS_ACTIVO: true,
  BS_TAMANIO_BLOQUE: 30,
  BS_UMBRAL_SATURACION: 0.20,
  RETINA_GLOBAL_ACTIVO: true,
  RETINA_GLOBAL_FUERZA: 1.0,
  RETINA_GLOBAL_RADIO: 25,
  ESCALADO_ACTIVO: true,
  ESCALADO_UMBRAL_BAJO: 15,
  ESCALADO_UMBRAL_MEDIO: 30,
  ESCALADO_FACTOR_3X: 3,
  ESCALADO_FACTOR_2X: 2,
  CONTRASTE_ACTIVO: true
};

// ============================================
// CRR — Cosmic Ray Rejection
// Elimina píxeles anómalos comparando con sus vecinos
// ============================================
function aplicarCRR(imageData, umbral) {
  umbral = umbral || window.PREPROC.CRR_UMBRAL;
  const w = imageData.width;
  const h = imageData.height;
  const src = imageData.data;
  const dst = new Uint8ClampedArray(src.length);

  for (let i = 0; i < src.length; i++) dst[i] = src[i];

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4;

      let sumaR = 0, sumaG = 0, sumaB = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nIdx = ((y + dy) * w + (x + dx)) * 4;
          sumaR += src[nIdx];
          sumaG += src[nIdx + 1];
          sumaB += src[nIdx + 2];
        }
      }
      const promR = sumaR / 8;
      const promG = sumaG / 8;
      const promB = sumaB / 8;

      const difTotal = (Math.abs(src[idx] - promR) +
                        Math.abs(src[idx + 1] - promG) +
                        Math.abs(src[idx + 2] - promB)) / 3;

      if (difTotal > umbral) {
        dst[idx] = promR;
        dst[idx + 1] = promG;
        dst[idx + 2] = promB;
      }
    }
  }
  return new ImageData(dst, w, h);
}

// ============================================
// BS — Background Subtraction
// Quita el color de fondo de cada bloque
// ============================================
function aplicarBS(imageData, tamanioBloque) {
  tamanioBloque = tamanioBloque || window.PREPROC.BS_TAMANIO_BLOQUE;
  const w = imageData.width;
  const h = imageData.height;
  const src = imageData.data;
  const dst = new Uint8ClampedArray(src.length);

  const numBloquesX = Math.ceil(w / tamanioBloque);
  const numBloquesY = Math.ceil(h / tamanioBloque);
  const fondos = [];

  for (let by = 0; by < numBloquesY; by++) {
    for (let bx = 0; bx < numBloquesX; bx++) {
      const x0 = bx * tamanioBloque;
      const y0 = by * tamanioBloque;
      const x1 = Math.min(w, x0 + tamanioBloque);
      const y1 = Math.min(h, y0 + tamanioBloque);

      const valores = [];
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const idx = (y * w + x) * 4;
          const b = (src[idx] + src[idx + 1] + src[idx + 2]) / 3;
          valores.push({ r: src[idx], g: src[idx + 1], b: src[idx + 2], brillo: b });
        }
      }
      valores.sort((a, b) => b.brillo - a.brillo);
      const fondo = valores[Math.floor(valores.length * 0.25)];
      fondos.push({ bx, by, fondo });
    }
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const bx = Math.floor(x / tamanioBloque);
      const by = Math.floor(y / tamanioBloque);
      const idx = (y * w + x) * 4;
      const fondo = fondos[by * numBloquesX + bx].fondo;

      dst[idx]     = clamp(src[idx]     - fondo.r + 128, 0, 255);
      dst[idx + 1] = clamp(src[idx + 1] - fondo.g + 128, 0, 255);
      dst[idx + 2] = clamp(src[idx + 2] - fondo.b + 128, 0, 255);
      dst[idx + 3] = 255;
    }
  }
  return new ImageData(dst, w, h);
}

// ============================================
// Detectar si la imagen tiene ruido real
// ============================================
function necesitaCRR(imageData) {
  const w = imageData.width;
  const h = imageData.height;
  const src = imageData.data;
  let anomalos = 0, total = 0;

  for (let y = 1; y < h - 1; y += 3) {
    for (let x = 1; x < w - 1; x += 3) {
      const idx = (y * w + x) * 4;
      let suma = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nIdx = ((y + dy) * w + (x + dx)) * 4;
          suma += src[nIdx];
        }
      }
      const prom = suma / 8;
      if (Math.abs(src[idx] - prom) > 80) anomalos++;
      total++;
    }
  }
  return (anomalos / total) > 0.05;
}

// ============================================
// Detectar si la imagen tiene colores fuertes
// ============================================
function tieneColoresFuertes(imageData) {
  const w = imageData.width;
  const h = imageData.height;
  const src = imageData.data;
  let zonasColoridas = 0, totalZonas = 0;

  for (let by = 0; by < h - 30; by += 30) {
    for (let bx = 0; bx < w - 30; bx += 30) {
      let sumSat = 0, count = 0;
      for (let y = by; y < by + 30; y += 3) {
        for (let x = bx; x < bx + 30; x += 3) {
          const idx = (y * w + x) * 4;
          const r = src[idx], g = src[idx + 1], b = src[idx + 2];
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const sat = max === 0 ? 0 : (max - min) / max;
          sumSat += sat;
          count++;
        }
      }
      if ((sumSat / count) > window.PREPROC.BS_UMBRAL_SATURACION) zonasColoridas++;
      totalZonas++;
    }
  }
  return (zonasColoridas / totalZonas) > 0.20;
}

// ============================================
// Contraste adaptativo (estira histograma)
// ============================================
function contrastarAdaptativoCanvas(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const datos = imageData.data;
  const brillos = [];

  for (let i = 0; i < datos.length; i += 4) {
    brillos.push((datos[i] + datos[i + 1] + datos[i + 2]) / 3);
  }
  brillos.sort((a, b) => a - b);
  const min = brillos[Math.floor(brillos.length * 0.02)];
  const max = brillos[Math.floor(brillos.length * 0.98)];
  if (max - min < 10) return canvas;
  const factor = 255 / (max - min);

  for (let i = 0; i < datos.length; i += 4) {
    datos[i]     = clamp((datos[i]     - min) * factor, 0, 255);
    datos[i + 1] = clamp((datos[i + 1] - min) * factor, 0, 255);
    datos[i + 2] = clamp((datos[i + 2] - min) * factor, 0, 255);
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

// ============================================
// Escalado inteligente (agranda si el texto es muy pequeño)
// ============================================
function escalarInteligenteCanvas(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const datos = imageData.data;
  const w = canvas.width, h = canvas.height;
  const perfilH = new Array(h).fill(0);

  for (let y = 0; y < h; y++) {
    let cuenta = 0;
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const brillo = (datos[idx] + datos[idx + 1] + datos[idx + 2]) / 3;
      if (brillo < 128) cuenta++;
    }
    perfilH[y] = cuenta;
  }

  let primera = -1, ultima = -1;
  for (let y = 0; y < h; y++) {
    if (perfilH[y] > w * 0.02) {
      if (primera === -1) primera = y;
      ultima = y;
    }
  }
  const alturaTexto = ultima - primera + 1;

  let factor = 1;
  if (alturaTexto > 0) {
    if (alturaTexto < window.PREPROC.ESCALADO_UMBRAL_BAJO) factor = window.PREPROC.ESCALADO_FACTOR_3X;
    else if (alturaTexto < window.PREPROC.ESCALADO_UMBRAL_MEDIO) factor = window.PREPROC.ESCALADO_FACTOR_2X;
  }
  if (factor === 1) return canvas;

  const nuevo = document.createElement('canvas');
  nuevo.width = w * factor;
  nuevo.height = h * factor;
  const nctx = nuevo.getContext('2d');
  nctx.imageSmoothingEnabled = true;
  nctx.imageSmoothingQuality = 'high';
  nctx.drawImage(canvas, 0, 0, w * factor, h * factor);
  return nuevo;
}

// ============================================
// Pipeline completo de preprocesamiento
// ============================================
function preprocesarCanvasCompleto(canvasOriginal) {
  const stats = {
    aplicoCRR: false,
    aplicoBS: false,
    aplicoContraste: false,
    aplicoEscalado: false,
    tieneRuido: false,
    tieneColor: false,
    factorEscalado: 1
  };

  const ctx = canvasOriginal.getContext('2d', { willReadFrequently: true });
  let imageData = ctx.getImageData(0, 0, canvasOriginal.width, canvasOriginal.height);

  // 1. Detectar si necesita CRR
  if (window.PREPROC.CRR_ACTIVO) {
    stats.tieneRuido = necesitaCRR(imageData);
    if (stats.tieneRuido) {
      imageData = aplicarCRR(imageData);
      stats.aplicoCRR = true;
    }
  }

  // 2. Detectar si necesita BS
  if (window.PREPROC.BS_ACTIVO) {
    stats.tieneColor = tieneColoresFuertes(imageData);
    if (stats.tieneColor) {
      imageData = aplicarBS(imageData);
      stats.aplicoBS = true;
    }
  }

  // Aplicar los cambios al canvas
  ctx.putImageData(imageData, 0, 0);
  let canvasActual = canvasOriginal;

  // 3. Contraste adaptativo
  if (window.PREPROC.CONTRASTE_ACTIVO) {
    canvasActual = contrastarAdaptativoCanvas(canvasActual);
    stats.aplicoContraste = true;
  }

  // 4. Escalado inteligente
  if (window.PREPROC.ESCALADO_ACTIVO) {
    const antes = canvasActual.width;
    canvasActual = escalarInteligenteCanvas(canvasActual);
    if (canvasActual.width !== antes) {
      stats.aplicoEscalado = true;
      stats.factorEscalado = canvasActual.width / antes;
    }
  }

  return { canvas: canvasActual, stats };
}

console.log('✅ Preprocesamiento cargado');
