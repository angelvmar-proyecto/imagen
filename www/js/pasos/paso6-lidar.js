// ============================================
// PASO 6: LIDAR - Ordenar, Agrupar, Validar
// Combina los cortes de los 3 algoritmos
// ============================================

const PARAMS_PASO6 = {
  TOLERANCIA_ALINEACION: 12,
  DISTANCIA_AGRUPACION: 8,
  RECORRIDO_BORDE: true,
  PESO_PATRON_REGULAR: 0.70,
  VOTOS_MINIMOS: 2
};

window.MAR = window.MAR || {};
window.MAR.paso6 = {
  ejecutado: false,
  verticales: [],
  horizontales: [],
  votosV: [],
  votosH: [],
  tiempoMs: 0
};

// Votación entre algoritmos
function votar(algoritmos, distanciaAgrupacion, votosMinimos) {
  const todos = [];
  for (let i = 0; i < algoritmos.length; i++) {
    for (const c of algoritmos[i]) {
      todos.push({ pos: c, alg: i });
    }
  }
  if (todos.length === 0) return [];
  
  todos.sort((a, b) => a.pos - b.pos);

  const grupos = [];
  let grupoActual = [todos[0]];
  
  for (let i = 1; i < todos.length; i++) {
    if (todos[i].pos - grupoActual[grupoActual.length - 1].pos <= distanciaAgrupacion) {
      grupoActual.push(todos[i]);
    } else {
      grupos.push(grupoActual);
      grupoActual = [todos[i]];
    }
  }
  grupos.push(grupoActual);

  const confirmados = [];
  for (const grupo of grupos) {
    const promedio = Math.round(grupo.reduce((s, g) => s + g.pos, 0) / grupo.length);
    const algsUnicos = new Set(grupo.map(g => g.alg));
    
    if (algsUnicos.size >= votosMinimos) {
      confirmados.push({
        posicion: promedio,
        votos: algsUnicos.size,
        algoritmos: Array.from(algsUnicos)
      });
    }
  }
  return confirmados;
}

// Ajuste LIDAR: validar por patrón regular
function validarPatron(cortes) {
  if (cortes.length < 3) return cortes;

  const distancias = [];
  for (let i = 1; i < cortes.length; i++) {
    distancias.push(cortes[i].posicion - cortes[i - 1].posicion);
  }

  // Distancia más común
  const conteo = {};
  for (const d of distancias) {
    const key = Math.round(d / 5) * 5;
    conteo[key] = (conteo[key] || 0) + 1;
  }

  let distanciaComun = 0, maxRep = 0;
  for (const [k, c] of Object.entries(conteo)) {
    if (c > maxRep) { maxRep = c; distanciaComun = parseInt(k); }
  }

  // Filtrar cortes que no sigan el patrón
  const filtrados = [cortes[0]];
  for (let i = 1; i < cortes.length; i++) {
    const d = cortes[i].posicion - filtrados[filtrados.length - 1].posicion;
    const ratio = d / distanciaComun;
    const desviacion = Math.abs(ratio - Math.round(ratio));
    
    if (desviacion < 0.35) {
      filtrados.push(cortes[i]);
    }
  }
  return filtrados;
}

async function ejecutarPaso6() {
  if (!window.MAR.paso3.ejecutado || !window.MAR.paso4.ejecutado || !window.MAR.paso5.ejecutado) {
    alert('⚠️ Primero ejecuta los Pasos 3, 4 y 5.');
    return null;
  }

  if (typeof setProgreso === 'function') setProgreso(10, 'Paso 6: LIDAR...');
  const t0 = performance.now();

  // Recopilar propuestas de los 3 algoritmos
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

  if (typeof setProgreso === 'function') setProgreso(40, 'Votando cortes...');

  const votosV = votar(algV, PARAMS_PASO6.DISTANCIA_AGRUPACION, PARAMS_PASO6.VOTOS_MINIMOS);
  const votosH = votar(algH, PARAMS_PASO6.DISTANCIA_AGRUPACION, PARAMS_PASO6.VOTOS_MINIMOS);

  if (typeof setProgreso === 'function') setProgreso(70, 'Validando patrón...');

  const verticales = validarPatron(votosV);
  const horizontales = validarPatron(votosH);

  window.MAR.paso6.verticales = verticales;
  window.MAR.paso6.horizontales = horizontales;
  window.MAR.paso6.votosV = votosV;
  window.MAR.paso6.votosH = votosH;

  const t1 = performance.now();
  window.MAR.paso6.tiempoMs = Math.round(t1 - t0);
  window.MAR.paso6.ejecutado = true;

  if (typeof setProgreso === 'function') setProgreso(100, '¡Paso 6 completado!');
  if (typeof mostrarStatus === 'function') mostrarStatus(`✅ Paso 6: ${verticales.length}V, ${horizontales.length}H`, 'success');

  actualizarEstadoBoton('paso6', true);
  return window.MAR.paso6;
}

function debugPaso6() {
  const p = window.MAR.paso6;
  if (!p.ejecutado) return '⚠️ Paso 6 no ejecutado aún';

  const votosVStr = p.votosV.slice(0, 5).map(v => `X=${v.posicion}(${v.votos}v)`).join(', ');
  const votosHStr = p.votosH.slice(0, 5).map(v => `Y=${v.posicion}(${v.votos}v)`).join(', ');

  return `
═══════════════════════════════════════
PASO 6: LIDAR
═══════════════════════════════════════

📊 ENTRADA:
   - Algoritmos: Óptica + Ecografía + Espectro

⚙️ PARÁMETROS:
   - Tolerancia alineación: ${PARAMS_PASO6.TOLERANCIA_ALINEACION} px
   - Distancia agrupación: ${PARAMS_PASO6.DISTANCIA_AGRUPACION} px
   - Votos mínimos: ${PARAMS_PASO6.VOTOS_MINIMOS}

⏱️ TIEMPO:
   - Ejecución: ${p.tiempoMs} ms

📈 RESULTADO:
   - Verticales confirmadas: ${p.verticales.length}
     Muestra: ${votosVStr}${p.votosV.length > 5 ? ', ...' : ''}
   
   - Horizontales confirmadas: ${p.horizontales.length}
     Muestra: ${votosHStr}${p.votosH.length > 5 ? ', ...' : ''}

💡 NOTA:
   Cada línea tiene un número de votos (2-3).
   Las líneas con pocos votos pueden ser falsas.
═══════════════════════════════════════`;
}
