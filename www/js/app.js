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

// -------------------------------------------------------------
// Barra de progreso
// -------------------------------------------------------------
function mostrarBarra(visible) {
  barraContenedor.style.display = visible ? 'block' : 'none';
  barraTexto.textContent = '';
}

function setProgreso(porcentaje, texto) {
  barraProgreso.style.width = porcentaje + '%';
  barraProgreso.textContent = porcentaje + '%';
  if (texto) barraTexto.textContent = texto;
}

// -------------------------------------------------------------
// Inicialización del OCR
// -------------------------------------------------------------
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
    setProgreso(10, 'Modelo cargado');
    log('Modelo cargado. Listo.');
  } catch (error) {
    logError(`Error al cargar: ${error.message}`);
    mostrarBarra(false);
  }
}

// -------------------------------------------------------------
// Redimensionar imagen
// -------------------------------------------------------------
async function redimensionarImagen(base64, maxLado = 1024) {
  const img = new Image();
  img.src = `data:image/jpeg;base64,${base64}`;
  await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });

  let w = img.width;
  let h = img.height;
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
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.7);
  });
}

// -------------------------------------------------------------
// Mostrar resultados en tabla estilo Excel
// -------------------------------------------------------------
function mostrarTabla(texto) {
  // Limpiar tabla anterior
  tablaResultado.innerHTML = '';

  if (!texto || !texto.trim()) {
    resultado.style.display = 'block';
    resultado.textContent = '(sin texto detectado)';
    return;
  }

  // Dividir por líneas y luego por espacios múltiples o tabulaciones
  const lineas = texto.split(/\r?\n/).filter(l => l.trim());

  lineas.forEach((linea, i) => {
    const tr = document.createElement('tr');
    const tdNum = document.createElement('td');
    tdNum.className = 'col-num';
    tdNum.textContent = i + 1;
    tr.appendChild(tdNum);

    // Dividir por 2+ espacios o tabulaciones
    const celdas = linea.split(/\t+|\s{2,}/);

    celdas.forEach(celda => {
      const td = document.createElement('td');
      td.textContent = celda.trim();
      tr.appendChild(td);
    });

    tablaResultado.appendChild(tr);
  });

  tablaContenedor.style.display = 'block';
  // También mostrar el texto plano como respaldo
  resultado.style.display = 'block';
  resultado.textContent = texto;
}

// -------------------------------------------------------------
// Pipeline principal
// -------------------------------------------------------------
async function runOCR(base64) {
  try {
    await initOCR();
    if (!ocr) return;

    setProgreso(15, 'Redimensionando imagen...');
    log('Redimensionando imagen...');
    const blob = await redimensionarImagen(base64, 1024);
    log('Imagen lista: ' + Math.round(blob.size / 1024) + ' KB');

    setProgreso(25, 'Ejecutando OCR...');
    const inicio = Date.now();

    // Contador de tiempo mientras corre el OCR
    const intervalId = setInterval(() => {
      const seg = Math.floor((Date.now() - inicio) / 1000);
      // Simular avance entre 25% y 90%
      const pct = Math.min(90, 25 + seg * 3);
      setProgreso(pct, `Ejecutando OCR... ${seg}s (puede tardar 60-90s la primera vez)`);
    }, 1000);

    setProgreso(25, 'Ejecutando OCR...');
    const [result] = await ocr.predict(blob);

    clearInterval(intervalId);
    const segundos = Math.round((Date.now() - inicio) / 1000);
    setProgreso(100, `OCR completado en ${segundos}s`);
    log(`OCR completado en ${segundos}s`);

    // Mostrar resultados
    if (result && result.text) {
      mostrarTabla(result.text);
    } else {
      resultado.style.display = 'block';
      resultado.textContent = '(sin texto detectado)';
    }

    // Ocultar barra después de 3 segundos
    setTimeout(() => mostrarBarra(false), 3000);

  } catch (error) {
    logError(`Error OCR: ${error.message}`);
    console.error(error);
    mostrarBarra(false);
  }
}

// -------------------------------------------------------------
// Botones
// -------------------------------------------------------------
document.getElementById('btnCamara').addEventListener('click', async () => {
  try {
    log('Abriendo cámara...');
    const foto = await Camera.getPhoto({
      quality: 70,
      allowEditing: false,
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
      quality: 70,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: CameraSource.Photos
    });
    await runOCR(foto.base64String);
  } catch (error) { logError(`Error galería: ${error.message}`); }
});

log('app.js cargado. Pulsa un botón.');
