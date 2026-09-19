// ==============================================
// LIDAR con VOTACIÓN REAL entre Óptica + Ecografía + A3
// ==============================================

// Sobrescribir la función del paso 6
window._ejecutarPaso6Original = ejecutarPaso6Lidar;

ejecutarPaso6Lidar = async function() {
  log('📐 PASO 6: LIDAR (Votación real)', 'etapa');

  // Recopilar votos de los 3 algoritmos
  const opticaH = window.lineasOpticaH || [];
  const opticaV = window.lineasOpticaV || [];
  const ecografiaH = window.lineasEcografiaH || [];
  const ecografiaV = window.lineasEcografiaV || [];
  const a3H = window.lineasA3H || [];
  const a3V = window.lineasA3V || [];

  log('   📊 Votos recibidos:', 'info');
  log('      🟡 Óptica: ' + opticaH.length + 'H, ' + opticaV.length + 'V', 'info');
  log('      🔴🔵 Ecografía: ' + ecografiaH.length + 'H, ' + ecografiaV.length + 'V', 'info');
  log('      🟣 A3: ' + a3H.length + 'H, ' + a3V.length + 'V', 'info');

  // ============================================
  // VOTACIÓN: agrupar líneas cercanas y contar votos
  // ============================================
  function votar(lineas1, lineas2, lineas3, distanciaMin) {
    const todos = [];
    
    // Agregar votos de cada algoritmo
    lineas1.forEach(pos => todos.push({ pos: pos, alg: 1 }));
    lineas2.forEach(pos => todos.push({ pos: pos, alg: 2 }));
    lineas3.forEach(pos => todos.push({ pos: pos, alg: 3 }));

    if(todos.length === 0) return [];

    // Ordenar por posición
    todos.sort((a, b) => a.pos - b.pos);

    // Agrupar líneas cercanas
    const grupos = [];
    let grupo = [todos[0]];

    for(let i = 1; i < todos.length; i++) {
      if(todos[i].pos - grupo[grupo.length-1].pos <= distanciaMin) {
        grupo.push(todos[i]);
      } else {
        grupos.push(grupo);
        grupo = [todos[i]];
      }
    }
    grupos.push(grupo);

    // Contar votos por grupo (algoritmos únicos)
    const confirmados = [];
    grupos.forEach(g => {
      const algoritmos = new Set(g.map(x => x.alg));
      const posicionPromedio = Math.round(g.reduce((s, x) => s + x.pos, 0) / g.length);
      
      confirmados.push({
        posicion: posicionPromedio,
        votos: algoritmos.size,
        algoritmos: Array.from(algoritmos)
      });
    });

    return confirmados;
  }

  const votosH = votar(opticaH, ecografiaH, a3H, 18);
  const votosV = votar(opticaV, ecografiaV, a3V, 16);

  log('   🗳️ Votación:', 'info');
  log('      H: ' + votosH.length + ' grupos', 'info');
  log('      V: ' + votosV.length + ' grupos', 'info');

  // ============================================
  // FILTRAR: solo líneas con 2+ votos
  // ============================================
  const VOTOS_MINIMOS = 2;
  
  const lineasHFinal = votosH.filter(v => v.votos >= VOTOS_MINIMOS).map(v => v.posicion);
  const lineasVFinal = votosV.filter(v => v.votos >= VOTOS_MINIMOS).map(v => v.posicion);

  log('   ✅ Líneas con ' + VOTOS_MINIMOS + '+ votos:', 'exito');
  log('      H: ' + lineasHFinal.length, 'exito');
  log('      V: ' + lineasVFinal.length, 'exito');

  // Estadísticas de votos
  const h3 = votosH.filter(v => v.votos === 3).length;
  const h2 = votosH.filter(v => v.votos === 2).length;
  const h1 = votosH.filter(v => v.votos === 1).length;
  const v3 = votosV.filter(v => v.votos === 3).length;
  const v2 = votosV.filter(v => v.votos === 2).length;
  const v1 = votosV.filter(v => v.votos === 1).length;

  log('   📊 Distribución H: 3v=' + h3 + ', 2v=' + h2 + ', 1v=' + h1, 'info');
  log('   📊 Distribución V: 3v=' + v3 + ', 2v=' + v2 + ', 1v=' + v1, 'info');

  // Guardar líneas finales
  window.lineasHGlobal = lineasHFinal;
  window.lineasVGlobal = lineasVFinal;
  window.estadoPasos.lineasH = lineasHFinal;
  window.estadoPasos.lineasV = lineasVFinal;

  // ============================================
  // DIBUJAR LÍNEAS FINALES (negras)
  // ============================================
  const fuente = window.estadoPasos.imagenProcesada || imagenActual;
  lienzo.width = fuente.width;
  lienzo.height = fuente.height;
  ctx.clearRect(0, 0, lienzo.width, lienzo.height);

  ctx.save();
  ctx.translate(desplazamiento.x, desplazamiento.y);
  ctx.scale(zoom, zoom);
  ctx.drawImage(fuente, 0, 0);

  // Líneas negras finales
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;

  lineasHFinal.forEach(y => {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(lienzo.width, y);
    ctx.stroke();
  });

  lineasVFinal.forEach(x => {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, lienzo.height);
    ctx.stroke();
  });

  ctx.restore();

  marcarPasoCompletado(6);
  actualizarProgreso(67);

  log('✅ PASO 6 COMPLETADO', 'exito');
  log('   ⚫ Líneas negras = ' + lineasHFinal.length + 'H, ' + lineasVFinal.length + 'V (FINALES)', 'info');
};

console.log('✅ LIDAR con votación real cargado');
