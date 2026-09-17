// ============================================
// PASO 5: ESPECTRO ELECTROMAGNÉTICO (v9.7)
// H + S + V, cobertura 30%
// ============================================

const PARAMS_PASO5 = {
  UMBRAL_MATIZ: 20,
  UMBRAL_SATURACION: 30,
  UMBRAL_VALOR: 30,
  COBERTURA_MIN: 0.30,
  BUSQUEDA_BORDE: 80
};

window.MAR = window.MAR || {};
window.MAR.paso5 = { ejecutado: false, verticales: [], horizontales: [], tiempoMs: 0 };

function buscarLineaCercaDe5(lineas, posicionObjetivo, rango) {
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

async function ejecutarPaso5() {
  if (!window.MAR.paso2 || !window.MAR.paso2.ejecutado) {
    throw new Error('Ejecuta Paso 2 primero');
  }
  if (typeof setProgreso === 'function') setProgreso(10, 'Paso 5: Espectro...');
  const t0 = performance.now();

  const hsv = window.MAR.paso2.hsv;
  const w = hsv.width, h = hsv.height;
  const H = hsv.H, S = hsv.S, V = hsv.V;

  const cV = new Array(w).fill(0);
  for (let x = 1; x < w-1; x++) {
    let s = 0;
    for (let y = 0; y < h; y++) {
      const iL = y*w+(x-1), iR = y*w+(x+1);
      if (S[iL] > PARAMS_PASO5.UMBRAL_SATURACION || S[iR] > PARAMS_PASO5.UMBRAL_SATURACION) {
        let dH = Math.abs(H[iL] - H[iR]);
        if (dH > 128) dH = 255 - dH;
        const dV = Math.abs(V[iL] - V[iR]);
        if (dH > PARAMS_PASO5.UMBRAL_MATIZ || dV > PARAMS_PASO5.UMBRAL_VALOR) s++;
      }
    }
    cV[x] = s;
  }

  const cH = new Array(h).fill(0);
  for (let y = 1; y < h-1; y++) {
    let s = 0;
    for (let x = 0; x < w; x++) {
      const iA = (y-1)*w+x, iB = (y+1)*w+x;
      if (S[iA] > PARAMS_PASO5.UMBRAL_SATURACION || S[iB] > PARAMS_PASO5.UMBRAL_SATURACION) {
        let dH = Math.abs(H[iA] - H[iB]);
        if (dH > 128) dH = 255 - dH;
        const dV = Math.abs(V[iA] - V[iB]);
        if (dH > PARAMS_PASO5.UMBRAL_MATIZ || dV > PARAMS_PASO5.UMBRAL_VALOR) s++;
      }
    }
    cH[y] = s;
  }

  const cvS = suavizar3(cV, 3);
  const chS = suavizar3(cH, 3);

  const vCortes = [];
  for (let x = 2; x < cvS.length-2; x++) {
    const cobertura = cvS[x] / h;
    if (cobertura >= PARAMS_PASO5.COBERTURA_MIN && cvS[x] >= cvS[x-1] && cvS[x] >= cvS[x+1]) {
      if (vCortes.length === 0 || x - vCortes[vCortes.length-1] >= PARAMS_PASO3.DISTANCIA_MIN_V) {
        vCortes.push(x);
      }
    }
  }

  const hCortes = [];
  for (let y = 2; y < chS.length-2; y++) {
    const cobertura = chS[y] / w;
    if (cobertura >= PARAMS_PASO5.COBERTURA_MIN && chS[y] >= chS[y-1] && chS[y] >= chS[y+1]) {
      if (hCortes.length === 0 || y - hCortes[hCortes.length-1] >= PARAMS_PASO3.DISTANCIA_MIN_H) {
        hCortes.push(y);
      }
    }
  }

  const rango = PARAMS_PASO5.BUSQUEDA_BORDE;
  const bordeIzq = buscarLineaCercaDe5(vCortes.map(x => ({posicion: x})), 0, rango);
  if (!bordeIzq && (vCortes.length === 0 || vCortes[0] > 10)) vCortes.unshift(0);
  const bordeDer = buscarLineaCercaDe5(vCortes.map(x => ({posicion: x})), w-1, rango);
  if (!bordeDer && (vCortes.length === 0 || vCortes[vCortes.length-1] < w-10)) vCortes.push(w-1);
  const bordeSup = buscarLineaCercaDe5(hCortes.map(y => ({posicion: y})), 0, rango);
  if (!bordeSup && (hCortes.length === 0 || hCortes[0] > 10)) hCortes.unshift(0);
  const bordeInf = buscarLineaCercaDe5(hCortes.map(y => ({posicion: y})), h-1, rango);
  if (!bordeInf && (hCortes.length === 0 || hCortes[hCortes.length-1] < h-10)) hCortes.push(h-1);

  window.MAR.paso5.verticales = vCortes.map(v => ({ posicion: v, votos: 1 }));
  window.MAR.paso5.horizontales = hCortes.map(h => ({ posicion: h, votos: 1 }));
  window.MAR.paso5.tiempoMs = Math.round(performance.now() - t0);
  window.MAR.paso5.ejecutado = true;

  if (typeof dibujarLineasPaso === 'function') {
    dibujarLineasPaso(5, vCortes, hCortes);
    actualizarContadores(vCortes.length, hCortes.length);
  }

  if (typeof setProgreso === 'function') setProgreso(100, '¡Paso 5!');
  return window.MAR.paso5;
}

function debugPaso5() {
  const p = window.MAR.paso5;
  return `PASO 5: ESPECTRO (v9.7)
⏱️ ${p.tiempoMs} ms
📊 Verticales: ${p.verticales.length}
📊 Horizontales: ${p.horizontales.length}
⚙️ Cobertura: ${PARAMS_PASO5.COBERTURA_MIN * 100}%`;
}
