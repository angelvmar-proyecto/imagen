// ==============================================
// OCR Timeshare — app.js con preprocesamiento
// PaddleOCR + CRR + BS + Retina + Contraste + Escalado
// ==============================================

import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { PaddleOCR } from '@paddleocr/paddleocr-js';

// Referencias al DOM
const estado = document.getElementById('estado');
const resultado = document.getElementById('resultado');
const debug = document.getElementById('debug');
const barraContenedor = document.getElementById('barraContenedor');
const barraProgreso = document.getElementById('barraProgreso');
const barraTexto = document.getElementById('barraTexto');
const tablaContenedor = document.getElementById('tablaContenedor');
const tablaResultado = document.getElementById('tablaResultado').querySelector('tbody');

let ocr = null;

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
// INICIALIZACIÓN DEL OCR
// ==============================================
async function initOCR() {
  if (ocr) return;
  log('Cargando modelo OCR...');
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
    logDiag("INIT", "OK");
    setProgreso(5, 'Modelo cargado');
    log('Modelo cargado. Listo.');
  } catch (error) {
    logError(`Error al cargar: ${error.message}`);
    mostrarBarra(false);
  }
}

// ==============================================
// PREPARAR CANVAS DESDE BASE64 + PREPROCESAMIENTO
// ==============================================
async function prepararImagen(base64) {
  // 1. Crear imagen desde base64
  const img = new Image();
  img.src = `data:image/jpeg;base64,${base64}`;
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });

  // 2. Crear canvas del tamaño original
  let canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  let ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);

  logDiag("1_IMAGEN_ORIGINAL", { ancho: img.width, alto: img.height });

  // 3. Redimensionar si es muy grande (máximo 1024 px)
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

  // 4. Aplicar preprocesamiento completo (CRR + BS + Contraste + Escalado + Retina)
  log('🔧 Aplicando preprocesamiento...');
  setProgreso(15, 'Preprocesando...');

  let pre = null;
  try {
    if (typeof preprocesarCanvasCompleto === 'function') {
      pre = preprocesarCanvasCompleto(canvas);
      canvas = pre.canvas;
      const detalles = [];
      if (pre.stats.aplicoCRR) detalles.push('CRR');
      if (pre.stats.aplicoBS) detalles.push('BS');
      if (pre.stats.aplicoContraste) detalles.push('Contraste');
      if (pre.stats.aplicoEscalado) detalles.push('Escalado ' + pre.stats.factorEscalado + 'x');
      logDiag("3_PREPROC", {
        aplicado: detalles.join(' + ') || 'ninguno',
        tieneRuido: pre.stats.tieneRuido,
        tieneColor: pre.stats.tieneColor,
        anchoFinal: canvas.width,
        altoFinal: canvas.height
      });
      log('   ✅ ' + (detalles.join(' + ') || 'sin cambios'));
    } else {
      log('   ⚠️ preprocesamiento.js no cargado, usando imagen original');
    }
  } catch (e) {
    logError(`Error en preprocesamiento: ${e.message}`);
  }

  // 5. Aplicar retina global (unsharp masking)
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
// MOSTRAR TABLA (estilo Excel)
// ==============================================
function mostrarTabla(texto) {
  tablaResultado.innerHTML = '';

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
}

// ==============================================
// PIPELINE PRINCIPAL DE OCR
// ==============================================
async function runOCR(base64) {
  try {
    await initOCR();
    if (!ocr) return;

    // 1. Preparar imagen con preprocesamiento
    const canvas = await prepararImagen(base64);

    // 2. Convertir canvas a blob JPEG
    setProgreso(25, 'Ejecutando OCR...');
    const blob = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.85);
    });

    logDiag("4_BLOB_FINAL", {
      kb: Math.round(blob.size / 1024),
      ancho: canvas.width,
      alto: canvas.height
    });

    // 3. Ejecutar OCR con contador visual
    const inicio = Date.now();
    const intervalId = setInterval(() => {
      const seg = Math.floor((Date.now() - inicio) / 1000);
      setProgreso(Math.min(90, 25 + seg * 3), `Ejecutando OCR... ${seg}s`);
    }, 1000);

    logDiag("5_ENVIANDO_OCR", "blob a paddleocr");
    const resultadoCrudo = await ocr.predict(blob);
    clearInterval(intervalId);

    const segundos = Math.round((Date.now() - inicio) / 1000);
    setProgreso(95, `OCR completado en ${segundos}s`);
    log(`OCR completado en ${segundos}s`);

    // 4. Extraer items del resultado
    let items = [];
    if (Array.isArray(resultadoCrudo) && resultadoCrudo[0] && resultadoCrudo[0].items) {
      items = resultadoCrudo[0].items;
    } else if (resultadoCrudo && resultadoCrudo.items) {
      items = resultadoCrudo.items;
    }

    logDiag("6_ITEMS_DETECTADOS", { cantidad: items.length });

    if (items.length === 0) {
      log('⚠️ Sin items detectados');
      resultado.style.display = 'block';
      resultado.textContent = '(sin texto detectado)';
      setTimeout(() => mostrarBarra(false), 3000);
      return;
    }

    // 5. Ordenar items por posición (arriba→abajo, izquierda→derecha)
    items.sort((a, b) => {
      const ay = a.poly[0][1];
      const by = b.poly[0][1];
      const ax = a.poly[0][0];
      const bx = b.poly[0][0];
      if (Math.abs(ay - by) < 10) return ax - bx;
      return ay - by;
    });

    // 6. Agrupar por filas (misma Y aproximada)
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

    logDiag("7_FILAS", { cantidad: filas.length });

    // 7. Construir texto final con tabulaciones
    const textoFinal = filas.map(fila => {
      return fila.map(item => item.text).join('\t');
    }).join('\n');

    logDiag("8_TEXTO_FINAL", {
      length: textoFinal.length,
      preview: textoFinal.substring(0, 200)
    });

    // 8. Mostrar en tabla
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
log('app.js cargado. Listo para escanear.');
