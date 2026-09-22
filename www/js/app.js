import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { PaddleOCR } from '@paddleocr/paddleocr-js';

const estado = document.getElementById('estado');
const resultado = document.getElementById('resultado');
const debug = document.getElementById('debug');

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

// Inicializar OCR con el modelo integrado PP-OCRv6 (soporta español)
async function initOCR() {
  if (ocr) return;

  log('Cargando modelo OCR...');
  try {
    ocr = await PaddleOCR.create({
      lang: "ch", // 'ch' usa el modelo v6 que incluye latino (español)
      ocrVersion: "PP-OCRv6",
      ortOptions: {
        backend: "wasm"
      }
    });
    log('Modelo cargado. Listo para escanear.');
  } catch (error) {
    logError(`Error al cargar: ${error.message}`);
  }
}

async function runOCR(imageUri) {
  try {
    await initOCR();
    if (!ocr) return;

    log('Preparando imagen...');
    const imageBase64 = await Filesystem.readFile({ path: imageUri, directory: Directory.Data });
    const img = new Image();
    img.src = `data:image/jpeg;base64,${imageBase64.data}`;
    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });
    const response = await fetch(img.src);
    const blob = await response.blob();

    log('Ejecutando OCR...');
    const [result] = await ocr.predict(blob);

    log('Completado');
    resultado.textContent = result.text || '(sin texto detectado)';
  } catch (error) {
    logError(`Error OCR: ${error.message}`);
  }
}

// Botones
document.getElementById('btnCamara').addEventListener('click', async () => {
  try {
    log('Abriendo cámara...');
    const foto = await Camera.getPhoto({ quality: 90, allowEditing: false, resultType: CameraResultType.Base64, source: CameraSource.Camera });
    const savedFile = await Filesystem.writeFile({ path: `ocr_${Date.now()}.jpeg`, data: foto.base64String, directory: Directory.Data });
    await runOCR(savedFile.uri);
  } catch (error) { logError(`Error cámara: ${error.message}`); }
});

document.getElementById('btnGaleria').addEventListener('click', async () => {
  try {
    log('Abriendo galería...');
    const foto = await Camera.getPhoto({ quality: 90, allowEditing: false, resultType: CameraResultType.Base64, source: CameraSource.Photos });
    const savedFile = await Filesystem.writeFile({ path: `ocr_${Date.now()}.jpeg`, data: foto.base64String, directory: Directory.Data });
    await runOCR(savedFile.uri);
  } catch (error) { logError(`Error galería: ${error.message}`); }
});

log('app.js cargado. Pulsa un botón.');
