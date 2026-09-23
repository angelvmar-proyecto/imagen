// ==============================================
// OCR Timeshare — app.js HÍBRIDO FINAL
// Preprocesamiento + Detección de líneas + LIDAR
// + PaddleOCR + Asignación por coordenadas
// ==============================================

import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { PaddleOCR } from '@paddleocr/paddleocr-js';

const estado = document.getElementById('estado');
const resultado = document.getElementById('resultado');
const debug = document.getElementById('debug');
const barraContenedor = document.getElementById('barraContenedor');
const barraProgreso = document.getElementById('barraProgreso');
const barraTexto = document.getElementById('barraTexto');
const tablaContenedor = document.getElementById('tablaContenedor');
const tablaResultado = document.getElementById('tablaResultado').querySelector('tbody');

let ocr = null;
let ocrCache = null;
let ultimoTexto = '';

// ==============================================
// LOGS
// ==============================================
function log(msg) {
  console.log(msg);
  if (estado) estado.textContent = msg;
}

function logError(msg) {
  console.error(msg);
  if (debug) {
    debug.style.display = 'block';
    debug.textContent += `[app.js] ${msg}\n`;
  }
}

function logDiag(nombre, valor) {
  const msg = `[DIAG ${nombre}] ${JSON.stringify(valor)}`;
  console.log(msg);
  if (debug) {
    debug.style.display = 'block';
    debug.textContent += msg + '\n';
  }
}

function limpiarDebug() {
  if (debug) {
    debug.textContent = '';
    debug.style.display = 'none';
  }
}

// ==============================================
// BARRA
// ==============================================
function mostrarBarra(v) { barraContenedor.style.display = v ? 'block' : 'none'; }
function setProgreso(p, t) {
  barraProgreso.style.width = p + '%';
  barraProgreso.textContent = p + '%';
  if (t) barraTexto.textContent = t;
}

// ==============================================
// CACHE DEL MODELO
// ==============================================
async function initOCR() {
  if (ocr) return;
  if (ocrCache) { ocr = ocrCache; return; }

  log('Cargando modelo OCR (~20s la primera vez)...');
  mostrarBarra(true);
  setProgreso(0, 'Cargando detector...');
  try {
    ocr = await PaddleOCR.create({
      textDetectionModelName: "my_det_model",
      textDetectionModelAsset: { url: "/models/my_det_model.tar" },
      textRecognitionModelName: "my_rec_model",
      textRecognitionModelAsset: { url: "/models/my_rec_model.tar" },
      ortOptions: { backend: "wasm" }
    });
    ocrCache = ocr;
    logDiag("INIT", "OK");
    log('Modelo cargado.');
  } catch (error) {
    logError(`Error al cargar: ${error.message}`);
    mostrarBarra(false);
  }
}

// ==============================================
// PREPARAR IMAGEN CON PREPROCESAMIENTO
// ==============================================
async function prepararImagen(base64) {
  const img = new Image();
  img.src = `data:image/jpeg;base64,${base64}`;
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });

  let canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  let ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);

  logDiag("1_ORIGINAL", { w: img.width, h: img.height });

  // Redimensionar a máximo 1200px (más grande que antes para líneas)
  const MAX = 1200;
  if (canvas.width > MAX || canvas.height > MAX) {
    const escala = Math.min(MAX / canvas.width, MAX / canvas.height);
    const w = Math.round(canvas.width * escala);
    const h = Math.round(canvas.height * escala);
    const canvasEsc = document.createElement('canvas');
    canvasEsc.width = w;
    canvasEsc.height = h;
    const ctxEsc = canvasEsc.getContext('2d');
    ctxEsc.imageSmoothingEnabled = true;
    ctxEsc.imageSmoothingQuality = 'high';
    ctxEsc.drawImage(canvas, 0, 0, w, h);
    canvas = canvasEsc;
    logDiag("2_REDIMENSIONADA", { w, h });
  }

  // Preprocesamiento
  log('🔧 Preprocesando...');
  setProgreso(10, 'Preprocesando...');
  try {
    if (typeof preprocesarCanvasCompleto === 'function') {
      const pre = preprocesarCanvasCompleto(canvas);
      canvas = pre.canvas;
      const detalles = [];
      if (pre.stats.aplicoCRR) detalles.push('CRR');
      if (pre.stats.aplicoBS) detalles.push('BS');
      if (pre.stats.aplicoContraste) detalles.push('Contraste');
      if (pre.stats.aplicoEscalado) detalles.push('Escalado ' + pre.stats.factorEscalado + 'x');
      logDiag("3_PREPROC", detalles.join(' + ') || 'ninguno');
    }
  } catch (e) {
    logError(`Error preproc: ${e.message}`);
  }

  // Retina global
  try {
    if (typeof aplicarRetinaGlobal === 'function' && window.PREPROC && window.PREPROC.RETINA_GLOBAL_ACTIVO) {
      setProgreso(15, 'Retina global...');
      aplicarRetinaGlobal(canvas);
      logDiag("4_RETINA", "aplicada");
    }
  } catch (e) {
    logError(`Error retina: ${e.message}`);
  }

  return canvas;
}

// ==============================================
// DETECCIÓN DE LÍNEAS + LIDAR + CELDAS
// ==============================================
function detectarCeldas(canvas) {
  try {
    log('🔬 Detectando líneas...');
    setProgreso(20, 'Detectando líneas...');

    // 1. Calcular brillo
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const brillo = calcularBrillo(imageData);
    const ancho = canvas.width;
    const alto = canvas.height;

    logDiag("5_BRILLO", { ancho, alto });

    // 2. Ejecutar los 3 algoritmos
    setProgreso(30, 'Ejecutando Óptica + A3 + Ecografía...');
    const det = ejecutarDeteccion(brillo, ancho, alto);
    logDiag("6_DETECCION", {
      opticaH: det.optica.lineasH.length,
      opticaV: det.optica.lineasV.length,
      a3H: det.a3.lineasH.length,
      a3V: det.a3.lineasV.length,
      ecoH: det.ecografia.lineasH.length,
      ecoV: det.ecografia.lineasV.length
    });

    // 3. LIDAR (votación + auto-bordes)
    setProgreso(45, 'LIDAR (votación)...');
    const lidar = ejecutarLidar(
      det.optica.lineasH, det.optica.lineasV,
      det.ecografia.lineasH, det.ecografia.lineasV,
      det.a3.lineasH, det.a3.lineasV,
      brillo, ancho, alto
    );
    logDiag("7_LIDAR", {
      lineasH: lidar.lineasH.length,
      lineasV: lidar.lineasV.length
    });

    if (lidar.lineasH.length < 2 || lidar.lineasV.length < 2) {
      log('⚠️ No se detectaron suficientes líneas');
      return null;
    }

    // 4. Recortar celdas
    setProgreso(55, 'Recortando celdas...');
    const celdas = recortarCeldas(lidar.lineasH, lidar.lineasV);
    logDiag("8_CELDAS", {
      filas: lidar.lineasH.length - 1,
      columnas: lidar.lineasV.length - 1,
      totalCeldas: celdas.length
    });

    return {
      lineasH: lidar.lineasH,
      lineasV: lidar.lineasV,
      celdas: celdas,
      filas: lidar.lineasH.length - 1,
      columnas: lidar.lineasV.length - 1
    };

  } catch (e) {
    logError(`Error en detección: ${e.message}`);
    console.error(e);
    return null;
  }
}

// ==============================================
// ASIGNAR ITEMS DE PADDLEOCR A CELDAS
// ==============================================
function asignarItemsACeldas(items, celdas, filas, columnas) {
  // Crear matriz vacía
  const matriz = Array(filas).fill(null).map(() => Array(columnas).fill(''));

  // Para cada item, encontrar la celda que contiene su centro
  items.forEach(item => {
    // Calcular centro del item (bounding box)
    const poly = item.poly;
    const centroX = (poly[0][0] + poly[1][0] + poly[2][0] + poly[3][0]) / 4;
    const centroY = (poly[0][1] + poly[1][1] + poly[2][1] + poly[3][1]) / 4;

    // Buscar la celda que contiene el centro
    for (const celda of celdas) {
      if (centroX >= celda.x1 && centroX <= celda.x2 &&
          centroY >= celda.y1 && centroY <= celda.y2) {
        // Acumular texto en la celda (puede haber varios items por celda)
        const textoActual = matriz[celda.fila][celda.col];
        matriz[celda.fila][celda.col] = textoActual
          ? textoActual + ' ' + item.text
          : item.text;
        break;
      }
    }
  });

  return matriz;
}

// ==============================================
// MOSTRAR TABLA
// ==============================================
function mostrarTabla(matriz) {
  tablaResultado.innerHTML = '';

  if (!matriz || matriz.length === 0) {
    resultado.style.display = 'block';
    resultado.textContent = '(sin datos)';
    return;
  }

  matriz.forEach((fila, i) => {
    const tr = document.createElement('tr');
    const tdNum = document.createElement('td');
    tdNum.className = 'col-num';
    tdNum.textContent = i + 1;
    tr.appendChild(tdNum);

    fila.forEach(celda => {
      const td = document.createElement('td');
      td.textContent = celda || '';
      tr.appendChild(td);
    });

    tablaResultado.appendChild(tr);
  });

  // Guardar como TSV para exportación
  ultimoTexto = matriz.map(fila => fila.join('\t')).join('\n');

  tablaContenedor.style.display = 'block';
  resultado.style.display = 'block';
  resultado.textContent = ultimoTexto;

  mostrarBotonesExportacion();
}

// ==============================================
// EXPORTACIÓN
// ==============================================
function mostrarBotonesExportacion() {
  let contenedor = document.getElementById('botonesExportar');
  if (contenedor) { contenedor.style.display = 'grid'; return; }

  contenedor = document.createElement('div');
  contenedor.id = 'botonesExportar';
  contenedor.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:10px;';

  const btnCopiar = document.createElement('button');
  btnCopiar.textContent = '📋 Copiar';
  btnCopiar.style.cssText = 'background:#3b82f6;color:white;border:none;border-radius:8px;padding:10px;font-size:0.8rem;cursor:pointer;';
  btnCopiar.onclick = copiarTablaTSV;

  const btnCSV = document.createElement('button');
  btnCSV.textContent = '📊 CSV';
  btnCSV.style.cssText = 'background:#f39c12;color:white;border:none;border-radius:8px;padding:10px;font-size:0.8rem;cursor:pointer;';
  btnCSV.onclick = exportarCSV;

  const btnExcel = document.createElement('button');
  btnExcel.textContent = '📈 Excel';
  btnExcel.style.cssText = 'background:#217346;color:white;border:none;border-radius:8px;padding:10px;font-size:0.8rem;cursor:pointer;';
  btnExcel.onclick = exportarExcel;

  contenedor.appendChild(btnCopiar);
  contenedor.appendChild(btnCSV);
  contenedor.appendChild(btnExcel);

  tablaContenedor.parentNode.insertBefore(contenedor, tablaContenedor.nextSibling);
}

async function copiarTablaTSV() {
  if (!ultimoTexto) return;
  try {
    await navigator.clipboard.writeText(ultimoTexto);
    log('✅ Tabla copiada');
  } catch (e) {
    logError(`Error: ${e.message}`);
  }
}

async function exportarCSV() {
  if (!ultimoTexto) return;
  try {
    const csv = '\uFEFF' + ultimoTexto.split('\n').map(linea =>
      linea.split('\t').map(c => '"' + c.replace(/"/g, '""') + '"').join(',')
    ).join('\n');
    const nombre = 'ocr_' + Date.now() + '.csv';
    const base64 = btoa(unescape(encodeURIComponent(csv)));
    await Filesystem.writeFile({ path: nombre, data: base64, directory: Directory.Documents });
    log('✅ CSV: ' + nombre);
  } catch (e) {
    logError(`Error CSV: ${e.message}`);
  }
}

async function exportarExcel() {
  if (!ultimoTexto) return;
  try {
    const filas = ultimoTexto.split('\n').map(linea =>
      '<tr>' + linea.split('\t').map(c => '<td>' + c + '</td>').join('') + '</tr>'
    ).join('');
    const html = '<html><head><meta charset="utf-8"></head><body><table>' + filas + '</table></body></html>';
    const nombre = 'ocr_' + Date.now() + '.xls';
    const base64 = btoa(unescape(encodeURIComponent(html)));
    await Filesystem.writeFile({ path: nombre, data: base64, directory: Directory.Documents });
    log('✅ Excel: ' + nombre);
  } catch (e) {
    logError(`Error Excel: ${e.message}`);
  }
}

// ==============================================
// PIPELINE PRINCIPAL
// ==============================================
async function runOCR(base64) {
  limpiarDebug();
  try {
    await initOCR();
    if (!ocr) return;

    // 1. Preparar imagen con preprocesamiento
    const canvas = await prepararImagen(base64);

    // 2. Detección de líneas + LIDAR + celdas
    const deteccion = detectarCeldas(canvas);

    // 3. Convertir canvas a blob para PaddleOCR
    setProgreso(60, 'Ejecutando PaddleOCR...');
    const blob = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.85);
    });

    logDiag("9_BLOB", { kb: Math.round(blob.size / 1024), w: canvas.width, h: canvas.height });

    const inicio = Date.now();
    const intervalId = setInterval(() => {
      const seg = Math.floor((Date.now() - inicio) / 1000);
      setProgreso(Math.min(90, 60 + seg * 2), `OCR... ${seg}s`);
    }, 1000);

    const resultadoCrudo = await ocr.predict(blob);
    clearInterval(intervalId);

    const segundos = Math.round((Date.now() - inicio) / 1000);
    log(`OCR completado en ${segundos}s`);

    // 4. Extraer items
    let items = [];
    if (Array.isArray(resultadoCrudo) && resultadoCrudo[0] && resultadoCrudo[0].items) {
      items = resultadoCrudo[0].items;
    } else if (resultadoCrudo && resultadoCrudo.items) {
      items = resultadoCrudo.items;
    }

    logDiag("10_ITEMS", { cantidad: items.length });

    // 5. Asignar a celdas si hay detección, o agrupar por filas si no
    if (deteccion && items.length > 0) {
      setProgreso(95, 'Asignando a celdas...');
      const matriz = asignarItemsACeldas(items, deteccion.celdas, deteccion.filas, deteccion.columnas);
      logDiag("11_MATRIZ", { filas: deteccion.filas, columnas: deteccion.columnas });
      setProgreso(100, 'Completado');
      mostrarTabla(matriz);
    } else {
      // Fallback: agrupar por Y (como antes)
      log('⚠️ Usando agrupación por filas (sin detección de líneas)');
      const filas = agruparPorFilas(items);
      const matriz = filas.map(f => f.map(i => i.text));
      mostrarTabla(matriz);
    }

    setTimeout(() => mostrarBarra(false), 3000);

  } catch (error) {
    logError(`Error OCR: ${error.message}`);
    console.error(error);
    mostrarBarra(false);
  }
}

// Fallback: agrupar por Y
function agruparPorFilas(items) {
  items.sort((a, b) => {
    const ay = a.poly[0][1], by = b.poly[0][1];
    if (Math.abs(ay - by) < 10) return a.poly[0][0] - b.poly[0][0];
    return ay - by;
  });

  const filas = [];
  let filaActual = [];
  let ultimaY = -100;

  items.forEach(item => {
    const y = item.poly[0][1];
    if (Math.abs(y - ultimaY) > 10) {
      if (filaActual.length > 0) filas.push(filaActual);
      filaActual = [];
      ultimaY = y;
    }
    filaActual.push(item);
  });
  if (filaActual.length > 0) filas.push(filaActual);
  return filas;
}

// ==============================================
// BOTONES
// ==============================================
document.getElementById('btnCamara').addEventListener('click', async () => {
  try {
    log('Abriendo cámara...');
    const foto = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: CameraSource.Camera
    });
    await runOCR(foto.base64String);
  } catch (error) {
    logError(`Error cámara: ${error.message}`);
  }
});

document.getElementById('btnGaleria').addEventListener('click', async () => {
  try {
    log('Abriendo galería...');
    const foto = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: CameraSource.Photos
    });
    await runOCR(foto.base64String);
  } catch (error) {
    logError(`Error galería: ${error.message}`);
  }
});

log('app.js HÍBRIDO cargado. Listo.');
