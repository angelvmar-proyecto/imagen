// ============================================
// MAR Caribe v5.0 - Detección de Líneas
// 4 Algoritmos combinados por votación
// ============================================

const CONFIG_DETECCION = {
  // Algoritmo 1: Perfil de Intensidad
  umbralOscuridad: 128,
  umbralValleIntensidad: 0.30,
  ventanaSuavizado: 3,
  distanciaMinimaValles: 20,

  // Algoritmo 2: Ecos (bordes)
  umbralContraste: 30,
  coberturaMinimaEco: 0.50,

  // Algoritmo 3: Color RGB/HSV
  umbralCambioColor: 60,

  // Algoritmo 4: LIDAR (regularidad)
  toleranciaRegularidad: 0.20,
  minimoRepeticiones: 3,

  // Votación
  votosMinimos: 2,
  distanciaAgrupacion: 10,

  // Dibujo - LÍNEAS FINAS
  grosorLinea: 1,
  colorVertical: 'rgba(255, 0, 0, 0.85)',
  colorHorizontal: 'rgba(0, 0, 255, 0.85)',
};

// ============================================
// UTILIDADES
// ============================================
function convertirAGrises(canvas) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const grises = new Uint8Array(canvas.width * canvas.height);

  for (let i = 0; i < data.length; i += 4) {
    grises[i / 4] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }
  return { grises, width: canvas.width, height: canvas.height };
}

function suavizar(arr, ventana) {
  const resultado = new Array(arr.length);
  const mitad = Math.floor(ventana / 2);
  for (let i = 0; i < arr.length; i++) {
    let suma = 0, count = 0;
    for (let j = -mitad; j <= mitad; j++) {
      const idx = i + j;
      if (idx >= 0 && idx < arr.length) { suma += arr[idx]; count++; }
    }
    resultado[i] = suma / count;
  }
  return resultado;
}

function detectarValles(arr, umbral, distanciaMin) {
  const valles = [];
  for (let i = 2; i < arr.length - 2; i++) {
    if (arr[i] < umbral &&
        arr[i] <= arr[i - 1] && arr[i] <= arr[i + 1] &&
        arr[i] < arr[i - 2] && arr[i] < arr[i + 2]) {
      if (valles.length === 0 || i - valles[valles.length - 1] >= distanciaMin) {
        valles.push(i);
      } else {
        const ultimo = valles[valles.length - 1];
        if (arr[i] < arr[ultimo]) valles[valles.length - 1] = i;
      }
    }
  }
  return valles;
}

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
// ALGORITMO 1: PERFIL DE INTENSIDAD
// ============================================
function algoritmoIntensidad(canvas) {
  console.log('🔭 Algoritmo 1: Perfil de Intensidad');
  const { grises, width, height } = convertirAGrises(canvas);

  const perfilV = new Array(width).fill(0);
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      if (grises[y * width + x] < CONFIG_DETECCION.umbralOscuridad) perfilV[x]++;
    }
  }

  const perfilH = new Array(height).fill(0);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (grises[y * width + x] < CONFIG_DETECCION.umbralOscuridad) perfilH[y]++;
    }
  }

  const perfilVSuave = suavizar(perfilV, CONFIG_DETECCION.ventanaSuavizado);
  const perfilHSuave = suavizar(perfilH, CONFIG_DETECCION.ventanaSuavizado);

  const maxV = Math.max(...perfilVSuave);
  const maxH = Math.max(...perfilHSuave);
  const umbralV = maxV * CONFIG_DETECCION.umbralValleIntensidad;
  const umbralH = maxH * CONFIG_DETECCION.umbralValleIntensidad;

  const verticales = detectarValles(perfilVSuave, umbralV, CONFIG_DETECCION.distanciaMinimaValles);
  const horizontales = detectarValles(perfilHSuave, umbralH, CONFIG_DETECCION.distanciaMinimaValles);

  console.log(`   → ${verticales.length} verticales, ${horizontales.length} horizontales`);
  return { verticales, horizontales };
}

// ============================================
// ALGORITMO 2: ECOS (BORDES)
// ============================================
function algoritmoEcos(canvas) {
  console.log('🔊 Algoritmo 2: Ecos');
  const { grises, width, height } = convertirAGrises(canvas);

  const gradX = new Array(width).fill(0);
  for (let x = 1; x < width - 1; x++) {
    let suma = 0;
    for (let y = 0; y < height; y++) {
      const dif = Math.abs(grises[y * width + (x + 1)] - grises[y * width + (x - 1)]);
      if (dif > CONFIG_DETECCION.umbralContraste) suma++;
    }
    gradX[x] = suma;
  }

  const gradY = new Array(height).fill(0);
  for (let y = 1; y < height - 1; y++) {
    let suma = 0;
    for (let x = 0; x < width; x++) {
      const dif = Math.abs(grises[(y + 1) * width + x] - grises[(y - 1) * width + x]);
      if (dif > CONFIG_DETECCION.umbralContraste) suma++;
    }
    gradY[y] = suma;
  }

  const gradXSuave = suavizar(gradX, 3);
  const gradYSuave = suavizar(gradY, 3);

  const umbralX = height * CONFIG_DETECCION.coberturaMinimaEco;
  const umbralY = width * CONFIG_DETECCION.coberturaMinimaEco;

  const verticales = detectarPicos(gradXSuave, umbralX, CONFIG_DETECCION.distanciaMinimaValles);
  const horizontales = detectarPicos(gradYSuave, umbralY, CONFIG_DETECCION.distanciaMinimaValles);

  console.log(`   → ${verticales.length} verticales, ${horizontales.length} horizontales`);
  return { verticales, horizontales };
}

// ============================================
// ALGORITMO 3: COLOR RGB/HSV
// ============================================
function algoritmoColor(canvas) {
  console.log('📡 Algoritmo 3: Color');
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const width = canvas.width, height = canvas.height;

  const cambiosV = new Array(width).fill(0);
  const cambiosH = new Array(height).fill(0);

  for (let x = 1; x < width - 1; x++) {
    let suma = 0;
    for (let y = 0; y < height; y++) {
      const idxIzq = (y * width + (x - 1)) * 4;
      const idxDer = (y * width + (x + 1)) * 4;
      const difColor = Math.abs(data[idxIzq] - data[idxDer]) +
                       Math.abs(data[idxIzq + 1] - data[idxDer + 1]) +
                       Math.abs(data[idxIzq + 2] - data[idxDer + 2]);
      if (difColor > CONFIG_DETECCION.umbralCambioColor) suma++;
    }
    cambiosV[x] = suma;
  }

  for (let y = 1; y < height - 1; y++) {
    let suma = 0;
    for (let x = 0; x < width; x++) {
      const idxArr = ((y - 1) * width + x) * 4;
      const idxAbj = ((y + 1) * width + x) * 4;
      const difColor = Math.abs(data[idxArr] - data[idxAbj]) +
                       Math.abs(data[idxArr + 1] - data[idxAbj + 1]) +
                       Math.abs(data[idxArr + 2] - data[idxAbj + 2]);
      if (difColor > CONFIG_DETECCION.umbralCambioColor) suma++;
    }
    cambiosH[y] = suma;
  }

  const cambiosVSuave = suavizar(cambiosV, 3);
  const cambiosHSuave = suavizar(cambiosH, 3);

  const verticales = detectarPicos(cambiosVSuave, height * 0.3, CONFIG_DETECCION.distanciaMinimaValles);
  const horizontales = detectarPicos(cambiosHSuave, width * 0.3, CONFIG_DETECCION.distanciaMinimaValles);

  console.log(`   → ${verticales.length} verticales, ${horizontales.length} horizontales`);
  return { verticales, horizontales };
}

// ============================================
// ALGORITMO 4: LIDAR (REGULARIDAD)
// ============================================
function algoritmoLidar(cortesPropuestos, tamaño) {
  console.log('📐 Algoritmo 4: LIDAR');
  if (cortesPropuestos.length < 3) return cortesPropuestos;

  const distancias = [];
  for (let i = 1; i < cortesPropuestos.length; i++) {
    distancias.push(cortesPropuestos[i] - cortesPropuestos[i - 1]);
  }

  const conteo = {};
  for (const d of distancias) {
    const key = Math.round(d / 5) * 5;
    conteo[key] = (conteo[key] || 0) + 1;
  }

  let distanciaComun = 0, maxRepeticiones = 0;
  for (const [key, count] of Object.entries(conteo)) {
    if (count > maxRepeticiones) {
      maxRepeticiones = count;
      distanciaComun = parseInt(key);
    }
  }

  if (maxRepeticiones < CONFIG_DETECCION.minimoRepeticiones) {
    console.log(`   → Sin patrón, devolviendo ${cortesPropuestos.length}`);
    return cortesPropuestos;
  }

  const filtrados = [cortesPropuestos[0]];
  for (let i = 1; i < cortesPropuestos.length; i++) {
    const distancia = cortesPropuestos[i] - filtrados[filtrados.length - 1];
    const ratio = distancia / distanciaComun;
    const desviacion = Math.abs(ratio - Math.round(ratio));
    if (desviacion < CONFIG_DETECCION.toleranciaRegularidad) {
      filtrados.push(cortesPropuestos[i]);
    }
  }

  console.log(`   → Patrón de ${distanciaComun}px, ${filtrados.length} filtrados`);
  return filtrados;
}

// ============================================
// VOTACIÓN
// ============================================
function votarCortes(resultados, tipo) {
  console.log(`🗳️ Votando ${tipo}...`);
  const todos = [];
  for (const res of resultados) {
    for (const corte of res[tipo]) todos.push(corte);
  }
  if (todos.length === 0) return [];
  todos.sort((a, b) => a - b);

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

  const confirmados = [];
  for (const grupo of grupos) {
    const promedio = Math.round(grupo.reduce((a, b) => a + b, 0) / grupo.length);
    const algoritmosQueVotaron = new Set();
    for (const res of resultados) {
      const tieneCorte = res[tipo].some(c => Math.abs(c - promedio) <= CONFIG_DETECCION.distanciaAgrupacion);
      if (tieneCorte) algoritmosQueVotaron.add(res.id);
    }
    if (algoritmosQueVotaron.size >= CONFIG_DETECCION.votosMinimos) {
      confirmados.push({ posicion: promedio, votos: algoritmosQueVotaron.size });
    }
  }
  console.log(`   → ${confirmados.length} confirmados de ${grupos.length}`);
  return confirmados;
}

// ============================================
// FUNCIÓN PRINCIPAL
// ============================================
async function detectarLineasConAlgoritmos(canvas) {
  console.log('🎯 Detección con 4 algoritmos...');
  const resultados = [];

  const res1 = algoritmoIntensidad(canvas);
  resultados.push({ id: 1, nombre: 'Intensidad', verticales: res1.verticales, horizontales: res1.horizontales });

  const res2 = algoritmoEcos(canvas);
  resultados.push({ id: 2, nombre: 'Ecos', verticales: res2.verticales, horizontales: res2.horizontales });

  const res3 = algoritmoColor(canvas);
  resultados.push({ id: 3, nombre: 'Color', verticales: res3.verticales, horizontales: res3.horizontales });

  let verticalesVotados = votarCortes(resultados, 'verticales');
  let horizontalesVotados = votarCortes(resultados, 'horizontales');

  const verticalesLidar = algoritmoLidar(verticalesVotados.map(v => v.posicion), canvas.width);
  const horizontalesLidar = algoritmoLidar(horizontalesVotados.map(h => h.posicion), canvas.height);

  const verticalesFinal = verticalesVotados.filter(v => verticalesLidar.includes(v.posicion));
  const horizontalesFinal = horizontalesVotados.filter(h => horizontalesLidar.includes(h.posicion));

  console.log(`✅ Final: ${verticalesFinal.length}V, ${horizontalesFinal.length}H`);
  return { verticales: verticalesFinal, horizontales: horizontalesFinal };
}

// ============================================
// DIBUJO DE LÍNEAS (FINAS)
// ============================================
function dibujarLineasDeteccion(canvas, verticales, horizontales) {
  const ctx = canvas.getContext('2d');

  // Líneas verticales (rojo)
  ctx.strokeStyle = CONFIG_DETECCION.colorVertical;
  ctx.lineWidth = CONFIG_DETECCION.grosorLinea;
  for (const v of verticales) {
    const x = v.posicion !== undefined ? v.posicion : v;
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, canvas.height);
    ctx.stroke();
  }

  // Líneas horizontales (azul)
  ctx.strokeStyle = CONFIG_DETECCION.colorHorizontal;
  ctx.lineWidth = CONFIG_DETECCION.grosorLinea;
  for (const h of horizontales) {
    const y = h.posicion !== undefined ? h.posicion : h;
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(canvas.width, y + 0.5);
    ctx.stroke();
  }
}
