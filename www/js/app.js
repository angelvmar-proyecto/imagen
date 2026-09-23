// ==============================================
// OCR Timeshare — app.js CORREGIDO
// Mantiene: preprocesamiento + detección + PaddleOCR
// Añade: B) último resultado + C) liberación de memoria
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
function logDiag(nombre, valor) {
  const msg = `[DIAG ${nombre}] ${JSON.stringify(valor)}`;
  console.log(msg);
  if (debug) {
    debug.style.display = 'block';
    debug.textContent += msg + '\n';
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
// INIT OCR (con URL como antes — funcionaba)
// ==============================================
async function initOCR() {
  if (ocr) return;
  if (ocrCache) { ocr = ocrCache; log('Modelo en caché de memoria'); return; }

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

  logDiag("1_ORIGINAL", { w: img.width, h: img.height });

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
  } catch (e) { logError(`Error preproc: ${e.message}`); }

  try {
    if (typeof aplicarRetinaGlobal === 'function' && window.PREPROC && window.PREPROC.RETINA_GLOBAL_ACTIVO) {
      setProgreso(15, 'Retina global...');
      aplicarRetinaGlobal(canvas);
      logDiag("4_RETINA", "aplicada");
    }
  } catch (e) { logError(`Error retina: ${e.message}`); }

  return canvas;
}

// ==============================================
// DETECCIÓN DE CELDAS
// ==============================================
function detectarCeldas(canvas) {
  try {
    log('🔬 Detectando líneas...');
    setProgreso(20, 'Detectando líneas...');

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const brillo = calcularBrillo(imageData);
    const ancho = canvas.width;
    const alto = canvas.height;

    logDiag("5_BRILLO", { ancho, alto });

    setProgreso(30, 'Óptica + A3 + Ecografía...');
    const det = ejecutarDeteccion(brillo, ancho, alto);
    logDiag("6_DETECCION", {
      opticaH: det.optica.lineasH.length,
      opticaV: det.optica.lineasV.length,
      a3H: det.a3.lineasH.length,
      a3V: det.a3.lineasV.length,
      ecoH: det.ecografia.lineasH.length,
      ecoV: det.ecografia.lineasV.length
    });

    setProgreso(45, 'LIDAR...');
    const lidar = ejecutarLidar(
      det.optica.lineasH, det.optica.lineasV,
      det.ecografia.lineasH, det.ecografia.lineasV,
      det.a3.lineasH, det.a3.lineasV,
      brillo, ancho, alto
    );
    logDiag("7_LIDAR", { lineasH: lidar.lineasH.length, lineasV: lidar.lineasV.length });

    if (lidar.lineasH.length < 2 || lidar.lineasV.length < 2) {
      log('⚠️ No se detectaron suficientes líneas');
      return null;
    }

    setProgreso(55, 'Recortando celdas...');
    const celdas = recortarCeldas(lidar.lineasH, lidar.lineasV);
    logDiag("8_CELDAS", {
      filas: lidar.lineasH.length - 1,
      columnas: lidar.lineasV.length - 1,
      totalCeldas: celdas.length
    });

    return {
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
  if (contenedor) {
    contenedor.style.display = 'grid';
    // Actualizar handlers con el nuevo texto
    const btns = contenedor.querySelectorAll('button');
    if (btns[0]) btns[0].onclick = async () => {
      try { await navigator.clipboard.writeText(textoTSV); log('✅ Copiado'); }
      catch (e) { logError(`Error: ${e.message}`); }
    };
    if (btns[1]) btns[1].onclick = async () => {
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
    if (btns[2]) btns[2].onclick = async () => {
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
    return;
  }

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

    logDiag("9_BLOB", { kb: Math.round(blob.size / 1024) });

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

    logDiag("10_ITEMS", { cantidad: items.length });

    let matriz;
    if (deteccion && items.length > 0) {
      setProgreso(95, 'Asignando a celdas...');
      matriz = asignarItemsACeldas(items, deteccion.celdas, deteccion.filas, deteccion.columnas);
      logDiag("11_MATRIZ", { filas: deteccion.filas, columnas: deteccion.columnas });
    } else {
      // Fallback
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
    try {
      localStorage.setItem('ocr_ultimo_resultado', JSON.stringify({
        matriz: matriz,
        filas: matriz.length,
        columnas: matriz[0] ? matriz[0].length : 0,
        fecha: new Date().toISOString()
      }));
      console.log('💾 Último resultado guardado');
    } catch (e) {
      console.warn('⚠️ No se pudo guardar el resultado:', e);
    }

    setTimeout(() => mostrarBarra(false), 3000);

  } catch (error) {
    logError(`Error OCR: ${error.message}`);
    console.error(error);
    mostrarBarra(false);
  } finally {
    // C) Liberar memoria
    if (canvas) {
      try {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.width = 0;
        canvas.height = 0;
      } catch (e) {}
      canvas = null;
    }
    blob = null;
  }
}

// ==============================================
// B) RECUPERAR ÚLTIMO RESULTADO
// ==============================================
// ==============================================
// ZOOM DE LA TABLA (pinch + botones)
// ==============================================
let zoomTabla = 1;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
const ZOOM_PASO = 0.25;

function aplicarZoom() {
  const tabla = document.getElementById('tablaResultado');
  const nivel = document.getElementById('zoomNivel');
  if (tabla) tabla.style.transform = `scale(${zoomTabla})`;
  if (nivel) nivel.textContent = Math.round(zoomTabla * 100) + '%';
}

function setZoom(nuevoZoom) {
  zoomTabla = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, nuevoZoom));
  aplicarZoom();
}

// Botones de zoom
document.getElementById('btnZoomMenos').addEventListener('click', () => {
  setZoom(zoomTabla - ZOOM_PASO);
});
document.getElementById('btnZoomMas').addEventListener('click', () => {
  setZoom(zoomTabla + ZOOM_PASO);
});
document.getElementById('btnZoomReset').addEventListener('click', () => {
  setZoom(1);
});

// Pinch-to-zoom en la tabla
const tablaCont = document.getElementById('tablaContenedor');
let distanciaPinch = 0;
let zoomInicialPinch = 1;

tablaCont.addEventListener('touchstart', (e) => {
  if (e.touches.length === 2) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    distanciaPinch = Math.sqrt(dx * dx + dy * dy);
    zoomInicialPinch = zoomTabla;
  }
}, { passive: true });

tablaCont.addEventListener('touchmove', (e) => {
  if (e.touches.length === 2 && distanciaPinch > 0) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const distanciaNueva = Math.sqrt(dx * dx + dy * dy);
    const factor = distanciaNueva / distanciaPinch;
    setZoom(zoomInicialPinch * factor);
  }
}, { passive: true });

tablaCont.addEventListener('touchend', (e) => {
  if (e.touches.length < 2) {
    distanciaPinch = 0;
  }
}, { passive: true });

// Doble toque para resetear zoom
let ultimoToque = 0;
tablaCont.addEventListener('touchend', (e) => {
  if (e.changedTouches.length === 1) {
    const ahora = Date.now();
    if (ahora - ultimoToque < 300) {
      setZoom(1);
      ultimoToque = 0;
    } else {
      ultimoToque = ahora;
    }
  }
});

// Mostrar barra de zoom cuando haya tabla
const observerTabla = new MutationObserver(() => {
  const barraZoom = document.getElementById('barraZoom');
  const tablaVisible = document.getElementById('tablaContenedor').style.display === 'block';
  if (barraZoom) {
    if (tablaVisible) barraZoom.classList.add('visible');
    else barraZoom.classList.remove('visible');
  }
});

// Observar cambios en el contenedor de tabla
setTimeout(() => {
  const contTabla = document.getElementById('tablaContenedor');
  if (contTabla) {
    observerTabla.observe(contTabla, { attributes: true, attributeFilter: ['style'] });
  }
}, 1000);

console.log('✅ Zoom de tabla cargado');

function recuperarUltimoResultado() {
  try {
    const raw = localStorage.getItem('ocr_ultimo_resultado');
    if (!raw) {
      log('Listo. Pulsa un botón.');
      return;
    }
    const guardado = JSON.parse(raw);
    if (!guardado.matriz || guardado.matriz.length === 0) {
      log('Listo. Pulsa un botón.');
      return;
    }
    mostrarTabla(guardado.matriz);
    avisoResultado.style.display = 'block';
    log(`Mostrando resultado anterior (${guardado.filas}×${guardado.columnas})`);
  } catch (e) {
    log('Listo. Pulsa un botón.');
  }
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

// Botón borrar caché (opcional, ahora solo limpia localStorage)
const btnLimpiar = document.getElementById('btnLimpiarCache');
if (btnLimpiar) {
  btnLimpiar.addEventListener('click', () => {
    if (!confirm('¿Borrar el último resultado guardado?')) return;
    localStorage.removeItem('ocr_ultimo_resultado');
    ocrCache = null;
    ocr = null;
    alert('✅ Limpiado. Reinicia la app.');
  });
}

// ==============================================
// INICIO
// ==============================================
recuperarUltimoResultado();
console.log('✅ app.js cargado');
