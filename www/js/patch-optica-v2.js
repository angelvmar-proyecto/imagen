// ==============================================
// PATCH v10.3: Óptica con distancia mínima V = 40px
// Reduce falsos positivos en verticales
// ==============================================

// Sobrescribir la función del paso 3 (Óptica)
window._ejecutarPaso3Original_v2 = ejecutarPaso3Optica;

ejecutarPaso3Optica = async function() {
  log('🔭 PASO 3: Óptica (Perfil de Proyección)', 'etapa');

  if(!window.estadoPasos.brillo) {
    log('⚠️ Primero ejecuta el paso 2 (Canales)', 'alerta');
    alert('⚠️ Primero ejecuta el paso 2 (Canales)');
    return;
  }

  const brillo = window.estadoPasos.brillo;
  const ancho = window.estadoPasos.ancho;
  const alto = window.estadoPasos.alto;

  // ============================================
  // PASO 1: CALCULAR PERFIL DE PROYECCIÓN
  // ============================================
  log('   📐 Calculando perfil de proyección...', 'info');

  // Perfil horizontal (contar píxeles oscuros por fila)
  const perfilH = new Array(alto).fill(0);
  for(let y=0; y<alto; y++) {
    let contador = 0;
    for(let x=0; x<ancho; x++) {
      if(brillo[y][x] < 128) contador++;
    }
    perfilH[y] = contador;
  }

  // Perfil vertical (contar píxeles oscuros por columna)
  const perfilV = new Array(ancho).fill(0);
  for(let x=0; x<ancho; x++) {
    let contador = 0;
    for(let y=0; y<alto; y++) {
      if(brillo[y][x] < 128) contador++;
    }
    perfilV[x] = contador;
  }

  log('   ✅ Perfil H calculado (máx: ' + Math.max(...perfilH) + ')', 'exito');
  log('   ✅ Perfil V calculado (máx: ' + Math.max(...perfilV) + ')', 'exito');

  // ============================================
  // PASO 2: SUAVIZAR
  // ============================================
  function suavizar(arr, ventana) {
    const resultado = new Array(arr.length);
    const mitad = Math.floor(ventana / 2);
    for(let i=0; i<arr.length; i++) {
      let suma = 0, count = 0;
      for(let j=-mitad; j<=mitad; j++) {
        const idx = i + j;
        if(idx >= 0 && idx < arr.length) {
          suma += arr[idx];
          count++;
        }
      }
      resultado[i] = suma / count;
    }
    return resultado;
  }

  const perfilHSuave = suavizar(perfilH, 3);
  const perfilVSuave = suavizar(perfilV, 3);

  // ============================================
  // PASO 3: DETECTAR VALLES
  // ============================================
  log('   🔍 Detectando valles...', 'info');

  const maxH = Math.max(...perfilHSuave);
  const maxV = Math.max(...perfilVSuave);
  const umbralH = maxH * 0.30;
  const umbralV = maxV * 0.30;

  // ✅ CAMBIO: Distancia mínima V aumentada a 40px
  const distanciaMinH = 18;
  const distanciaMinV = 40;  // ← ANTES ERA 16

  log('   📊 Distancia mínima H: ' + distanciaMinH + 'px', 'info');
  log('   📊 Distancia mínima V: ' + distanciaMinV + 'px (REDUCIR FALSOS POSITIVOS)', 'info');

  // Detectar valles horizontales
  const vallesH = [];
  for(let y=2; y<alto-2; y++) {
    if(perfilHSuave[y] < umbralH &&
       perfilHSuave[y] <= perfilHSuave[y-1] &&
       perfilHSuave[y] <= perfilHSuave[y+1] &&
       perfilHSuave[y] < perfilHSuave[y-2] &&
       perfilHSuave[y] < perfilHSuave[y+2]) {
      
      if(vallesH.length === 0 || y - vallesH[vallesH.length-1] >= distanciaMinH) {
        vallesH.push(y);
      } else {
        if(perfilHSuave[y] < perfilHSuave[vallesH[vallesH.length-1]]) {
          vallesH[vallesH.length-1] = y;
        }
      }
    }
  }

  // Detectar valles verticales
  const vallesV = [];
  for(let x=2; x<ancho-2; x++) {
    if(perfilVSuave[x] < umbralV &&
       perfilVSuave[x] <= perfilVSuave[x-1] &&
       perfilVSuave[x] <= perfilVSuave[x+1] &&
       perfilVSuave[x] < perfilVSuave[x-2] &&
       perfilVSuave[x] < perfilVSuave[x+2]) {
      
      if(vallesV.length === 0 || x - vallesV[vallesV.length-1] >= distanciaMinV) {
        vallesV.push(x);
      } else {
        if(perfilVSuave[x] < perfilVSuave[vallesV[vallesV.length-1]]) {
          vallesV[vallesV.length-1] = x;
        }
      }
    }
  }

  log('   ✅ Valles H detectados: ' + vallesH.length, 'exito');
  log('   ✅ Valles V detectados: ' + vallesV.length, 'exito');

  // ============================================
  // PASO 4: GUARDAR
  // ============================================
  window.lineasOpticaH = vallesH;
  window.lineasOpticaV = vallesV;
  window.estadoPasos.ecoH = perfilHSuave;
  window.estadoPasos.ecoV = perfilVSuave;
  window.estadoPasos.paso3Completado = true;

  // ============================================
  // PASO 5: DIBUJAR
  // ============================================
  const fuente = window.estadoPasos.imagenProcesada || imagenActual;
  lienzo.width = fuente.width;
  lienzo.height = fuente.height;
  ctx.clearRect(0, 0, lienzo.width, lienzo.height);

  ctx.save();
  ctx.translate(desplazamiento.x, desplazamiento.y);
  ctx.scale(zoom, zoom);
  ctx.drawImage(fuente, 0, 0);

  // Líneas amarillas de Óptica
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 2;
  vallesH.forEach(y => {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(lienzo.width, y);
    ctx.stroke();
  });
  vallesV.forEach(x => {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, lienzo.height);
    ctx.stroke();
  });

  ctx.restore();

  marcarPasoCompletado(3);
  actualizarProgreso(33);

  log('✅ PASO 3 COMPLETADO', 'exito');
  log('   🟡 Líneas amarillas = ' + vallesH.length + 'H, ' + vallesV.length + 'V', 'info');
  log('   → Verticales reducidas por distancia mínima 40px', 'info');
};

console.log('✅ Patch v10.3 cargado: Óptica con distancia V = 40px');
