// ============================================
// PASO 4: ECOGRAFÍA (v9.6)
// Cobertura 40%, búsqueda de bordes reales
// ============================================

const PARAMS_PASO4 = {
  UMBRAL_CONTRASTE: 38,
  UMBRAL_CONTRASTE_V: 42,
  LONGITUD_MIN_BORDE: 0.15,
  COBERTURA_MIN: 0.40,
  BUSQUEDA_BORDE: 25
};

window.MAR = window.MAR || {};
window.MAR.paso4 = { ejecutado: false, verticales: [], horizontales: [], tiempoMs: 0 };

function buscarLineaCercaDe4(lineas, posicionObjetivo, rango) {
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

async function ejecutarPaso4() {
  if (!window.MAR.paso2 || !window.MAR.paso2.ejecutado) {
    throw new Error('Ejecuta Paso 2 primero');
  }
  if (typeof setProgreso === 'function') setProgreso(10, 'Paso 4: Ecografía...');
  const t0 = performance.now();

  const grises = window.MAR.paso2.grises;
  const w = grises.width, h = grises.height, data = grises.data;

  const gradX = new Array(w).fill(0);
  for (let x = 1; x < w-1; x++) {
    let s = 0;
    for (let y = 0; y < h; y++) {
      const dif = Math.abs(data[y*w+(x+1)] - data[y*w+(x-1)]);
      if (dif > PARAMS_PASO4.UMBRAL_CONTRASTE_V) s++;
    }
    gradX[x] = s;
  }

  const gradY = new Array(h).fill(0);
  for (let y = 1; y < h-1; y++) {
    let s = 0;
    for (let x = 0; x < w; x++) {
      const dif = Math.abs(data[(y+1)*w+x] - data[(y-1)*w+x]);
      if (dif > PARAMS_PASO4.UMBRAL_CONTRASTE) s++;
    }
    gradY[y] = s;
  }

  const gx = suavizar3(gradX, 3);
  const gy = suavizar3(gradY, 3);

  const vCortes = [];
  for (let x = 2; x < gx.length-2; x++) {
    const cobertura = gx[x] / h;
    if (cobertura >= PARAMS_PASO4.COBERTURA_MIN && gx[x] >= gx[x-1] && gx[x] >= gx[x+1]) {
      if (vCortes.length === 0 || x - vCortes[vCortes.length-1] >= PARAMS_PASO3.DISTANCIA_MIN_V) {
        vCortes.push(x);
      }
    }
  }

  const hCortes = [];
  for (let y = 2; y < gy.length-2; y++) {
    const cobertura = gy[y] / w;
    if (cobertura >= PARAMS_PASO4.COBERTURA_MIN && gy[y] >= gy[y-1] && gy[y] >= gy[y+1]) {
      if (hCortes.length === 0 || y - hCortes[hCortes.length-1] >= PARAMS_PASO3.DISTANCIA_MIN_H) {
        hCortes.push(y);
      }
    }
  }

  // Añadir bordes reales o ciego
  const rango = PARAMS_PASO4.BUSQUEDA_BORDE;
  
  const bordeIzq = buscarLineaCercaDe4(vCortes.map(x => ({posicion: x})), 0, rango);
  if (!bordeIzq && (vCortes.length === 0 || vCortes[0] > 10)) vCortes.unshift(0);
  
  const bordeDer = buscarLineaCercaDe4(vCortes.map(x => ({posicion: x})), w-1, rango);
  if (!bordeDer && (vCortes.length === 0 || vCortes[vCortes.length-1] < w-10)) vCortes.push(w-1);
  
  const bordeSup = buscarLineaCercaDe4(hCortes.map(y => ({posicion: y})), 0, rango);
  if (!bordeSup && (hCortes.length === 0 || hCortes[0] > 10)) hCortes.unshift(0);
  
  const bordeInf = buscarLineaCercaDe4(hCortes.map(y => ({posicion: y})), h-1, rango);
  if (!bordeInf && (hCortes.length === 0 || hCortes[hCortes.length-1] < h-10)) hCortes.push(h-1);

  window.MAR.paso4.verticales = vCortes.map(v => ({ posicion: v, votos: 1 }));
  window.MAR.paso4.horizontales = hCortes.map(h => ({ posicion: h, votos: 1 }));
  window.MAR.paso4.tiempoMs = Math.round(performance.now() - t0);
  window.MAR.paso4.ejecutado = true;

  if (typeof dibujarLineasPaso === 'function') {
    dibujarLineasPaso(4, vCortes, hCortes);
    actualizarContadores(vCortes.length, hCortes.length);
  }

  if (typeof setProgreso === 'function') setProgreso(100, '¡Paso 4!');
  return window.MAR.paso4;
}

function debugPaso4() {
  const p = window.MAR.paso4;
  return `PASO 4: ECOGRAFÍA (v9.6)
⏱️ ${p.tiempoMs} ms
📊 Verticales: ${p.verticales.length}
📊 Horizontales: ${p.horizontales.length}
⚙️ Cobertura: ${PARAMS_PASO4.COBERTURA_MIN * 100}%`;
}
