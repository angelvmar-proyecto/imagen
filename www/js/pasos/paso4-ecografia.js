const PARAMS_PASO4 = {
  UMBRAL_CONTRASTE: 38,
  UMBRAL_CONTRASTE_V: 42,
  LONGITUD_MIN_BORDE: 0.15,
  COBERTURA_MIN: 0.55
};

window.MAR = window.MAR || {};
window.MAR.paso4 = { ejecutado: false, verticales: [], horizontales: [], tiempoMs: 0 };

// Detectar cambios bruscos (bordes verticales reales)
function detectarBordesVerticales(grises) {
  const w = grises.width, h = grises.height;
  const data = grises.data;
  const bordes = [];

  for (let x = 2; x < w - 2; x++) {
    let contador = 0;
    for (let y = 0; y < h; y++) {
      const dif = Math.abs(data[y*w+(x+1)] - data[y*w+(x-1)]);
      if (dif > PARAMS_PASO4.UMBRAL_CONTRASTE_V) contador++;
    }
    const cobertura = contador / h;
    if (cobertura > PARAMS_PASO4.COBERTURA_MIN) {
      bordes.push({ posicion: x, cobertura });
    }
  }

  // Agrupar
  const agrupados = [];
  for (const b of bordes) {
    if (agrupados.length === 0 || b.posicion - agrupados[agrupados.length-1].posicion > 3) {
      agrupados.push(b);
    }
  }
  return agrupados;
}

// Detectar cambios bruscos (bordes horizontales reales)
function detectarBordesHorizontales(grises) {
  const w = grises.width, h = grises.height;
  const data = grises.data;
  const bordes = [];

  for (let y = 2; y < h - 2; y++) {
    let contador = 0;
    for (let x = 0; x < w; x++) {
      const dif = Math.abs(data[(y+1)*w+x] - data[(y-1)*w+x]);
      if (dif > PARAMS_PASO4.UMBRAL_CONTRASTE) contador++;
    }
    const cobertura = contador / w;
    if (cobertura > PARAMS_PASO4.COBERTURA_MIN) {
      bordes.push({ posicion: y, cobertura });
    }
  }

  const agrupados = [];
  for (const b of bordes) {
    if (agrupados.length === 0 || b.posicion - agrupados[agrupados.length-1].posicion > 3) {
      agrupados.push(b);
    }
  }
  return agrupados;
}

async function ejecutarPaso4() {
  if (!window.MAR.paso2 || !window.MAR.paso2.ejecutado) {
    throw new Error('Ejecuta Paso 2 primero');
  }
  if (typeof setProgreso === 'function') setProgreso(10, 'Paso 4: Ecografía...');
  const t0 = performance.now();

  const grises = window.MAR.paso2.grises;

  const vBordes = detectarBordesVerticales(grises);
  const hBordes = detectarBordesHorizontales(grises);

  console.log('🔊 Bordes V:', vBordes.length, 'H:', hBordes.length);

  window.MAR.paso4.verticales = vBordes.map(b => ({ posicion: b.posicion, votos: 1, cobertura: b.cobertura }));
  window.MAR.paso4.horizontales = hBordes.map(b => ({ posicion: b.posicion, votos: 1, cobertura: b.cobertura }));
  window.MAR.paso4.tiempoMs = Math.round(performance.now() - t0);
  window.MAR.paso4.ejecutado = true;

  if (typeof dibujarLineasPaso === 'function') {
    dibujarLineasPaso(4, vBordes.map(b => b.posicion), hBordes.map(b => b.posicion));
    actualizarContadores(vBordes.length, hBordes.length);
  }

  if (typeof setProgreso === 'function') setProgreso(100, '¡Paso 4!');
  return window.MAR.paso4;
}

function debugPaso4() {
  const p = window.MAR.paso4;
  return `PASO 4: ECOGRAFÍA
⏱️ ${p.tiempoMs} ms
📊 Verticales: ${p.verticales.length}
📊 Horizontales: ${p.horizontales.length}
⚙️ Cobertura mínima: ${PARAMS_PASO4.COBERTURA_MIN * 100}%`;
}
