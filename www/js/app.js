// ==============================================
// OCR Timeshare — app.js OPTIMIZADO
// PaddleOCR + Preprocesamiento + Cache + Exportación
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
let ultimoTexto = '';  // Guardar el último resultado para exportar

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

// ==============================================
// BARRA DE PROGRESO
// ==============================================
function mostrarBarra(v) {
  barraContenedor.style.display = v ? 'block' : 'none';
}

function setProgreso(p, t) {
  barraProgreso.style.width = p + '%';
  barraProgreso.textContent = p + '%';
  if (t) barraTexto.textContent = t;
}

// ==============================================
// CACHE DEL MODELO (Optimización 3)
// ==============================================
let ocrCache = null;

async function initOCR() {
  // Optimización: usar caché si ya está cargado
  if (ocr) return;
  if (ocrCache) {
    ocr = ocrCache;
    log('Modelo ya cargado (caché).');
    return;
  }

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
    ocrCache = ocr;  // Guardar en caché
    logDiag("INIT", "OK (cacheado)");
    setProgreso(5, 'Modelo cargado');
    log('Modelo cargado. Listo.');
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

  logDiag("1_IMAGEN_ORIGINAL", { ancho: img.width, alto: img.height });

  // Redimensionar si es muy grande
  const MAX = 1024;
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
    logDiag("2_REDIMENSIONADA", { ancho: w, alto: h });
  }

  // Preprocesamiento
  log('🔧 Aplicando preprocesamiento...');
  setProgreso(15, 'Preprocesando...');

  try {
    if (typeof preprocesarCanvasCompleto === 'function') {
      const pre = preprocesarCanvasCompleto(canvas);
      canvas = pre.canvas;
      const detalles = [];
      if (pre.stats.aplicoCRR) detalles.push('CRR');
      if (pre.stats.aplicoBS) detalles.push('BS');
      if (pre.stats.aplicoContraste) detalles.push('Contraste');
      if (pre.stats.aplicoEscalado) detalles.push('Escalado ' + pre.stats.factorEscalado + 'x');
      logDiag("3_PREPROC", {
        aplicado: detalles.join(' + ') || 'ninguno',
        tieneRuido: pre.stats.tieneRuido,
        tieneColor: pre.stats.tieneColor
      });
      log('   ✅ ' + (detalles.join(' + ') || 'sin cambios'));
    }
  } catch (e) {
    logError(`Error en preprocesamiento: ${e.message}`);
  }

  // Retina global
  try {
    if (typeof aplicarRetinaGlobal === 'function' && window.PREPROC && window.PREPROC.RETINA_GLOBAL_ACTIVO) {
      setProgreso(20, 'Retina global...');
      log('🧠 Retina global...');
      aplicarRetinaGlobal(canvas);
      log('   ✅ Retina aplicada');
    }
  } catch (e) {
    logError(`Error en retina: ${e.message}`);
  }

  return canvas;
}

// ==============================================
// AGRUPACIÓN DE FILAS (Optimización 1)
// ==============================================
function agruparEnFilas(items) {
  if (items.length === 0) return [];

  // Ordenar por Y y luego por X
  items.sort((a, b) => {
    const ay = a.poly[0][1];
    const by = b.poly[0][1];
    if (Math.abs(ay - by) < 5) return a.poly[0][0] - b.poly[0][0];
    return ay - by;
  });

  // Calcular la altura mediana del texto para el umbral adaptativo
  const alturas = items.map(i => Math.abs(i.poly[2][1] - i.poly[0][1])).filter(h => h > 0);
  alturas.sort((a, b) => a - b);
  const alturaMediana = alturas[Math.floor(alturas.length / 2)] || 10;

  // Umbral adaptativo: 0.7 de la altura mediana, mínimo 8px
  const umbralY = Math.max(8, Math.round(alturaMediana * 0.7));
  logDiag("4_UMBRAL_Y", { alturaMediana, umbralY });

  const filas = [];
  let filaActual = [];
  let ultimaY = -1000;

  items.forEach(item => {
    const y = item.poly[0][1];
    if (Math.abs(y - ultimaY) > umbralY) {
      if (filaActual.length > 0) filas.push(filaActual);
      filaActual = [];
      ultimaY = y;
    }
    filaActual.push(item);
  });
  if (filaActual.length > 0) filas.push(filaActual);

  // Unir filas consecutivas que estén muy cerca (Optimización 2)
  const filasUnidas = [];
  for (let i = 0; i < filas.length; i++) {
    if (filasUnidas.length === 0) {
      filasUnidas.push(filas[i]);
      continue;
    }
    // Comparar la Y promedio de la última fila unida con la actual
    const ultimaFila = filasUnidas[filasUnidas.length - 1];
    const yUltima = ultimaFila.reduce((s, i) => s + i.poly[0][1], 0) / ultimaFila.length;
    const yActual = filas[i].reduce((s, i) => s + i.poly[0][1], 0) / filas[i].length;

    if (yActual - yUltima < umbralY * 0.5) {
      // Fusionar
      filasUnidas[filasUnidas.length - 1] = ultimaFila.concat(filas[i]);
    } else {
      filasUnidas.push(filas[i]);
    }
  }

  return filasUnidas;
}

// ==============================================
// MOSTRAR TABLA
// ==============================================
function mostrarTabla(texto) {
  tablaResultado.innerHTML = '';
  ultimoTexto = texto;

  if (!texto || !texto.trim()) {
    resultado.style.display = 'block';
    resultado.textContent = '(sin texto detectado)';
    return;
  }

  const lineas = texto.split(/\r?\n/).filter(l => l.trim());

  lineas.forEach((linea, i) => {
    const tr = document.createElement('tr');
    const tdNum = document.createElement('td');
    tdNum.className = 'col-num';
    tdNum.textContent = i + 1;
    tr.appendChild(tdNum);

    const celdas = linea.split(/\t+|\s{2,}/);

    celdas.forEach(celda => {
      const td = document.createElement('td');
      td.textContent = celda.trim();
      tr.appendChild(td);
    });

    tablaResultado.appendChild(tr);
  });

  tablaContenedor.style.display = 'block';
  resultado.style.display = 'block';
  resultado.textContent = texto;

  // Mostrar botones de exportación
  mostrarBotonesExportacion();
}

// ==============================================
// EXPORTACIÓN (Optimización 4)
// ==============================================
function mostrarBotonesExportacion() {
  let contenedor = document.getElementById('botonesExportar');
  if (contenedor) {
    contenedor.style.display = 'grid';
    return;
  }

  // Crear contenedor si no existe
  contenedor = document.createElement('div');
  contenedor.id = 'botonesExportar';
  contenedor.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:10px;';

  // Botón Copiar (TSV)
  const btnCopiar = document.createElement('button');
  btnCopiar.textContent = '📋 Copiar';
  btnCopiar.style.cssText = 'background:#3b82f6;color:white;border:none;border-radius:8px;padding:10px;font-size:0.8rem;cursor:pointer;';
  btnCopiar.onclick = copiarTablaTSV;

  // Botón CSV
  const btnCSV = document.createElement('button');
  btnCSV.textContent = '📊 CSV';
  btnCSV.style.cssText = 'background:#f39c12;color:white;border:none;border-radius:8px;padding:10px;font-size:0.8rem;cursor:pointer;';
  btnCSV.onclick = exportarCSV;

  // Botón Excel
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
    log('✅ Tabla copiada al portapapeles');
  } catch (e) {
    logError(`Error al copiar: ${e.message}`);
  }
}

async function exportarCSV() {
  if (!ultimoTexto) return;
  try {
    // Convertir tabs a CSV
    const csv = '\uFEFF' + ultimoTexto.split('\n').map(linea => {
      return linea.split('\t').map(c => '"' + c.replace(/"/g, '""') + '"').join(',');
    }).join('\n');

    const nombre = 'ocr_' + Date.now() + '.csv';
    const base64 = btoa(unescape(encodeURIComponent(csv)));

    await Filesystem.writeFile({
      path: nombre,
      data: base64,
      directory: Directory.Documents
    });
    log('✅ CSV guardado en Documentos: ' + nombre);
  } catch (e) {
    logError(`Error al guardar CSV: ${e.message}`);
  }
}

async function exportarExcel() {
  if (!ultimoTexto) return;
  try {
    // Crear HTML simple que Excel puede abrir
    const filas = ultimoTexto.split('\n').map(linea => {
      return '<tr>' + linea.split('\t').map(c => '<td>' + c + '</td>').join('') + '</tr>';
    }).join('');
    const html = '<html><head><meta charset="utf-8"></head><body><table>' + filas + '</table></body></html>';

    const nombre = 'ocr_' + Date.now() + '.xls';
    const base64 = btoa(unescape(encodeURIComponent(html)));

    await Filesystem.writeFile({
      path: nombre,
      data: base64,
      directory: Directory.Documents
    });
    log('✅ Excel guardado en Documentos: ' + nombre);
  } catch (e) {
    logError(`Error al guardar Excel: ${e.message}`);
  }
}

// ==============================================
// PIPELINE PRINCIPAL
// ==============================================
async function runOCR(base64) {
  try {
    await initOCR();
    if (!ocr) return;

    const canvas = await prepararImagen(base64);

    setProgreso(25, 'Ejecutando OCR...');
    const blob = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.85);
    });

    logDiag("5_BLOB_FINAL", {
      kb: Math.round(blob.size / 1024),
      ancho: canvas.width,
      alto: canvas.height
    });

    const inicio = Date.now();
    const intervalId = setInterval(() => {
      const seg = Math.floor((Date.now() - inicio) / 1000);
      setProgreso(Math.min(90, 25 + seg * 3), `Ejecutando OCR... ${seg}s`);
    }, 1000);

    logDiag("6_ENVIANDO_OCR", "blob a paddleocr");
    const resultadoCrudo = await ocr.predict(blob);
    clearInterval(intervalId);

    const segundos = Math.round((Date.now() - inicio) / 1000);
    setProgreso(95, `OCR completado en ${segundos}s`);
    log(`OCR completado en ${segundos}s`);

    // Extraer items
    let items = [];
    if (Array.isArray(resultadoCrudo) && resultadoCrudo[0] && resultadoCrudo[0].items) {
      items = resultadoCrudo[0].items;
    } else if (resultadoCrudo && resultadoCrudo.items) {
      items = resultadoCrudo.items;
    }

    logDiag("7_ITEMS_DETECTADOS", { cantidad: items.length });

    if (items.length === 0) {
      log('⚠️ Sin items detectados');
      resultado.style.display = 'block';
      resultado.textContent = '(sin texto detectado)';
      setTimeout(() => mostrarBarra(false), 3000);
      return;
    }

    // Agrupar con el nuevo algoritmo
    const filas = agruparEnFilas(items);
    logDiag("8_FILAS_AGRUPADAS", { cantidad: filas.length });

    const textoFinal = filas.map(fila => {
      return fila.map(item => item.text).join('\t');
    }).join('\n');

    logDiag("9_TEXTO_FINAL", {
      length: textoFinal.length,
      preview: textoFinal.substring(0, 200)
    });

    setProgreso(100, 'Completado');
    mostrarTabla(textoFinal);

    setTimeout(() => mostrarBarra(false), 3000);

  } catch (error) {
    logError(`Error OCR: ${error.message}`);
    console.error(error);
    mostrarBarra(false);
  }
}

// ==============================================
// BOTONES
// ==============================================
document.getElementById('btnCamara').addEventListener('click', async () => {
  try {
    log('Abriendo cámara...');
    const foto = await Camera.getPhoto({
      quality: 85,
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
      quality: 85,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: CameraSource.Photos
    });
    await runOCR(foto.base64String);
  } catch (error) {
    logError(`Error galería: ${error.message}`);
  }
});

// ==============================================
// INICIO
// ==============================================
log('app.js OPTIMIZADO cargado. Listo para escanear.');
