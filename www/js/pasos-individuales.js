// ==============================================
// MAR Caribe v10.0 - EJECUCIÓN INDIVIDUAL DE PASOS
// Cada paso del grid ejecuta solo su algoritmo
// ==============================================

// Variables globales para guardar el estado
window.estadoPasos = {
  brillo: null,
  ancho: 0,
  alto: 0,
  ecoH: null,
  ecoV: null,
  lineasH: [],
  lineasV: [],
  celdas: [],
  matrizTexto: [],
  matrizColores: [],
  imagenProcesada: null,
  paso1Completado: false,
  paso2Completado: false,
  paso3Completado: false,
  paso4Completado: false,
  paso8Completado: false
};

// ============================================
// FUNCIÓN PRINCIPAL: EJECUTAR PASO INDIVIDUAL
// ============================================
async function ejecutarPasoIndividual(numPaso) {
  if(!imagenActual) {
    log('⚠️ Carga una imagen primero', 'alerta');
    alert('⚠️ Primero carga una imagen');
    return;
  }

  log('═══════════════════════════════════', 'etapa');
  log('🎯 EJECUTANDO PASO ' + numPaso + ' INDIVIDUALMENTE', 'etapa');
  log('═══════════════════════════════════', 'etapa');

  try {
    switch(numPaso) {
      case 1: await ejecutarPaso1Preproc(); break;
      case 2: await ejecutarPaso2Canales(); break;
      case 3: await ejecutarPaso3Optica(); break;
      case 4: await ejecutarPaso4Ecografia(); break;
      case 5: await ejecutarPaso5Espectro(); break;
      case 6: await ejecutarPaso6Lidar(); break;
      case 7: await ejecutarPaso7Editar(); break;
      case 8: await ejecutarPaso8Recortar(); break;
      case 9: await ejecutarPaso9OCR(); break;
      default:
        log('❌ Paso ' + numPaso + ' no implementado', 'error');
    }
  } catch(e) {
    log('❌ Error en paso ' + numPaso + ': ' + e.message, 'error');
    console.error(e);
  }
}

// ============================================
// PASO 1: PREPROCESAMIENTO
// ============================================
async function ejecutarPaso1Preproc() {
  log('🔧 PASO 1: Preprocesamiento', 'etapa');

  // Crear canvas con la imagen original
  const canvasBase = document.createElement('canvas');
  canvasBase.width = imagenActual.width;
  canvasBase.height = imagenActual.height;
  const ctxBase = canvasBase.getContext('2d');
  ctxBase.drawImage(imagenActual, 0, 0);

  const imageData = ctxBase.getImageData(0, 0, canvasBase.width, canvasBase.height);

  // Detectar colores
  const tieneColores_result = tieneColores(imageData);

  log('   • Dimensiones: ' + canvasBase.width + '×' + canvasBase.height, 'info');
  log('   • Colores fuertes: ' + (tieneColores_result ? 'SÍ' : 'NO'), 'info');
  log('   • CRR: DESACTIVADO (puede dañar líneas)', 'alerta');

  // Aplicar BS si hay colores
  if (tieneColores_result) {
    log('   🎨 Aplicando Background Subtraction...', 'info');
    const imageDataBS = aplicarBS(imageData, 30);
    ctxBase.putImageData(imageDataBS, 0, 0);
    log('   ✅ BS aplicado', 'exito');
  } else {
    log('   ⏭️ Sin filtros adicionales', 'info');
  }

  window.estadoPasos.imagenProcesada = canvasBase;
  window.estadoPasos.paso1Completado = true;

  // Actualizar imagen visible
  lienzo.width = canvasBase.width;
  lienzo.height = canvasBase.height;
  ctx.drawImage(canvasBase, 0, 0);

  marcarPasoCompletado(1);
  actualizarProgreso(11);

  log('✅ PASO 1 COMPLETADO', 'exito');
  log('   → Puedes continuar con el paso 2', 'info');
}

// ============================================
// PASO 2: CANALES (Calcular brillo)
// ============================================
async function ejecutarPaso2Canales() {
  log('🎨 PASO 2: Canales (Brillo)', 'etapa');

  // Usar la imagen procesada si existe, sino la original
  const fuente = window.estadoPasos.imagenProcesada || imagenActual;

  const canvasBase = document.createElement('canvas');
  canvasBase.width = fuente.width;
  canvasBase.height = fuente.height;
  const ctxBase = canvasBase.getContext('2d');
  ctxBase.drawImage(fuente, 0, 0);

  const imageData = ctxBase.getImageData(0, 0, canvasBase.width, canvasBase.height);
  const datos = imageData.data;
  const ancho = imageData.width;
  const alto = imageData.height;

  // Calcular brillo
  const brillo = [];
  for(let y=0; y<alto; y++) {
    brillo[y] = [];
    for(let x=0; x<ancho; x++) {
      const i = (y*ancho+x)*4;
      brillo[y][x] = Math.round((datos[i]+datos[i+1]+datos[i+2])/3);
    }
  }

  window.estadoPasos.brillo = brillo;
  window.estadoPasos.ancho = ancho;
  window.estadoPasos.alto = alto;
  window.estadoPasos.paso2Completado = true;

  // Calcular estadísticas
  let sumaBrillo = 0;
  let minBrillo = 255;
  let maxBrillo = 0;
  for(let y=0; y<alto; y++) {
    for(let x=0; x<ancho; x++) {
      sumaBrillo += brillo[y][x];
      if(brillo[y][x] < minBrillo) minBrillo = brillo[y][x];
      if(brillo[y][x] > maxBrillo) maxBrillo = brillo[y][x];
    }
  }
  const promBrillo = Math.round(sumaBrillo / (ancho * alto));

  log('   • Dimensiones: ' + ancho + '×' + alto, 'info');
  log('   • Brillo promedio: ' + promBrillo, 'info');
  log('   • Brillo mínimo: ' + minBrillo, 'info');
  log('   • Brillo máximo: ' + maxBrillo, 'info');

  marcarPasoCompletado(2);
  actualizarProgreso(22);

  log('✅ PASO 2 COMPLETADO', 'exito');
  log('   → Puedes continuar con el paso 3', 'info');
}

// ============================================
// PASO 3: ÓPTICA (Calcular eco)
// ============================================
async function ejecutarPaso3Optica() {
  log('🔭 PASO 3: Óptica (Cálculo de eco)', 'etapa');

  if(!window.estadoPasos.brillo) {
    log('⚠️ Primero ejecuta el paso 2 (Canales)', 'alerta');
    alert('⚠️ Primero ejecuta el paso 2 (Canales)');
    return;
  }

  const brillo = window.estadoPasos.brillo;
  const ancho = window.estadoPasos.ancho;
  const alto = window.estadoPasos.alto;

  // Calcular eco horizontal
  log('   📐 Calculando eco horizontal...', 'info');
  const ecoH = [];
  for(let y=0; y<alto; y++) {
    let s=0, n=0;
    const v0 = Math.max(0, y-3);
    const v1 = Math.min(alto-1, y+3);
    for(let x=0; x<ancho; x++) {
      let m=0;
      for(let yy=v0; yy<=v1; yy++) {
        m = Math.max(m, Math.abs(brillo[y][x] - brillo[yy][x]));
      }
      s += m;
      n++;
    }
    ecoH[y] = s/n;
  }

  // Calcular eco vertical
  log('   📐 Calculando eco vertical...', 'info');
  const ecoV = [];
  for(let x=0; x<ancho; x++) {
    let s=0, n=0;
    const h0 = Math.max(0, x-3);
    const h1 = Math.min(ancho-1, x+3);
    for(let y=0; y<alto; y++) {
      let m=0;
      for(let xx=h0; xx<=h1; xx++) {
        m = Math.max(m, Math.abs(brillo[y][x] - brillo[y][xx]));
      }
      s += m;
      n++;
    }
    ecoV[x] = s/n;
  }

  window.estadoPasos.ecoH = ecoH;
  window.estadoPasos.ecoV = ecoV;
  window.estadoPasos.paso3Completado = true;

  const maxEcoH = Math.max(...ecoH);
  const maxEcoV = Math.max(...ecoV);

  log('   • Eco máximo H: ' + Math.round(maxEcoH), 'info');
  log('   • Eco máximo V: ' + Math.round(maxEcoV), 'info');
  log('   • Eco mínimo H: ' + Math.round(Math.min(...ecoH)), 'info');
  log('   • Eco mínimo V: ' + Math.round(Math.min(...ecoV)), 'info');

  marcarPasoCompletado(3);
  actualizarProgreso(33);

  log('✅ PASO 3 COMPLETADO', 'exito');
  log('   → Puedes continuar con el paso 4', 'info');
}

// ============================================
// PASO 4: ECOGRAFÍA (Detección de líneas)
// ============================================
async function ejecutarPaso4Ecografia() {
  log('🔊 PASO 4: Ecografía (Detección de líneas)', 'etapa');

  if(!window.estadoPasos.ecoH || !window.estadoPasos.ecoV) {
    log('⚠️ Primero ejecuta el paso 3 (Óptica)', 'alerta');
    alert('⚠️ Primero ejecuta el paso 3 (Óptica)');
    return;
  }

  const ecoH = window.estadoPasos.ecoH;
  const ecoV = window.estadoPasos.ecoV;
  const brillo = window.estadoPasos.brillo;
  const ancho = window.estadoPasos.ancho;
  const alto = window.estadoPasos.alto;

  // Umbral adaptativo
  const maxEcoH = Math.max(...ecoH);
  const maxEcoV = Math.max(...ecoV);
  const umbralH = Math.max(15, maxEcoH * 0.20);
  const umbralV = Math.max(15, maxEcoV * 0.20);

  log('   📊 Umbral adaptativo H: ' + Math.round(umbralH), 'info');
  log('   📊 Umbral adaptativo V: ' + Math.round(umbralV), 'info');

  // Detectar horizontales
  const lineasH = [];
  let ult = -9999;
  for(let y=0; y<alto; y++) {
    if(ecoH[y] > umbralH && y - ult >= 18) {
      let f = 0;
      for(let x=0; x<ancho; x++) {
        let m=0;
        for(let yy=Math.max(0,y-2); yy<=Math.min(alto-1,y+2); yy++) {
          m = Math.max(m, Math.abs(brillo[y][x] - brillo[yy][x]));
        }
        if(m > umbralH * 0.5) f++;
      }
      if(f/ancho >= 0.40) {
        lineasH.push(y);
        ult = y;
      }
    }
  }

  // Detectar verticales
  const lineasV = [];
  ult = -9999;
  for(let x=0; x<ancho; x++) {
    if(ecoV[x] > umbralV && x - ult >= 16) {
      let f = 0;
      for(let y=0; y<alto; y++) {
        let m=0;
        for(let xx=Math.max(0,x-2); xx<=Math.min(ancho-1,x+2); xx++) {
          m = Math.max(m, Math.abs(brillo[y][x] - brillo[y][xx]));
        }
        if(m > umbralV * 0.5) f++;
      }
      if(f/alto >= 0.40) {
        lineasV.push(x);
        ult = x;
      }
    }
  }

  window.estadoPasos.lineasH = lineasH;
  window.estadoPasos.lineasV = lineasV;
  window.estadoPasos.paso4Completado = true;

  log('   • Líneas horizontales: ' + lineasH.length, 'exito');
  log('   • Líneas verticales: ' + lineasV.length, 'exito');

  // Dibujar líneas en el canvas
  dibujarLineasEnCanvas(lineasH, lineasV);

  marcarPasoCompletado(4);
  actualizarProgreso(44);

  log('✅ PASO 4 COMPLETADO', 'exito');
  log('   → Revisa las líneas en la imagen', 'info');
}

// ============================================
// PASO 5: ESPECTRO (Placeholder)
// ============================================
async function ejecutarPaso5Espectro() {
  log('📡 PASO 5: Espectro (Detección por color)', 'etapa');
  log('   ⏳ Este paso aún no está implementado individualmente', 'alerta');
  log('   ℹ️ Se ejecuta automáticamente en "Analizar Todo"', 'info');

  marcarPasoCompletado(5);
  actualizarProgreso(55);
  log('✅ PASO 5 COMPLETADO (simulado)', 'exito');
}

// ============================================
// PASO 6: LIDAR (Placeholder)
// ============================================
async function ejecutarPaso6Lidar() {
  log('📐 PASO 6: LIDAR (Ordenamiento)', 'etapa');

  if(window.estadoPasos.lineasH.length === 0) {
    log('⚠️ Primero ejecuta el paso 4 (Ecografía)', 'alerta');
    alert('⚠️ Primero ejecuta el paso 4 (Ecografía)');
    return;
  }

  // Ordenar líneas
  window.estadoPasos.lineasH.sort((a,b)=>a-b);
  window.estadoPasos.lineasV.sort((a,b)=>a-b);

  log('   • Líneas H ordenadas: ' + window.estadoPasos.lineasH.length, 'exito');
  log('   • Líneas V ordenadas: ' + window.estadoPasos.lineasV.length, 'exito');

  // Redibujar
  dibujarLineasEnCanvas(window.estadoPasos.lineasH, window.estadoPasos.lineasV);

  marcarPasoCompletado(6);
  actualizarProgreso(67);
  log('✅ PASO 6 COMPLETADO', 'exito');
}

// ============================================
// PASO 7: EDITAR (Placeholder)
// ============================================
async function ejecutarPaso7Editar() {
  log('✏️ PASO 7: Editar (Manual)', 'etapa');
  log('   ⏳ Edición manual no implementada aún', 'alerta');

  marcarPasoCompletado(7);
  actualizarProgreso(78);
  log('✅ PASO 7 COMPLETADO', 'exito');
}

// ============================================
// PASO 8: RECORTAR
// ============================================
async function ejecutarPaso8Recortar() {
  log('✂️ PASO 8: Recortar (Celdas)', 'etapa');

  const lineasH = window.estadoPasos.lineasH;
  const lineasV = window.estadoPasos.lineasV;

  if(lineasH.length < 2 || lineasV.length < 2) {
    log('⚠️ Primero ejecuta el paso 4 (Ecografía)', 'alerta');
    alert('⚠️ Primero ejecuta el paso 4 (Ecografía)');
    return;
  }

  const celdas = [];
  const numFilas = lineasH.length - 1;
  const numColumnas = lineasV.length - 1;

  for(let f=0; f<numFilas; f++) {
    for(let c=0; c<numColumnas; c++) {
      celdas.push({
        fila: f,
        col: c,
        x1: lineasV[c],
        y1: lineasH[f],
        x2: lineasV[c+1],
        y2: lineasH[f+1]
      });
    }
  }

  window.estadoPasos.celdas = celdas;
  window.estadoPasos.paso8Completado = true;

  log('   • Filas: ' + numFilas, 'exito');
  log('   • Columnas: ' + numColumnas, 'exito');
  log('   • Celdas totales: ' + celdas.length, 'exito');

  marcarPasoCompletado(8);
  actualizarProgreso(89);
  log('✅ PASO 8 COMPLETADO', 'exito');
}

// ============================================
// PASO 9: OCR
// ============================================
async function ejecutarPaso9OCR() {
  log('📄 PASO 9: OCR', 'etapa');

  if(window.estadoPasos.celdas.length === 0) {
    log('⚠️ Primero ejecuta el paso 8 (Recortar)', 'alerta');
    alert('⚠️ Primero ejecuta el paso 8 (Recortar)');
    return;
  }

  log('   → Elige uno de los 3 métodos en la sección "📖 LEER"', 'info');
  log('   ⚡ Rápido / 📊 Medio / 🎯 Preciso', 'info');

  marcarPasoCompletado(9);
  actualizarProgreso(100);
  log('✅ PASO 9 LISTO', 'exito');
}

// ============================================
// FUNCIONES AUXILIARES
// ============================================
function marcarPasoCompletado(numPaso) {
  const paso = document.getElementById('paso' + numPaso);
  if (paso) paso.classList.add('hecho');
}

function dibujarLineasEnCanvas(lineasH, lineasV) {
  // Usar la imagen procesada si existe
  const fuente = window.estadoPasos.imagenProcesada || imagenActual;

  lienzo.width = fuente.width;
  lienzo.height = fuente.height;
  ctx.drawImage(fuente, 0, 0);

  ctx.strokeStyle = '#ff0000';
  ctx.lineWidth = 2;
  lineasH.forEach(y => {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(lienzo.width, y);
    ctx.stroke();
  });

  ctx.strokeStyle = '#0088ff';
  ctx.lineWidth = 2;
  lineasV.forEach(x => {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, lienzo.height);
    ctx.stroke();
  });

  log('   🎨 Líneas dibujadas en el canvas', 'info');
}

console.log('✅ Sistema de pasos individuales cargado');
