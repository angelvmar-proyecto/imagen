import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
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

function mostrarBarra(v) { barraContenedor.style.display = v ? 'block' : 'none'; }
function setProgreso(p, t) {
  barraProgreso.style.width = p + '%';
  barraProgreso.textContent = p + '%';
  if (t) barraTexto.textContent = t;
}

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
    setProgreso(10, 'Modelo cargado');
    log('Modelo cargado. Listo.');
  } catch (error) {
    logError(`Error al cargar: ${error.message}`);
    mostrarBarra(false);
  }
}

async function redimensionarImagen(base64, maxLado = 800) {
  const img = new Image();
  img.src = `data:image/jpeg;base64,${base64}`;
  await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });

  let w = img.width, h = img.height;
  if (w > maxLado || h > maxLado) {
    const escala = Math.min(maxLado / w, maxLado / h);
    w = Math.round(w * escala);
    h = Math.round(h * escala);
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve({ blob, w, h }), 'image/jpeg', 0.7);
  });
}

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
    linea.split(/\t+|\s{2,}/).forEach(celda => {
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

async function runOCR(base64) {
  try {
    await initOCR();
    if (!ocr) return;

    // ===================== DIAGNÓSTICO 1: Imagen original =====================
    logDiag("1_IMAGEN_ORIGINAL", {
      bytes: Math.round(base64.length * 0.75),
      kb: Math.round(base64.length * 0.75 / 1024)
    });

    // ===================== DIAGNÓSTICO 2: Redimensión =====================
    setProgreso(15, 'Redimensionando imagen...');
    const { blob, w, h } = await redimensionarImagen(base64, 800);
    logDiag("2_IMAGEN_REDIMENSIONADA", {
      ancho: w,
      alto: h,
      kb: Math.round(blob.size / 1024)
    });

    // ===================== DIAGNÓSTICO 3: Tipo de blob =====================
    logDiag("3_BLOB_TYPE", { type: blob.type, size: blob.size });

    // ===================== DIAGNÓSTICO 4: Inicio del OCR =====================
    logDiag("4_INICIO_OCR", "enviando blob a paddleocr");
    setProgreso(25, 'Ejecutando OCR...');
    const inicio = Date.now();
    const intervalId = setInterval(() => {
      const seg = Math.floor((Date.now() - inicio) / 1000);
      setProgreso(Math.min(90, 25 + seg * 3), `Ejecutando OCR... ${seg}s`);
    }, 1000);

    // ===================== DIAGNÓSTICO 5: Probar sin parámetros =====================
    logDiag("5_LLAMADA_OCR", "sin parámetros extra");
    const resultadoCrudo = await ocr.predict(blob);
    clearInterval(intervalId);

    const segundos = Math.round((Date.now() - inicio) / 1000);
    logDiag("6_TIEMPO_OCR", { segundos });

    // ===================== DIAGNÓSTICO 7: Estructura completa del resultado =====================
    logDiag("7_RESULTADO_TIPO", typeof resultadoCrudo);
    logDiag("8_RESULTADO_KEYS", resultadoCrudo ? Object.keys(resultadoCrudo) : "null");

    // ===================== DIAGNÓSTICO 9: Contenido completo =====================
    try {
      logDiag("9_RESULTADO_COMPLETO", JSON.stringify(resultadoCrudo).substring(0, 2000));
    } catch (e) {
      logDiag("9_RESULTADO_ERROR", "no se puede stringificar: " + e.message);
    }

    // ===================== DIAGNÓSTICO 10: Análisis detallado =====================
    if (resultadoCrudo) {
      // Si es array
      if (Array.isArray(resultadoCrudo)) {
        logDiag("10_ES_ARRAY", { length: resultadoCrudo.length });
        resultadoCrudo.forEach((item, idx) => {
          logDiag(`10_ITEM_${idx}`, {
            keys: item ? Object.keys(item) : "null",
            text: item?.text,
            items: item?.items ? item.items.length : 0
          });
        });
      } 
      // Si es objeto
      else if (typeof resultadoCrudo === 'object') {
        logDiag("10_ES_OBJETO", {
          text: resultadoCrudo.text,
          tieneItems: !!resultadoCrudo.items,
          itemsLength: resultadoCrudo.items ? resultadoCrudo.items.length : 0
        });
      }
    }

    // ===================== MOSTRAR RESULTADO =====================
    setProgreso(100, `OCR completado en ${segundos}s`);
    log(`OCR completado en ${segundos}s`);

    // Extraer texto de múltiples formas posibles
    let textoFinal = '';

    if (Array.isArray(resultadoCrudo) && resultadoCrudo[0]) {
      textoFinal = resultadoCrudo[0].text || '';
    } else if (resultadoCrudo && resultadoCrudo.text) {
      textoFinal = resultadoCrudo.text;
    } else if (resultadoCrudo && resultadoCrudo.items && resultadoCrudo.items.length > 0) {
      textoFinal = resultadoCrudo.items.map(i => i.text).join('\n');
    }

    logDiag("TEXTO_FINAL", { length: textoFinal.length, preview: textoFinal.substring(0, 200) });

    if (textoFinal) {
      mostrarTabla(textoFinal);
    } else {
      resultado.style.display = 'block';
      resultado.textContent = '(sin texto detectado - revisa los DIAG arriba)';
    }

    setTimeout(() => mostrarBarra(false), 3000);

  } catch (error) {
    logError(`Error OCR: ${error.message}`);
    console.error(error);
    mostrarBarra(false);
  }
}

document.getElementById('btnCamara').addEventListener('click', async () => {
  try {
    log('Abriendo cámara...');
    const foto = await Camera.getPhoto({
      quality: 70, allowEditing: false,
      resultType: CameraResultType.Base64, source: CameraSource.Camera
    });
    await runOCR(foto.base64String);
  } catch (error) { logError(`Error cámara: ${error.message}`); }
});

document.getElementById('btnGaleria').addEventListener('click', async () => {
  try {
    log('Abriendo galería...');
    const foto = await Camera.getPhoto({
      quality: 70, allowEditing: false,
      resultType: CameraResultType.Base64, source: CameraSource.Photos
    });
    await runOCR(foto.base64String);
  } catch (error) { logError(`Error galería: ${error.message}`); }
});

log('app.js cargado. Pulsa un botón.');
