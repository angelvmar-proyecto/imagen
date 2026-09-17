// ============================================
// PASO 6: LIDAR
// Votación simple: acepta líneas con 1+ votos
// Mantiene bordes superior e inferior
// ============================================

const PARAMS_PASO6 = {
  DISTANCIA_AGRUPACION: 8,
  VOTOS_MINIMOS: 1,
  TOLERANCIA_ALINEACION: 12,
  PESO_PATRON_REGULAR: 0.70
};

window.MAR = window.MAR || {};
window.MAR.paso6 = { ejecutado: false, verticales: [], horizontales: [], votosV: [], votosH: [], tiempoMs: 0 };

function votar(algoritmos, distAgrup) {
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
    confirmados.push({ posicion: promedio, votos: algs.size });
  }
  return confirmados;
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

  const votosV = votar(algV, PARAMS_PASO6.DISTANCIA_AGRUPACION);
  const votosH = votar(algH, PARAMS_PASO6.DISTANCIA_AGRUPACION);

  // Mantener todas las líneas con 1+ votos
  const verticales = votosV.sort((a, b) => a.posicion - b.posicion);
  const horizontales = votosH.sort((a, b) => a.posicion - b.posicion);

  window.MAR.paso6.verticales = verticales;
  window.MAR.paso6.horizontales = horizontales;
  window.MAR.paso6.votosV = votosV;
  window.MAR.paso6.votosH = votosH;
  window.MAR.paso6.tiempoMs = Math.round(performance.now() - t0);
  window.MAR.paso6.ejecutado = true;

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
  const v3 = p.votosV.filter(v => v.votos === 3).length;
  const v2 = p.votosV.filter(v => v.votos === 2).length;
  const v1 = p.votosV.filter(v => v.votos === 1).length;
  const h3 = p.votosH.filter(v => v.votos === 3).length;
  const h2 = p.votosH.filter(v => v.votos === 2).length;
  const h1 = p.votosH.filter(v => v.votos === 1).length;
  
  return `PASO 6: LIDAR
⏱️ ${p.tiempoMs} ms
📊 Verticales FINALES: ${p.verticales.length}
   Votos: 3v=${v3}, 2v=${v2}, 1v=${v1}
📊 Horizontales FINALES: ${p.horizontales.length}
   Votos: 3v=${h3}, 2v=${h2}, 1v=${h1}

📋 Verticales X: ${p.verticales.map(v => v.posicion).join(', ')}
📋 Horizontales Y: ${p.horizontales.map(h => h.posicion).join(', ')}`;
}
