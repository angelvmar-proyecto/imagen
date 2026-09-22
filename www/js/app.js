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

async function initOCR() {
  if (ocr) return;
  log('Cargando modelo OCR...');
  try {
    ocr = await PaddleOCR.create({
      textDetectionModelName: "my_det_model",
      textDetectionModelAsset: { url: "/models/my_det_model.tar" },
      textRecognitionModelName: "my_rec_model",
      textRecognitionModelAsset: { url: "/models/my_rec_model.tar" },
      ortOptions: { backend: "wasm" }
    });
    log('Modelo cargado. Listo.');
  } catch (error) {
    logError(`Error al cargar: ${error.message}`);
  }
}

// Redimensionar la imagen a un tamaño máximo para evitar OOM
async function redimensionarImagen(base64, maxLado = 1280) {
  const img = new Image();
  img.src = `data:image/jpeg;base64,${base64}`;
  await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });

  let w = img.width;
  let h = img.height;

  // Reducir si es más grande que maxLado
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

  // Devolver como blob JPEG con calidad 0.7 (más ligero)
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.7);
  });
}

async function runOCR(base64) {
  try {
    await initOCR();
    if (!ocr) return;

    log('Redimensionando imagen...');
    const blob = await redimensionarImagen(base64, 1280);

    if (!blob) {
      logError('No se pudo redimensionar la imagen');
      return;
    }

    log('Ejecutando OCR (' + Math.round(blob.size / 1024) + ' KB)...');
    const [result] = await ocr.predict(blob);

    log('Completado');
    resultado.textContent = result.text || '(sin texto detectado)';
  } catch (error) {
    logError(`Error OCR: ${error.message}`);
  }
}

document.getElementById('btnCamara').addEventListener('click', async () => {
  try {
    log('Abriendo cámara...');
    const foto = await Camera.getPhoto({
      quality: 70, // Reducir calidad directamente desde la cámara
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
