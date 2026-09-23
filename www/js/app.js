// ==============================================
// OCR Timeshare — app.js con caché + memoria
// A) Modelo cacheado en IndexedDB
// B) Último resultado en localStorage
// C) Liberación de memoria post-OCR
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
const avisoResultado = document.getElementById('avisoResultado');

let ocr = null;
let ocrCache = null;

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
function limpiarDebug() {
  if (debug) { debug.textContent = ''; debug.style.display = 'none'; }
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
// INIT OCR CON CACHÉ (A)
// ==============================================
async function initOCR() {
  if (ocr) return;
  if (ocrCache) { ocr = ocrCache; log('Modelo en caché de memoria'); return; }

  log('Cargando modelo OCR...');
  mostrarBarra(true);
  setProgreso(0, 'Cargando detector...');

  try {
    // Cargar modelos con caché IndexedDB
    const detBuffer = await cargarModeloConCache('/models/my_det_model.tar', 'my_det_model.tar');
    const recBuffer = await cargarModeloConCache('/models/my_rec_model.tar', 'my_rec_model.tar');

    setProgreso(3, 'Creando sesión ONNX...');

    ocr = await PaddleOCR.create({
      textDetectionModelName: "my_det_model",
      textDetectionModelAsset: { buffer: detBuffer },
      textRecognitionModelName: "my_rec_model",
      textRecognitionModelAsset: { buffer: recBuffer },
      ortOptions: { backend: "wasm" }
    });

    ocrCache = ocr;
    setProgreso(5, 'Modelo listo');
    log('Modelo cargado.');
  } catch (error) {
    logError(`Error al cargar: ${error.message}`);
    mostrarBarra(false);
  }
}

// ==============================================
// PREPARAR IMAGEN
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
  }

  log('🔧 Preprocesando...');
  setProgreso(10, 'Preprocesando...');
  try {
    if (typeof preprocesarCanvasCompleto === 'function') {
      const pre = preprocesarCanvasCompleto(canvas);
      canvas = pre.canvas;
    }
  } catch (e) { logError(`Error preproc: ${e.message}`); }

  try {
    if (typeof aplicarRetinaGlobal === 'function' && window.PREPROC && window.PREPROC.RETINA_GLOBAL_ACTIVO) {
      setProgreso(15, 'Retina global...');
      aplicarRetinaGlobal(canvas);
    }
  } catch (e) { logError(`Error retina: ${e.message}`); }

  return canvas;
}

// ==============================================
// DETECCIÓN DE CELDAS
// ==============================================
function detectarCeldas(canvas) {
  try {
    setProgreso(20, 'Detectando líneas...');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const brillo = calcularBrillo(imageData);
    const ancho = canvas.width;
    const alto = canvas.height;

    setProgreso(30, 'Óptica + A3 + Ecografía...');
    const det = ejecutarDeteccion(brillo, ancho, alto);

    setProgreso(45, 'LIDAR...');
    const lidar = ejecutarLidar(
      det.optica.lineasH, det.optica.lineasV,
      det.ecografia.lineasH, det.ecografia.lineasV,
      det.a3.lineasH, det.a3.lineasV,
      brillo, ancho, alto
    );

    if (lidar.lineasH.length < 2 || lidar.lineasV.length < 2) return null;

    setProgreso(55, 'Recortando celdas...');
    const celdas = recortarCeldas(lidar.lineasH, lidar.lineasV);

    return {
      celdas: celdas,
      filas: lidar.lineasH.length - 1,
      columnas: lidar.lineasV.length - 1
    };
  } catch (e) {
    logError(`Error en detección: ${e.message}`);
    return null;
  }
}

// ==============================================
// ASIGNAR ITEMS A CELDAS
// ==============================================
function asignarItemsACeldas(items, celdas, filas, columnas) {
  const matriz = Array(filas).fill(null).map(() => Array(columnas).fill(''));

  items.forEach(item => {
    const poly = item.poly;
    const centroX = (poly[0][0] + poly[1][0] + poly[2][0] + poly[3][0]) / 4;
    const centroY = (poly[0][1] + poly[1][1] + poly[2][1] + poly[3][1]) / 4;

    for (const celda of celdas) {
      if (centroX >= celda.x1 && centroX <= celda.x2 &&
          centroY >= celda.y1 && centroY <= celda.y2) {
        const actual = matriz[celda.fila][celda.col];
        matriz[celda.fila][celda.col] = actual ? actual + ' ' + item.text : item.text;
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

  const textoTSV = matriz.map(f => f.join('\t')).join('\n');

  tablaContenedor.style.display = 'block';
  resultado.style.display = 'block';
  resultado.textContent = textoTSV;

  mostrarBotonesExportacion(textoTSV);
}

function mostrarBotonesExportacion(textoTSV) {
  let contenedor = document.getElementById('botonesExportar');
  if (!contenedor) {
    contenedor = document.createElement('div');
    contenedor.id = 'botonesExportar';
    contenedor.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:10px;';

    const btnCopiar = document.createElement('button');
    btnCopiar.textContent = '📋 Copiar';
    btnCopiar.style.cssText = 'background:#3b82f6;color:white;border:none;border-radius:8px;padding:10px;font-size:0.8rem;cursor:pointer;';
    btnCopiar.onclick = async () => {
      try { await navigator.clipboard.writeText(textoTSV); log('✅ Copiado'); }
      catch (e) { logError(`Error: ${e.message}`); }
    };

    const btnCSV = document.createElement('button');
    btnCSV.textContent = '📊 CSV';
    btnCSV.style.cssText = 'background:#f39c12;color:white;border:none;border-radius:8px;padding:10px;font-size:0.8rem;cursor:pointer;';
    btnCSV.onclick = async () => {
      try {
        const csv = '\uFEFF' + textoTSV.split('\n').map(l =>
          l.split('\t').map(c => '"' + c.replace(/"/g, '""') + '"').join(',')
        ).join('\n');
        const nombre = 'ocr_' + Date.now() + '.csv';
        await Filesystem.writeFile({
          path: nombre, data: btoa(unescape(encodeURIComponent(csv))),
          directory: Directory.Documents
        });
        log('✅ CSV: ' + nombre);
      } catch (e) { logError(`Error CSV: ${e.message}`); }
    };

    const btnExcel = document.createElement('button');
    btnExcel.textContent = '📈 Excel';
    btnExcel.style.cssText = 'background:#217346;color:white;border:none;border-radius:8px;padding:10px;font-size:0.8rem;cursor:pointer;';
    btnExcel.onclick = async () => {
      try {
        const filas = textoTSV.split('\n').map(l =>
          '<tr>' + l.split('\t').map(c => '<td>' + c + '</td>').join('') + '</tr>'
        ).join('');
        const html = '<html><head><meta charset="utf-8"></head><body><table>' + filas + '</table></body></html>';
        const nombre = 'ocr_' + Date.now() + '.xls';
        await Filesystem.writeFile({
          path: nombre, data: btoa(unescape(encodeURIComponent(html))),
          directory: Directory.Documents
        });
        log('✅ Excel: ' + nombre);
      } catch (e) { logError(`Error Excel: ${e.message}`); }
    };

    contenedor.appendChild(btnCopiar);
    contenedor.appendChild(btnCSV);
    contenedor.appendChild(btnExcel);
    tablaContenedor.parentNode.insertBefore(contenedor, tablaContenedor.nextSibling);
  }
  contenedor.style.display = 'grid';
}

// ==============================================
// PIPELINE PRINCIPAL
// ==============================================
async function runOCR(base64) {
  limpiarDebug();
  avisoResultado.style.display = 'none';

  let canvas = null;
  let blob = null;

  try {
    await initOCR();
    if (!ocr) return;

    canvas = await prepararImagen(base64);

    const deteccion = detectarCeldas(canvas);

    setProgreso(60, 'Ejecutando PaddleOCR...');
    blob = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.85);
    });

    const inicio = Date.now();
    const intervalId = setInterval(() => {
      const seg = Math.floor((Date.now() - inicio) / 1000);
      setProgreso(Math.min(90, 60 + seg * 2), `OCR... ${seg}s`);
    }, 1000);

    const resultadoCrudo = await ocr.predict(blob);
    clearInterval(intervalId);

    const segundos = Math.round((Date.now() - inicio) / 1000);
    log(`OCR completado en ${segundos}s`);

    let items = [];
    if (Array.isArray(resultadoCrudo) && resultadoCrudo[0] && resultadoCrudo[0].items) {
      items = resultadoCrudo[0].items;
    } else if (resultadoCrudo && resultadoCrudo.items) {
      items = resultadoCrudo.items;
    }

    let matriz;
    if (deteccion && items.length > 0) {
      setProgreso(95, 'Asignando a celdas...');
      matriz = asignarItemsACeldas(items, deteccion.celdas, deteccion.filas, deteccion.columnas);
    } else {
      // Fallback: agrupar por Y
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
      matriz = filas.map(f => f.map(i => i.text));
    }

    setProgreso(100, 'Completado');
    mostrarTabla(matriz);

    // B) Guardar último resultado
    guardarUltimoResultado({
      matriz: matriz,
      filas: matriz.length,
      columnas: matriz[0] ? matriz[0].length : 0
    });

    setTimeout(() => mostrarBarra(false), 3000);

  } catch (error) {
    logError(`Error OCR: ${error.message}`);
    console.error(error);
    mostrarBarra(false);
  } finally {
    // C) Liberar memoria
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.width = 0;
      canvas.height = 0;
      canvas = null;
    }
    blob = null;
  }
}

// ==============================================
// RECUPERAR ÚLTIMO RESULTADO (B)
// ==============================================
function recuperarUltimoResultado() {
  const guardado = leerUltimoResultado();
  if (!guardado || !guardado.matriz || guardado.matriz.length === 0) {
    log('Listo. Pulsa un botón.');
    return;
  }
  mostrarTabla(guardado.matriz);
  avisoResultado.style.display = 'block';
  log(`Mostrando resultado anterior (${guardado.filas}×${guardado.columnas})`);
}

// ==============================================
// BOTONES
// ==============================================
document.getElementById('btnCamara').addEventListener('click', async () => {
  try {
    log('Abriendo cámara...');
    const foto = await Camera.getPhoto({
      quality: 90, allowEditing: false,
      resultType: CameraResultType.Base64,
      source: CameraSource.Camera
    });
    await runOCR(foto.base64String);
  } catch (error) { logError(`Error cámara: ${error.message}`); }
});

document.getElementById('btnGaleria').addEventListener('click', async () => {
  try {
    log('Abriendo galería...');
    const foto = await Camera.getPhoto({
      quality: 90, allowEditing: false,
      resultType: CameraResultType.Base64,
      source: CameraSource.Photos
    });
    await runOCR(foto.base64String);
  } catch (error) { logError(`Error galería: ${error.message}`); }
});

document.getElementById('btnLimpiarCache').addEventListener('click', async () => {
  if (!confirm('¿Borrar la caché de modelos? Se descargarán de nuevo la próxima vez.')) return;
  await limpiarCacheModelos();
  limpiarUltimoResultado();
  ocrCache = null;
  ocr = null;
  alert('✅ Caché borrada. Reinicia la app.');
});

// ==============================================
// INICIO
// ==============================================
recuperarUltimoResultado();
console.log('✅ app.js con caché cargado');
