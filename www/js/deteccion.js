// ============================================
// MAR Caribe v4.0 - Detección de Líneas
// 4 Algoritmos combinados por votación
// ============================================

const CONFIG_DETECCION = {
  // Algoritmo 1: Perfil de Intensidad
  umbralOscuridad: 128,
  umbralValleIntensidad: 0.30,
  ventanaSuavizado: 3,

  // Algoritmo 2: Ecos (bordes)
  umbralContraste: 30,
  coberturaMinimaEco: 0.50,

  // Algoritmo 3: Color RGB/HSV
  umbralMatiz: 15,
  umbralSaturacion: 20,

  // Algoritmo 4: LIDAR (regularidad)
  toleranciaRegularidad: 0.20,
  minimoRepeticiones: 3,

  // Votación
  votosMinimos: 2,
  distanciaAgrupacion: 10,

  // Dibujo
  grosorLinea: 2,
  colorVertical: '#FF0000',
  colorHorizontal: '#0000FF',

  // Limpieza
  umbralBinarizacion: 200,
  tamanoMinimoBlob: 4
};

// ============================================
// UTILIDADES
// ============================================

// Convertir imagen a escala de grises
function convertirAGrises(canvas) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const grises = new Uint8Array(canvas.width * canvas.height);

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // Luminancia estándar
    grises[i / 4] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }
  return { grises, width: canvas.width, height: canvas.height };
}

// Suavizar un array con media móvil
function suavizar(arr, ventana) {
  const resultado = new Array(arr.length);
  const mitad = Math.floor(ventana / 2);
  for (let i = 0; i < arr.length; i++) {
    let suma = 0;
    let count = 0;
    for (let j = -mitad; j <= mitad; j++) {
      const idx = i + j;
      if (idx >= 0 && idx < arr.length) {
        suma += arr[idx];
        count++;
      }
    }
    resultado[i] = suma / count;
  }
  return resultado;
}

// Detectar valles (mínimos locales) en un array
function detectarValles(arr, umbral, distanciaMin) {
  const valles = [];
  for (let i = 2; i < arr.length - 2; i++) {
    if (arr[i] < umbral &&
        arr[i] <= arr[i - 1] && arr[i] <= arr[i + 1] &&
        arr[i] < arr[i - 2] && arr[i] < arr[i + 2]) {
      // Filtrar por distancia
      if (valles.length === 0 || i - valles[valles.length - 1] >= distanciaMin) {
        valles.push(i);
      } else {
        // Quedarse con el más profundo
        const ultimo = valles[valles.length - 1];
        if (arr[i] < arr[ultimo]) {
          valles[valles.length - 1] = i;
        }
      }
    }
  }
  return valles;
}

// Detectar picos (máximos locales) en un array
function detectarPicos(arr, umbral, distanciaMin) {
  const picos = [];
  for (let i = 2; i < arr.length - 2; i++) {
    if (arr[i] > umbral &&
        arr[i] >= arr[i - 1] && arr[i] >= arr[i + 1] &&
        arr[i] > arr[i - 2] && arr[i] > arr[i + 2]) {
      if (picos.length === 0 || i - picos[picos.length - 1] >= distanciaMin) {
        picos.push(i);
      }
    }
  }
  return picos;
}

// ============================================
// ALGORITMO 1: PERFIL DE INTENSIDAD Y DENSIDAD
// ============================================
function algoritmoIntensidad(canvas) {
  console.log('🔭 Algoritmo 1: Perfil de Intensidad');

  const { grises, width, height } = convertirAGrises(canvas);

  // Perfil vertical (para columnas)
  const perfilV = new Array(width).fill(0);
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      if (grises[y * width + x] < CONFIG_DETECCION.umbralOscuridad) {
        perfilV[x]++;
      }
    }
  }

  // Perfil horizontal (para filas)
  const perfilH = new Array(height).fill(0);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (grises[y * width + x] < CONFIG_DETECCION.umbralOscuridad) {
        perfilH[y]++;
      }
    }
  }

  // Suavizar
  const perfilVSuave = suavizar(perfilV, CONFIG_DETECCION.ventanaSuavizado);
  const perfilHSuave = suavizar(perfilH, CONFIG_DETECCION.ventanaSuavizado);

  // Detectar valles (cortes entre celdas)
  const maxV = Math.max(...perfilVSuave);
  const maxH = Math.max(...perfilHSuave);
  const umbralV = maxV * CONFIG_DETECCION.umbralValleIntensidad;
  const umbralH = maxH * CONFIG_DETECCION.umbralValleIntensidad;

  const verticales = detectarValles(perfilVSuave, umbralV, 20);
  const horizontales = detectarValles(perfilHSuave, umbralH, 20);

  console.log(`   → ${verticales.length} verticales, ${horizontales.length} horizontales`);

  return { verticales, horizontales, perfilV: perfilVSuave, perfilH: perfilHSuave };
}

// ============================================
// ALGORITMO 2: DETECCIÓN DE ECOS (BORDES)
// ============================================
function algoritmoEcos(canvas) {
  console.log('🔊 Algoritmo 2: Detección de Ecos');

  const { grises, width, height } = convertirAGrises(canvas);

  // Gradiente horizontal (cambio entre píxeles vecinos en X)
  const gradX = new Array(width).fill(0);
  for (let x = 1; x < width - 1; x++) {
    let suma = 0;
    for (let y = 0; y < height; y++) {
      const izq = grises[y * width + (x - 1)];
      const der = grises[y * width + (x + 1)];
      const dif = Math.abs(der - izq);
      if (dif > CONFIG_DETECCION.umbralContraste) {
        suma++;
      }
    }
    gradX[x] = suma;
  }

  // Gradiente vertical
  const gradY = new Array(height).fill(0);
  for (let y = 1; y < height - 1; y++) {
    let suma = 0;
    for (let x = 0; x < width; x++) {
      const arr = grises[(y - 1) * width + x];
      const abj = grises[(y + 1) * width + x];
      const dif = Math.abs(abj - arr);
      if (dif > CONFIG_DETECCION.umbralContraste) {
        suma++;
      }
    }
    gradY[y] = suma;
  }

  // Suavizar
  const gradXSuave = suavizar(gradX, 3);
  const gradYSuave = suavizar(gradY, 3);

  // Umbral de cobertura
  const umbralX = height * CONFIG_DETECCION.coberturaMinimaEco;
  const umbralY = width * CONFIG_DETECCION.coberturaMinimaEco;

  // Detectar picos (bordes)
  const verticales = detectarPicos(gradXSuave, umbralX, 20);
  const horizontales = detectarPicos(gradYSuave, umbralY, 20);

  console.log(`   → ${verticales.length} verticales, ${horizontales.length} horizontales`);

  return { verticales, horizontales };
}

// ============================================
// ALGORITMO 3: ANÁLISIS RGB/HSV
// ============================================
function algoritmoColor(canvas) {
  console.log('📡 Algoritmo 3: Análisis RGB/HSV');

  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const width = canvas.width;
  const height = canvas.height;

  // Convertir a HSV y calcular cambios de matiz/saturación
  const cambiosV = new Array(width).fill(0);
  const cambiosH = new Array(height).fill(0);

  // Cambios verticales (entre columnas X)
  for (let x = 1; x < width - 1; x++) {
    let suma = 0;
    for (let y = 0; y < height; y++) {
      const idx = (y * width + x) * 4;
      const idxIzq = (y * width + (x - 1)) * 4;
      const idxDer = (y * width + (x + 1)) * 4;

      const r1 = data[idxIzq], g1 = data[idxIzq + 1], b1 = data[idxIzq + 2];
      const r2 = data[idxDer], g2 = data[idxDer + 1], b2 = data[idxDer + 2];

      const difH = Math.abs((r1 + g1 + b1) - (r2 + g2 + b2)) / 3;
      const difColor = Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);

      if (difColor > 60) suma++;
    }
    cambiosV[x] = suma;
  }

  // Cambios horizontales (entre filas Y)
  for (let y = 1; y < height - 1; y++) {
    let suma = 0;
    for (let x = 0; x < width; x++) {
      const idxArr = ((y - 1) * width + x) * 4;
      const idxAbj = ((y + 1) * width + x) * 4;

      const r1 = data[idxArr], g1 = data[idxArr + 1], b1 = data[idxArr + 2];
      const r2 = data[idxAbj], g2 = data[idxAbj + 1], b2 = data[idxAbj + 2];

      const difColor = Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
      if (difColor > 60) suma++;
    }
    cambiosH[y] = suma;
  }

  const cambiosVSuave = suavizar(cambiosV, 3);
  const cambiosHSuave = suavizar(cambiosH, 3);

  const umbralV = height * 0.3;
  const umbralH = width * 0.3;

  const verticales = detectarPicos(cambiosVSuave, umbralV, 20);
  const horizontales = detectarPicos(cambiosHSuave, umbralH, 20);

  console.log(`   → ${verticales.length} verticales, ${horizontales.length} horizontales`);

  return { verticales, horizontales };
}

// ============================================
// ALGORITMO 4: LIDAR (REGULARIDAD)
// ============================================
function algoritmoLidar(cortesPropuestos, tamaño) {
  console.log('📐 Algoritmo 4: LIDAR (Regularidad)');

  if (cortesPropuestos.length < 3) return cortesPropuestos;

  // Calcular distancias entre cortes consecutivos
  const distancias = [];
  for (let i = 1; i < cortesPropuestos.length; i++) {
    distancias.push(cortesPropuestos[i] - cortesPropuestos[i - 1]);
  }

  // Encontrar la distancia más común (patrón)
  const conteo = {};
  for (const d of distancias) {
    const key = Math.round(d / 5) * 5; // Agrupar cada 5px
    conteo[key] = (conteo[key] || 0) + 1;
  }

  let distanciaComun = 0;
  let maxRepeticiones = 0;
  for (const [key, count] of Object.entries(conteo)) {
    if (count > maxRepeticiones) {
      maxRepeticiones = count;
      distanciaComun = parseInt(key);
    }
  }

  // Si no hay patrón claro, devolver todos
  if (maxRepeticiones < CONFIG_DETECCION.minimoRepeticiones) {
    console.log(`   → Sin patrón regular claro, devolviendo ${cortesPropuestos.length}`);
    return cortesPropuestos;
  }

  // Filtrar cortes que estén a distancia regular
  const filtrados = [cortesPropuestos[0]];
  for (let i = 1; i < cortesPropuestos.length; i++) {
    const distancia = cortesPropuestos[i] - filtrados[filtrados.length - 1];
    const ratio = distancia / distanciaComun;
    const desviacion = Math.abs(ratio - Math.round(ratio));

    if (desviacion < CONFIG_DETECCION.toleranciaRegularidad) {
      filtrados.push(cortesPropuestos[i]);
    }
  }

  console.log(`   → Patrón de ${distanciaComun}px, ${filtrados.length} cortes filtrados`);
  return filtrados;
}

// ============================================
// VOTACIÓN DE LOS 4 ALGORITMOS
// ============================================
function votarCortes(resultados, tipo) {
  console.log(`🗳️ Votando cortes ${tipo}...`);

  // Recopilar todos los cortes propuestos
  const todos = [];
  for (const res of resultados) {
    for (const corte of res[tipo]) {
      todos.push(corte);
    }
  }

  if (todos.length === 0) return [];

  // Ordenar
  todos.sort((a, b) => a - b);

  // Agrupar cortes cercanos
  const grupos = [];
  let grupoActual = [todos[0]];

  for (let i = 1; i < todos.length; i++) {
    if (todos[i] - grupoActual[grupoActual.length - 1] <= CONFIG_DETECCION.distanciaAgrupacion) {
      grupoActual.push(todos[i]);
    } else {
      grupos.push(grupoActual);
      grupoActual = [todos[i]];
    }
  }
  grupos.push(grupoActual);

  // Cada grupo con votos = número de cortes que cayeron en él
  const confirmados = [];
  for (const grupo of grupos) {
    // Un corte se confirma si al menos `votosMinimos` algoritmos lo propusieron
    // Contamos cuántos algoritmos diferentes propusieron algo en este grupo
    const algoritmosQueVotaron = new Set();
    for (const res of resultados) {
      const tieneCorte = res[tipo].some(c =>
        Math.abs(c - (grupo.reduce((a, b) => a + b, 0) / grupo.length)) <= CONFIG_DETECCION.distanciaAgrupacion
      );
      if (tieneCorte) algoritmosQueVotaron.add(res.id);
    }

    if (algoritmosQueVotaron.size >= CONFIG_DETECCION.votosMinimos) {
      const promedio = Math.round(grupo.reduce((a, b) => a + b, 0) / grupo.length);
      confirmados.push({ posicion: promedio, votos: algoritmosQueVotaron.size });
    }
  }

  console.log(`   → ${confirmados.length} cortes confirmados de ${grupos.length} grupos`);
  return confirmados;
}

// ============================================
// FUNCIÓN PRINCIPAL
// ============================================
async function detectarLineasConAlgoritmos(canvas) {
  console.log('🎯 Iniciando detección de líneas con 4 algoritmos...');

  const resultados = [];

  // Algoritmo 1
  const res1 = algoritmoIntensidad(canvas);
  resultados.push({ id: 1, nombre: 'Intensidad', verticales: res1.verticales, horizontales: res1.horizontales });

  // Algoritmo 2
  const res2 = algoritmoEcos(canvas);
  resultados.push({ id: 2, nombre: 'Ecos', verticales: res2.verticales, horizontales: res2.horizontales });

  // Algoritmo 3
  const res3 = algoritmoColor(canvas);
  resultados.push({ id: 3, nombre: 'Color', verticales: res3.verticales, horizontales: res3.horizontales });

  // Votación previa (sin LIDAR)
  let verticalesVotados = votarCortes(resultados, 'verticales');
  let horizontalesVotados = votarCortes(resultados, 'horizontales');

  // Algoritmo 4 (LIDAR valida regularidad)
  const verticalesLidar = algoritmoLidar(verticalesVotados.map(v => v.posicion), canvas.width);
  const horizontalesLidar = algoritmoLidar(horizontalesVotados.map(h => h.posicion), canvas.height);

  // Convertir de vuelta a formato {posicion, votos}
  const verticalesFinal = verticalesVotados.filter(v => verticalesLidar.includes(v.posicion));
  const horizontalesFinal = horizontalesVotados.filter(h => horizontalesLidar.includes(h.posicion));

  console.log(`✅ Detección final: ${verticalesFinal.length} verticales, ${horizontalesFinal.length} horizontales`);

  return {
    verticales: verticalesFinal,
    horizontales: horizontalesFinal,
    resultadosPorAlgoritmo: resultados
  };
}

// ============================================
// DIBUJO DE LÍNEAS DE DETECCIÓN
// ============================================
function dibujarLineasDeteccion(canvas, verticales, horizontales) {
  const ctx = canvas.getContext('2d');

  // Líneas verticales (rojo)
  ctx.strokeStyle = CONFIG_DETECCION.colorVertical;
  ctx.lineWidth = CONFIG_DETECCION.grosorLinea;
  for (const v of verticales) {
    const x = v.posicion !== undefined ? v.posicion : v;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  // Líneas horizontales (azul)
  ctx.strokeStyle = CONFIG_DETECCION.colorHorizontal;
  ctx.lineWidth = CONFIG_DETECCION.grosorLinea;
  for (const h of horizontales) {
    const y = h.posicion !== undefined ? h.posicion : h;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}
