// ==============================================
// Detección de líneas — Óptica + A3 + Ecografía
// ==============================================

function detectarOptica(brillo, ancho, alto) {
  console.log('🔭 Óptica: perfil de proyección');

  const perfilH = new Array(alto).fill(0);
  for (let y = 0; y < alto; y++) {
    let contador = 0;
    for (let x = 0; x < ancho; x++) {
      if (brillo[y][x] < 128) contador++;
    }
    perfilH[y] = contador;
  }

  const perfilV = new Array(ancho).fill(0);
  for (let x = 0; x < ancho; x++) {
    let contador = 0;
    for (let y = 0; y < alto; y++) {
      if (brillo[y][x] < 128) contador++;
    }
    perfilV[x] = contador;
  }

  const perfilHSuave = suavizar(perfilH, CONFIG.OPTICA_SUAVIZADO);
  const perfilVSuave = suavizar(perfilV, CONFIG.OPTICA_SUAVIZADO);

  const maxH = maxSeguro(perfilHSuave);
  const maxV = maxSeguro(perfilVSuave);
  const umbralH = maxH * CONFIG.OPTICA_UMBRAL_ADAPTATIVO;
  const umbralV = maxV * CONFIG.OPTICA_UMBRAL_ADAPTATIVO;

  const lineasH = [];
  for (let y = 2; y < alto - 2; y++) {
    if (perfilHSuave[y] < umbralH &&
        perfilHSuave[y] <= perfilHSuave[y - 1] &&
        perfilHSuave[y] <= perfilHSuave[y + 1] &&
        perfilHSuave[y] < perfilHSuave[y - 2] &&
        perfilHSuave[y] < perfilHSuave[y + 2]) {
      if (lineasH.length === 0 ||
          y - lineasH[lineasH.length - 1] >= CONFIG.OPTICA_DISTANCIA_MIN_H) {
        lineasH.push(y);
      } else if (perfilHSuave[y] < perfilHSuave[lineasH[lineasH.length - 1]]) {
        lineasH[lineasH.length - 1] = y;
      }
    }
  }

  const lineasV = [];
  for (let x = 2; x < ancho - 2; x++) {
    if (perfilVSuave[x] < umbralV &&
        perfilVSuave[x] <= perfilVSuave[x - 1] &&
        perfilVSuave[x] <= perfilVSuave[x + 1] &&
        perfilVSuave[x] < perfilVSuave[x - 2] &&
        perfilVSuave[x] < perfilVSuave[x + 2]) {
      if (lineasV.length === 0 ||
          x - lineasV[lineasV.length - 1] >= CONFIG.OPTICA_DISTANCIA_MIN_V) {
        lineasV.push(x);
      } else if (perfilVSuave[x] < perfilVSuave[lineasV[lineasV.length - 1]]) {
        lineasV[lineasV.length - 1] = x;
      }
    }
  }

  console.log(`   → ${lineasH.length}H, ${lineasV.length}V`);
  return { lineasH, lineasV, perfilH: perfilHSuave, perfilV: perfilVSuave };
}

function detectarA3(brillo, ancho, alto) {
  console.log('🟣 A3: ortogonalidad (Sobel)');

  const gradX = [], gradY = [], magnitud = [];
  for (let y = 0; y < alto; y++) {
    gradX[y] = new Array(ancho).fill(0);
    gradY[y] = new Array(ancho).fill(0);
    magnitud[y] = new Array(ancho).fill(0);
  }

  for (let y = 1; y < alto - 1; y++) {
    for (let x = 1; x < ancho - 1; x++) {
      const gx = -1 * brillo[y-1][x-1] + 1 * brillo[y-1][x+1]
              + -2 * brillo[y][x-1]   + 2 * brillo[y][x+1]
              + -1 * brillo[y+1][x-1] + 1 * brillo[y+1][x+1];
      const gy = -1 * brillo[y-1][x-1] - 2 * brillo[y-1][x] - 1 * brillo[y-1][x+1]
              +  1 * brillo[y+1][x-1] + 2 * brillo[y+1][x] + 1 * brillo[y+1][x+1];
      gradX[y][x] = gx;
      gradY[y][x] = gy;
      magnitud[y][x] = Math.sqrt(gx * gx + gy * gy);
    }
  }

  const lineasH = [];
  for (let y = 1; y < alto - 1; y++) {
    let ortogonales = 0;
    for (let x = 1; x < ancho - 1; x++) {
      if (magnitud[y][x] > CONFIG.A3_UMBRAL_MAGNITUD) {
        const ratio = Math.abs(gradY[y][x]) /
          (Math.abs(gradX[y][x]) + Math.abs(gradY[y][x]) + 0.001);
        if (ratio > CONFIG.A3_UMBRAL_ORTOGONALIDAD) ortogonales++;
      }
    }
    if (ortogonales / ancho > CONFIG.A3_COBERTURA_MINIMA) lineasH.push(y);
  }

  const lineasV = [];
  for (let x = 1; x < ancho - 1; x++) {
    let ortogonales = 0;
    for (let y = 1; y < alto - 1; y++) {
      if (magnitud[y][x] > CONFIG.A3_UMBRAL_MAGNITUD) {
        const ratio = Math.abs(gradX[y][x]) /
          (Math.abs(gradX[y][x]) + Math.abs(gradY[y][x]) + 0.001);
        if (ratio > CONFIG.A3_UMBRAL_ORTOGONALIDAD) ortogonales++;
      }
    }
    if (ortogonales / alto > CONFIG.A3_COBERTURA_MINIMA) lineasV.push(x);
  }

  const lineasHFiltradas = filtrarLineasCercanas(lineasH, CONFIG.A3_DISTANCIA_MIN);
  const lineasVFiltradas = filtrarLineasCercanas(lineasV, CONFIG.A3_DISTANCIA_MIN);

  console.log(`   → ${lineasHFiltradas.length}H, ${lineasVFiltradas.length}V`);
  return { lineasH: lineasHFiltradas, lineasV: lineasVFiltradas };
}

function detectarEcografia(brillo, ancho, alto) {
  console.log('🔊 Ecografía: cambio de brillo');
  const V = CONFIG.ECO_VENTANA;

  const ecoH = new Array(alto).fill(0);
  for (let y = 0; y < alto; y++) {
    let suma = 0;
    const v0 = Math.max(0, y - V);
    const v1 = Math.min(alto - 1, y + V);
    for (let x = 0; x < ancho; x++) {
      let maxDif = 0;
      for (let yy = v0; yy <= v1; yy++) {
        const dif = Math.abs(brillo[y][x] - brillo[yy][x]);
        if (dif > maxDif) maxDif = dif;
      }
      suma += maxDif;
    }
    ecoH[y] = suma / ancho;
  }

  const ecoV = new Array(ancho).fill(0);
  for (let x = 0; x < ancho; x++) {
    let suma = 0;
    const h0 = Math.max(0, x - V);
    const h1 = Math.min(ancho - 1, x + V);
    for (let y = 0; y < alto; y++) {
      let maxDif = 0;
      for (let xx = h0; xx <= h1; xx++) {
        const dif = Math.abs(brillo[y][x] - brillo[y][xx]);
        if (dif > maxDif) maxDif = dif;
      }
      suma += maxDif;
    }
    ecoV[x] = suma / alto;
  }

  const lineasH = [];
  let ultH = -9999;
  for (let y = 0; y < alto; y++) {
    if (ecoH[y] > CONFIG.ECO_UMBRAL_H && y - ultH >= CONFIG.ECO_DISTANCIA_MIN_H) {
      let fuertes = 0;
      for (let x = 0; x < ancho; x++) {
        let maxDif = 0;
        for (let yy = Math.max(0, y - 2); yy <= Math.min(alto - 1, y + 2); yy++) {
          const dif = Math.abs(brillo[y][x] - brillo[yy][x]);
          if (dif > maxDif) maxDif = dif;
        }
        if (maxDif > CONFIG.ECO_UMBRAL_H * 0.5) fuertes++;
      }
      if (fuertes / ancho >= CONFIG.ECO_CONTINUIDAD) {
        lineasH.push(y);
        ultH = y;
      }
    }
  }

  const lineasV = [];
  let ultV = -9999;
  for (let x = 0; x < ancho; x++) {
    if (ecoV[x] > CONFIG.ECO_UMBRAL_V && x - ultV >= CONFIG.ECO_DISTANCIA_MIN_V) {
      let fuertes = 0;
      for (let y = 0; y < alto; y++) {
        let maxDif = 0;
        for (let xx = Math.max(0, x - 2); xx <= Math.min(ancho - 1, x + 2); xx++) {
          const dif = Math.abs(brillo[y][x] - brillo[y][xx]);
          if (dif > maxDif) maxDif = dif;
        }
        if (maxDif > CONFIG.ECO_UMBRAL_V * 0.5) fuertes++;
      }
      if (fuertes / alto >= CONFIG.ECO_CONTINUIDAD) {
        lineasV.push(x);
        ultV = x;
      }
    }
  }

  console.log(`   → ${lineasH.length}H, ${lineasV.length}V`);
  return { lineasH, lineasV, ecoH, ecoV };
}

function ejecutarDeteccion(brillo, ancho, alto) {
  console.log('═══════════════════════════════════');
  console.log('🔬 EJECUTANDO DETECCIÓN DE LÍNEAS');
  console.log('═══════════════════════════════════');

  const optica = detectarOptica(brillo, ancho, alto);
  const opticaAjustada = aplicarAjusteLocal(optica.lineasH, optica.lineasV, brillo, alto, ancho);

  const a3 = detectarA3(brillo, ancho, alto);
  const a3Ajustada = aplicarAjusteLocal(a3.lineasH, a3.lineasV, brillo, alto, ancho);

  const eco = detectarEcografia(brillo, ancho, alto);
  const ecoAjustada = aplicarAjusteLocal(eco.lineasH, eco.lineasV, brillo, alto, ancho);

  return {
    optica: { lineasH: opticaAjustada.lineasH, lineasV: opticaAjustada.lineasV },
    a3: { lineasH: a3Ajustada.lineasH, lineasV: a3Ajustada.lineasV },
    ecografia: { lineasH: ecoAjustada.lineasH, lineasV: ecoAjustada.lineasV }
  };
}

console.log('✅ Detección cargada');
