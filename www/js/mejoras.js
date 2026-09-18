// ==============================================
// MAR Caribe — Mejoras v10.0
// Preprocesamiento (CRR, BS, Wavelet)
// ==============================================

// ============================================
// CRR — COSMIC RAY REJECTION
// Elimina píxeles anómalos sin dañar detalles
// ============================================
function aplicarCRR(imageData, umbral) {
  umbral = umbral || 80;
  const w = imageData.width;
  const h = imageData.height;
  const src = imageData.data;
  const dst = new Uint8ClampedArray(src.length);

  // Copiar original primero
  for (let i = 0; i < src.length; i++) dst[i] = src[i];

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4;

      // Calcular promedio de los 8 vecinos
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

      // Diferencia con el píxel actual
      const difR = Math.abs(src[idx] - promR);
      const difG = Math.abs(src[idx + 1] - promG);
      const difB = Math.abs(src[idx + 2] - promB);
      const difTotal = (difR + difG + difB) / 3;

      // Si es anómalo, reemplazar por el promedio
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
// BACKGROUND SUBTRACTION
// Elimina el fondo (colores) para destacar líneas
// ============================================
function aplicarBS(imageData, tamanioBloque) {
  tamanioBloque = tamanioBloque || 30;
  const w = imageData.width;
  const h = imageData.height;
  const src = imageData.data;
  const dst = new Uint8ClampedArray(src.length);

  // Calcular fondo por bloques
  const numBloquesX = Math.ceil(w / tamanioBloque);
  const numBloquesY = Math.ceil(h / tamanioBloque);
  const fondos = [];

  for (let by = 0; by < numBloquesY; by++) {
    for (let bx = 0; bx < numBloquesX; bx++) {
      const x0 = bx * tamanioBloque;
      const y0 = by * tamanioBloque;
      const x1 = Math.min(w, x0 + tamanioBloque);
      const y1 = Math.min(h, y0 + tamanioBloque);

      // Calcular mediana del bloque (robusta al texto)
      const valores = [];
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const idx = (y * w + x) * 4;
          const brillo = (src[idx] + src[idx + 1] + src[idx + 2]) / 3;
          valores.push({ r: src[idx], g: src[idx + 1], b: src[idx + 2], brillo });
        }
      }

      valores.sort((a, b) => b.brillo - a.brillo);
      // Tomar el percentil 75 (el más claro = fondo)
      const fondo = valores[Math.floor(valores.length * 0.25)];
      fondos.push({ bx, by, fondo });
    }
  }

  // Restar el fondo
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const bx = Math.floor(x / tamanioBloque);
      const by = Math.floor(y / tamanioBloque);
      const idx = (y * w + x) * 4;
      const fondo = fondos[by * numBloquesX + bx].fondo;

      // Restar el fondo a cada canal
      let r = src[idx] - fondo.r + 128;
      let g = src[idx + 1] - fondo.g + 128;
      let b = src[idx + 2] - fondo.b + 128;

      dst[idx] = Math.max(0, Math.min(255, r));
      dst[idx + 1] = Math.max(0, Math.min(255, g));
      dst[idx + 2] = Math.max(0, Math.min(255, b));
      dst[idx + 3] = 255;
    }
  }

  return new ImageData(dst, w, h);
}

// ============================================
// WAVELET DENOISING (simplificado)
// Elimina ruido preservando bordes
// ============================================
function aplicarWaveletDenoising(imageData, umbral) {
  umbral = umbral || 15;
  const w = imageData.width;
  const h = imageData.height;
  const src = imageData.data;
  const dst = new Uint8ClampedArray(src.length);

  // Convertir a grises para análisis
  const grises = new Uint8ClampedArray(w * h);
  for (let i = 0; i < src.length; i += 4) {
    grises[i / 4] = Math.round(0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2]);
  }

  // Aplicar suavizado adaptativo
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const idxG = y * w + x;

      // Calcular varianza local (ventana 3x3)
      let suma = 0, sumaCuadrados = 0, count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ny = y + dy, nx = x + dx;
          if (ny < 0 || ny >= h || nx < 0 || nx >= w) continue;
          const v = grises[ny * w + nx];
          suma += v;
          sumaCuadrados += v * v;
          count++;
        }
      }
      const media = suma / count;
      const varianza = (sumaCuadrados / count) - (media * media);

      // Si la varianza es baja → zona plana → suavizar
      // Si la varianza es alta → zona con bordes → preservar
      if (varianza < umbral) {
        dst[idx] = media;
        dst[idx + 1] = media;
        dst[idx + 2] = media;
      } else {
        dst[idx] = src[idx];
        dst[idx + 1] = src[idx + 1];
        dst[idx + 2] = src[idx + 2];
      }
      dst[idx + 3] = 255;
    }
  }

  return new ImageData(dst, w, h);
}

// ============================================
// DETECTAR SI NECESITA CRR
// ============================================
function necesitaCRR(imageData) {
  const w = imageData.width;
  const h = imageData.height;
  const src = imageData.data;

  // Contar píxeles anómalos
  let anomalos = 0;
  let total = 0;

  for (let y = 1; y < h - 1; y += 2) {
    for (let x = 1; x < w - 1; x += 2) {
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
      const dif = Math.abs(src[idx] - prom);
      if (dif > 80) anomalos++;
      total++;
    }
  }

  const porcentaje = anomalos / total;
  return porcentaje > 0.02;  // Más del 2% de píxeles anómalos
}

// ============================================
// DETECTAR SI TIENE COLORES
// ============================================
function tieneColores(imageData) {
  const w = imageData.width;
  const h = imageData.height;
  const src = imageData.data;

  // Analizar zonas planas (fondo)
  let zonasColoridas = 0;
  let totalZonas = 0;

  for (let by = 0; by < h - 30; by += 30) {
    for (let bx = 0; bx < w - 30; bx += 30) {
      // Calcular saturación promedio de la zona
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
      const satProm = sumSat / count;
      if (satProm > 0.15) zonasColoridas++;
      totalZonas++;
    }
  }

  const porcentaje = zonasColoridas / totalZonas;
  return porcentaje > 0.20;  // Más del 20% de zonas con color
}

console.log('✅ Mejoras v10.0 cargadas: CRR, BS, Wavelet Denoising');
