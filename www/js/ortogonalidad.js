// ==============================================
// A3 ORTOGONALIDAD - Algoritmo de detección
// Detecta líneas midiendo gradientes ortogonales
// ==============================================

// Variables globales para guardar líneas de A3
window.lineasA3H = [];
window.lineasA3V = [];

// ============================================
// ALGORITMO A3: DETECCIÓN POR ORTOGONALIDAD
// ============================================
function detectarPorOrtogonalidad(brillo, ancho, alto) {
  console.log('🟣 A3: Detectando por ortogonalidad...');

  // PASO 1: Calcular gradientes (Sobel simplificado)
  // gradX = cambio horizontal
  // gradY = cambio vertical
  const gradX = [];
  const gradY = [];
  const magnitud = [];

  for(let y = 0; y < alto; y++) {
    gradX[y] = new Array(ancho).fill(0);
    gradY[y] = new Array(ancho).fill(0);
    magnitud[y] = new Array(ancho).fill(0);
  }

  // Calcular gradientes (kernel Sobel 3x3)
  for(let y = 1; y < alto - 1; y++) {
    for(let x = 1; x < ancho - 1; x++) {
      // Sobel X (detecta bordes verticales)
      const gx = 
        -1 * brillo[y-1][x-1] + 1 * brillo[y-1][x+1] +
        -2 * brillo[y][x-1]   + 2 * brillo[y][x+1] +
        -1 * brillo[y+1][x-1] + 1 * brillo[y+1][x+1];

      // Sobel Y (detecta bordes horizontales)
      const gy = 
        -1 * brillo[y-1][x-1] - 2 * brillo[y-1][x] - 1 * brillo[y-1][x+1] +
         1 * brillo[y+1][x-1] + 2 * brillo[y+1][x] + 1 * brillo[y+1][x+1];

      gradX[y][x] = gx;
      gradY[y][x] = gy;
      magnitud[y][x] = Math.sqrt(gx*gx + gy*gy);
    }
  }

  // PASO 2: Contar píxeles con gradiente ortogonal por fila/columna
  // Para líneas horizontales: el gradiente debe ser vertical (gradY alto)
  // Para líneas verticales: el gradiente debe ser horizontal (gradX alto)

  const UMBRAL_MAGNITUD = 100;  // Mínima magnitud del gradiente
  const UMBRAL_ORTOGONALIDAD = 0.70;  // 70% de ortogonalidad

  // ============================================
  // DETECTAR LÍNEAS HORIZONTALES
  // ============================================
  const lineasH = [];
  
  for(let y = 1; y < alto - 1; y++) {
    let pixelesOrtogonales = 0;
    let pixelesFuertes = 0;

    for(let x = 1; x < ancho - 1; x++) {
      if(magnitud[y][x] > UMBRAL_MAGNITUD) {
        pixelesFuertes++;
        
        // Para línea horizontal, el gradiente debe ser principalmente vertical
        const ratio = Math.abs(gradY[y][x]) / (Math.abs(gradX[y][x]) + Math.abs(gradY[y][x]) + 0.001);
        if(ratio > UMBRAL_ORTOGONALIDAD) {
          pixelesOrtogonales++;
        }
      }
    }

    // Si suficientes píxeles son ortogonales, es una línea horizontal
    if(pixelesFuertes > 0) {
      const cobertura = pixelesOrtogonales / ancho;
      if(cobertura > 0.30) {  // 30% de la fila con gradiente ortogonal
        lineasH.push({ y: y, cobertura: cobertura });
      }
    }
  }

  // ============================================
  // DETECTAR LÍNEAS VERTICALES
  // ============================================
  const lineasV = [];

  for(let x = 1; x < ancho - 1; x++) {
    let pixelesOrtogonales = 0;
    let pixelesFuertes = 0;

    for(let y = 1; y < alto - 1; y++) {
      if(magnitud[y][x] > UMBRAL_MAGNITUD) {
        pixelesFuertes++;
        
        // Para línea vertical, el gradiente debe ser principalmente horizontal
        const ratio = Math.abs(gradX[y][x]) / (Math.abs(gradX[y][x]) + Math.abs(gradY[y][x]) + 0.001);
        if(ratio > UMBRAL_ORTOGONALIDAD) {
          pixelesOrtogonales++;
        }
      }
    }

    if(pixelesFuertes > 0) {
      const cobertura = pixelesOrtogonales / alto;
      if(cobertura > 0.30) {
        lineasV.push({ x: x, cobertura: cobertura });
      }
    }
  }

  // ============================================
  // AGRUPAR LÍNEAS CERCANAS
  // ============================================
  function agruparLineas(lineas, distanciaMin) {
    if(lineas.length === 0) return [];
    
    const agrupadas = [];
    let grupo = [lineas[0]];

    for(let i = 1; i < lineas.length; i++) {
      const actual = lineas[i];
      const anterior = grupo[grupo.length - 1];
      const posActual = actual.y !== undefined ? actual.y : actual.x;
      const posAnterior = anterior.y !== undefined ? anterior.y : anterior.x;

      if(posActual - posAnterior < distanciaMin) {
        grupo.push(actual);
      } else {
        // Promediar el grupo
        const suma = grupo.reduce((s, l) => s + (l.y !== undefined ? l.y : l.x), 0);
        const promedio = Math.round(suma / grupo.length);
        const mejorCobertura = Math.max(...grupo.map(l => l.cobertura));
        
        if(grupo[0].y !== undefined) {
          agrupadas.push({ y: promedio, cobertura: mejorCobertura });
        } else {
          agrupadas.push({ x: promedio, cobertura: mejorCobertura });
        }
        
        grupo = [actual];
      }
    }

    // Último grupo
    if(grupo.length > 0) {
      const suma = grupo.reduce((s, l) => s + (l.y !== undefined ? l.y : l.x), 0);
      const promedio = Math.round(suma / grupo.length);
      const mejorCobertura = Math.max(...grupo.map(l => l.cobertura));
      
      if(grupo[0].y !== undefined) {
        agrupadas.push({ y: promedio, cobertura: mejorCobertura });
      } else {
        agrupadas.push({ x: promedio, cobertura: mejorCobertura });
      }
    }

    return agrupadas;
  }

  const lineasHAgrupadas = agruparLineas(lineasH, 18);
  const lineasVAgrupadas = agruparLineas(lineasV, 16);

  return {
    lineasH: lineasHAgrupadas.map(l => l.y),
    lineasV: lineasVAgrupadas.map(l => l.x),
    detallesH: lineasHAgrupadas,
    detallesV: lineasVAgrupadas
  };
}

// ============================================
// PASO 5 NUEVO: A3 ORTOGONALIDAD
// ============================================
async function ejecutarPaso5A3() {
  log('🟣 PASO 5: A3 Ortogonalidad', 'etapa');

  if(!window.estadoPasos.brillo) {
    log('⚠️ Primero ejecuta el paso 2 (Canales)', 'alerta');
    alert('⚠️ Primero ejecuta el paso 2 (Canales)');
    return;
  }

  const brillo = window.estadoPasos.brillo;
  const ancho = window.estadoPasos.ancho;
  const alto = window.estadoPasos.alto;

  // Detectar líneas por ortogonalidad
  const resultado = detectarPorOrtogonalidad(brillo, ancho, alto);

  window.lineasA3H = resultado.lineasH;
  window.lineasA3V = resultado.lineasV;

  log('   • Líneas A3 H: ' + resultado.lineasH.length, 'exito');
  log('   • Líneas A3 V: ' + resultado.lineasV.length, 'exito');

  // Dibujar solo las líneas de A3 (limpiar canvas)
  const fuente = window.estadoPasos.imagenProcesada || imagenActual;
  lienzo.width = fuente.width;
  lienzo.height = fuente.height;
  ctx.clearRect(0, 0, lienzo.width, lienzo.height);

  ctx.save();
  ctx.translate(desplazamiento.x, desplazamiento.y);
  ctx.scale(zoom, zoom);
  ctx.drawImage(fuente, 0, 0);

  // Líneas moradas de A3
  ctx.strokeStyle = '#8B5CF6';  // Morado
  ctx.lineWidth = 2;

  resultado.lineasH.forEach(y => {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(lienzo.width, y);
    ctx.stroke();
  });

  resultado.lineasV.forEach(x => {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, lienzo.height);
    ctx.stroke();
  });

  ctx.restore();

  marcarPasoCompletado(5);
  actualizarProgreso(55);

  log('✅ PASO 5 COMPLETADO', 'exito');
  log('   🟣 Líneas moradas = ' + resultado.lineasH.length + 'H, ' + resultado.lineasV.length + 'V', 'info');
};

console.log('✅ A3 Ortogonalidad cargado');
