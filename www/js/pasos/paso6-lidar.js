const PARAMS_PASO6 = {
  TOLERANCIA_ALINEACION: 12,
  DISTANCIA_AGRUPACION: 8,
  RECORRIDO_BORDE: true,
  PESO_PATRON_REGULAR: 0.70,
  VOTOS_MINIMOS: 2
};

window.MAR = window.MAR || {};
window.MAR.paso6 = { ejecutado: false, verticales: [], horizontales: [], votosV: [], votosH: [], tiempoMs: 0 };

function votar(algoritmos, distAgrup, votosMin) {
  const todos = [];
  for (let i = 0; i < algoritmos.length; i++) {
    for (const c of algoritmos[i]) {
      const pos = c.posicion !== undefined ? c.posicion : c;
      todos.push({ pos, alg: i });
    }
  }
  if (todos.length === 0) return [];
  todos.sort((a, b) => a.pos - b.pos);

  const grupos = [];
  let grupo = [todos[0]];
  for (let i = 1; i < todos.length; i++) {
    if (todos[i].pos - grupo[grupo.length-1].pos <= distAgrup) {
      grupo.push(todos[i]);
    } else {
      grupos.push(grupo);
      grupo = [todos[i]];
    }
  }
  grupos.push(grupo);

  const confirmados = [];
  for (const g of grupos) {
    const promedio = Math.round(g.reduce((s, x) => s + x.pos, 0) / g.length);
    const algs = new Set(g.map(x => x.alg));
    if (algs.size >= votosMin) {
      confirmados.push({ posicion: promedio, votos: algs.size });
    }
  }
  return confirmados;
}

function validarPatron(cortes) {
  if (cortes.length < 3) return cortes;
  const dists = [];
  for (let i = 1; i < cortes.length; i++) dists.push(cortes[i].posicion - cortes[i-1].posicion);
  const conteo = {};
  for (const d of dists) {
    const k = Math.round(d / 5) * 5;
    conteo[k] = (conteo[k] || 0) + 1;
  }
  let distComun = 0, maxR = 0;
  for (const [k, v] of Object.entries(conteo)) {
    if (v > maxR) { maxR = v; distComun = parseInt(k); }
  }
  const filtrados = [cortes[0]];
  for (let i = 1; i < cortes.length; i++) {
    const d = cortes[i].posicion - filtrados[filtrados.length-1].posicion;
    const ratio = d / distComun;
    if (Math.abs(ratio - Math.round(ratio)) < 0.35) filtrados.push(cortes[i]);
  }
  return filtrados;
}

async function ejecutarPaso6() {
  if (!window.MAR.paso3.ejecutado || !window.MAR.paso4.ejecutado || !window.MAR.paso5.ejecutado) {
    throw new Error('Ejecuta Pasos 3, 4 y 5 primero');
  }
  if (typeof setProgreso === 'function') setProgreso(10, 'Paso 6: LIDAR...');
  const t0 = performance.now();

  const algV = [
    window.MAR.paso3.verticales,
    window.MAR.paso4.verticales,
    window.MAR.paso5.verticales
  ];
  const algH = [
    window.MAR.paso3.horizontales,
    window.MAR.paso4.horizontales,
    window.MAR.paso5.horizontales
  ];

  const votosV = votar(algV, PARAMS_PASO6.DISTANCIA_AGRUPACION, PARAMS_PASO6.VOTOS_MINIMOS);
  const votosH = votar(algH, PARAMS_PASO6.DISTANCIA_AGRUPACION, PARAMS_PASO6.VOTOS_MINIMOS);

  const verticales = validarPatron(votosV);
  const horizontales = validarPatron(votosH);

  window.MAR.paso6.verticales = verticales;
  window.MAR.paso6.horizontales = horizontales;
  window.MAR.paso6.votosV = votosV;
  window.MAR.paso6.votosH = votosH;
  window.MAR.paso6.tiempoMs = Math.round(performance.now() - t0);
  window.MAR.paso6.ejecutado = true;

  // Limpiar canvas y dibujar SOLO las finales
  const img = document.getElementById('imgPreview');
  const canvas = document.getElementById('deteccionCanvas');
  if (img && canvas) {
    canvas.width = img.clientWidth;
    canvas.height = img.clientHeight;
    dibujarLineasPaso(6, verticales, horizontales);
  }
  actualizarContadores(verticales.length, horizontales.length);

  if (typeof setProgreso === 'function') setProgreso(100, '¡Paso 6!');
  return window.MAR.paso6;
}

function debugPaso6() {
  const p = window.MAR.paso6;
  const vStr = p.votosV.slice(0, 8).map(v => `${v.posicion}(${v.votos}v)`).join(', ');
  const hStr = p.votosH.slice(0, 8).map(h => `${h.posicion}(${h.votos}v)`).join(', ');
  return `PASO 6: LIDAR
⏱️ ${p.tiempoMs} ms
📊 Verticales FINALES: ${p.verticales.length}
📊 Horizontales FINALES: ${p.horizontales.length}

📋 Detalle verticales:
${vStr}${p.votosV.length > 8 ? '...' : ''}

📋 Detalle horizontales:
${hStr}${p.votosH.length > 8 ? '...' : ''}

💡 META: 21 columnas → 22V, 10 filas → 11H`;
}
