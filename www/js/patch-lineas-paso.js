// ==============================================
// PATCH v10.0.7: Guardar líneas por paso
// ==============================================

// Guardar funciones originales
window._ejecutarPaso3OpticaOriginal = ejecutarPaso3Optica;
window._ejecutarPaso4EcografiaOriginal = ejecutarPaso4Ecografia;

// PASO 3: Óptica
ejecutarPaso3Optica = async function() {
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

  // Detectar líneas con umbral MUY BAJO (para ver TODAS)
  const maxEcoH = Math.max(...ecoH);
  const maxEcoV = Math.max(...ecoV);
  const umbralH = Math.max(15, maxEcoH * 0.20);
  const umbralV = Math.max(15, maxEcoV * 0.20);

  // Guardar TODAS las líneas de Óptica (con umbral bajo)
  const opticaH = [];
  const opticaV = [];

  for(let y=1; y<alto-1; y++) {
    if(ecoH[y] > umbralH) {
      opticaH.push(y);
    }
  }
  for(let x=1; x<ancho-1; x++) {
    if(ecoV[x] > umbralV) {
      opticaV.push(x);
    }
  }

  window.lineasOpticaH = opticaH;
  window.lineasOpticaV = opticaV;

  log('   • Líneas Óptica H (amarillas): ' + opticaH.length, 'info');
  log('   • Líneas Óptica V (amarillas): ' + opticaV.length, 'info');

  // Redibujar con las líneas de Óptica
  if (typeof dibujarTodasLasLineas === 'function') {
    dibujarTodasLasLineas();
  }

  marcarPasoCompletado(3);
  actualizarProgreso(33);

  log('✅ PASO 3 COMPLETADO', 'exito');
  log('   🟡 Líneas amarillas = Detección de Óptica', 'info');
  log('   → Puedes continuar con el paso 4', 'info');
};

// PASO 4: Ecografía
ejecutarPaso4Ecografia = async function() {
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

  // Detectar horizontales con validación
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

  // Detectar verticales con validación
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

  window.lineasEcografiaH = lineasH;
  window.lineasEcografiaV = lineasV;
  window.estadoPasos.lineasH = lineasH;
  window.estadoPasos.lineasV = lineasV;
  window.estadoPasos.paso4Completado = true;

  log('   • Líneas Ecografía H (rojas): ' + lineasH.length, 'info');
  log('   • Líneas Ecografía V (azules): ' + lineasV.length, 'info');

  // Redibujar con todas las líneas
  if (typeof dibujarTodasLasLineas === 'function') {
    dibujarTodasLasLineas();
  }

  marcarPasoCompletado(4);
  actualizarProgreso(44);

  log('✅ PASO 4 COMPLETADO', 'exito');
  log('   🟡 Amarillo = Óptica | 🔴 Rojo = Ecografía H | 🔵 Azul = Ecografía V', 'info');
  log('   → Puedes continuar con el paso 6 (LIDAR)', 'info');
};

console.log('✅ Patch v10.0.7 cargado: Guardar líneas por paso');
