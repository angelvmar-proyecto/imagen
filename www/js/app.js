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
  log('Cargando modelo OCR desde archivos locales...');
  try {
    ocr = await PaddleOCR.create({
      // Usar rutas locales en lugar de lang/ocrVersion
      textDetectionModelAsset: "/models/det.onnx",
      textRecognitionModelAsset: "/models/en_rec.onnx",
      // El diccionario también puede ser necesario
      textRecognitionCharactersDictionaryAsset: "/models/en_dict.txt",
      ortOptions: { backend: "wasm" }
    });
    log('Modelo cargado. Listo.');
  } catch (error) {
    logError(`Error al cargar: ${error.message}`);
  }
}

async function guardarImagen(foto) {
  const fileName = `ocr_${Date.now()}.jpeg`;
  await Filesystem.writeFile({
    path: fileName,
    data: foto.base64String,
    directory: Directory.Data
  });
  return fileName;
}

async function runOCR(fileName) {
  try {
    await initOCR();
    if (!ocr) return;

    log('Preparando imagen...');
    const imageBase64 = await Filesystem.readFile({
      path: fileName,
      directory: Directory.Data
    });

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

document.getElementById('btnCamara').addEventListener('click', async () => {
  try {
    log('Abriendo cámara...');
    const foto = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: CameraSource.Camera
    });
    const fileName = await guardarImagen(foto);
    await runOCR(fileName);
  } catch (error) { logError(`Error cámara: ${error.message}`); }
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
    const fileName = await guardarImagen(foto);
    await runOCR(fileName);
  } catch (error) { logError(`Error galería: ${error.message}`); }
});

log('app.js cargado.');
