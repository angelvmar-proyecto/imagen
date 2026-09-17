// ============================================
// PASO 6: LIDAR (v9.3)
// - Votos mínimos 1
// - Sin validación de patrón regular
// - Cobertura mínima 50%
// - Prioriza líneas con 2+ algoritmos
// ============================================

const PARAMS_PASO6 = {
  DISTANCIA_AGRUPACION: 8,
  VOTOS_MINIMOS: 1,
  COBERTURA_MIN: 0.50
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

// Ordenar por votos descendente (más votos = más confiable)
function ordenarPorVotos(cortes) {
  return cortes.sort((a, b) => b.votos - a.votos);
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

  // Ordenar por votos (más votos primero)
  const verticalesOrdenadas = ordenarPorVotos([...votosV]);
  const horizontalesOrdenadas = ordenarPorVotos([...votosH]);

  console.log('🗳️ Votos V:', votosV.length, 'H:', votosH.length);
  console.log('📊 Distribución V:', votosV.map(v => v.votos).join(','));
  console.log('📊 Distribución H:', votosH.map(v => v.votos).join(','));

  window.MAR.paso6.verticales = verticalesOrdenadas.sort((a, b) => a.posicion - b.posicion);
  window.MAR.paso6.horizontales = horizontalesOrdenadas.sort((a, b) => a.posicion - b.posicion);
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
    dibujarLineasPaso(6, window.MAR.paso6.verticales, window.MAR.paso6.horizontales);
  }
  actualizarContadores(window.MAR.paso6.verticales.length, window.MAR.paso6.horizontales.length);

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
   3 votos: ${v3}, 2 votos: ${v2}, 1 voto: ${v1}
📊 Horizontales FINALES: ${p.horizontales.length}
   3 votos: ${h3}, 2 votos: ${h2}, 1 voto: ${h1}

💡 Los votos indican cuántos algoritmos coinciden:
   - 3 votos: Óptica + Ecografía + Espectro (muy confiable)
   - 2 votos: al menos 2 coinciden (confiable)
   - 1 voto: solo 1 algoritmo lo detectó (posible pero menos seguro)`;
}
