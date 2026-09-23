// ==============================================
// LIDAR — votación + auto-bordes
// ==============================================

function votarLineas(lineas1, lineas2, lineas3, distanciaAgrup) {
  const todos = [];
  lineas1.forEach(pos => todos.push({ pos, alg: 1 }));
  lineas2.forEach(pos => todos.push({ pos, alg: 2 }));
  lineas3.forEach(pos => todos.push({ pos, alg: 3 }));
  if (todos.length === 0) return [];
  todos.sort((a, b) => a.pos - b.pos);

  const grupos = [];
  let grupo = [todos[0]];
  for (let i = 1; i < todos.length; i++) {
    if (todos[i].pos - grupo[grupo.length - 1].pos <= distanciaAgrup) {
      grupo.push(todos[i]);
    } else {
      grupos.push(grupo);
      grupo = [todos[i]];
    }
  }
  grupos.push(grupo);

  const confirmados = [];
  grupos.forEach(g => {
    const algs = new Set(g.map(x => x.alg));
    const posicion = Math.round(g.reduce((s, x) => s + x.pos, 0) / g.length);
    confirmados.push({ posicion, votos: algs.size, algoritmos: Array.from(algs) });
  });
  return confirmados;
}

function clasificarLinea(votos, eco) {
  if (votos >= 3 && eco >= CONFIG.LIDAR_ECO_ALTO) return { aceptar: true, razon: '3v+eco alto' };
  if (votos >= CONFIG.LIDAR_VOTOS_MINIMOS && eco >= CONFIG.LIDAR_ECO_ALTO) return { aceptar: true, razon: '2v+eco alto' };
  if (votos >= 3 && eco < CONFIG.LIDAR_ECO_BAJO) return { aceptar: false, razon: '3v eco bajo' };
  if (votos >= 3 && eco >= CONFIG.LIDAR_ECO_BAJO) return { aceptar: true, razon: '3v+eco medio' };
  if (votos >= 2 && eco >= CONFIG.LIDAR_ECO_BAJO) return { aceptar: true, razon: '2v+eco medio' };
  if (votos < CONFIG.LIDAR_VOTOS_MINIMOS) return { aceptar: false, razon: votos + 'v' };
  if (votos >= 2 && eco < CONFIG.LIDAR_ECO_BAJO) return { aceptar: false, razon: '2v eco bajo' };
  return { aceptar: false, razon: 'no cumple' };
}

function ejecutarLidar(opticaH, opticaV, ecoH, ecoV, a3H, a3V, brillo, ancho, alto) {
  console.log('📐 LIDAR: votación + eco');

  const distH = Math.max(CONFIG.LIDAR_AGRUPAR_DIST, Math.round(alto / 300));
  const distV = Math.max(CONFIG.LIDAR_AGRUPAR_DIST, Math.round(ancho / 300));

  const votosH = votarLineas(opticaH, ecoH, a3H, distH);
  const analisisH = votosH.map(v => {
    const eco = medirEcoLineaH(v.posicion, brillo, alto, ancho, CONFIG.ECO_VENTANA);
    const clasif = clasificarLinea(v.votos, eco);
    return { posicion: v.posicion, votos: v.votos, eco: Math.round(eco), aceptar: clasif.aceptar };
  });

  const votosV = votarLineas(opticaV, ecoV, a3V, distV);
  const analisisV = votosV.map(v => {
    const eco = medirEcoLineaV(v.posicion, brillo, alto, ancho, CONFIG.ECO_VENTANA);
    const clasif = clasificarLinea(v.votos, eco);
    return { posicion: v.posicion, votos: v.votos, eco: Math.round(eco), aceptar: clasif.aceptar };
  });

  const lineasHFinal = analisisH.filter(a => a.aceptar).map(a => a.posicion).sort((a, b) => a - b);
  const lineasVFinal = analisisV.filter(a => a.aceptar).map(a => a.posicion).sort((a, b) => a - b);

  const MARGEN = CONFIG.LIDAR_MARGEN_BORDE;

  if (lineasVFinal.length > 0) {
    if (lineasVFinal[0] > MARGEN) lineasVFinal.unshift(0);
    const ult = lineasVFinal[lineasVFinal.length - 1];
    if (ult < ancho - MARGEN) lineasVFinal.push(ancho - 1);
  }
  if (lineasHFinal.length > 0) {
    if (lineasHFinal[0] > MARGEN) lineasHFinal.unshift(0);
    const ult = lineasHFinal[lineasHFinal.length - 1];
    if (ult < alto - MARGEN) lineasHFinal.push(alto - 1);
  }

  console.log('   ✅ Aceptadas: ' + lineasHFinal.length + 'H, ' + lineasVFinal.length + 'V');
  return { lineasH: lineasHFinal, lineasV: lineasVFinal };
}

function recortarCeldas(lineasH, lineasV) {
  const celdas = [];
  const nf = lineasH.length - 1;
  const nc = lineasV.length - 1;
  for (let f = 0; f < nf; f++) {
    for (let c = 0; c < nc; c++) {
      celdas.push({
        fila: f, col: c,
        x1: lineasV[c], y1: lineasH[f],
        x2: lineasV[c + 1], y2: lineasH[f + 1]
      });
    }
  }
  return celdas;
}

console.log('✅ LIDAR cargado');
