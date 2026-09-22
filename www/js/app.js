import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { PaddleOCR } from '@paddleocr/paddleocr-js';

const estado = document.getElementById('estado');
const resultado = document.getElementById('resultado');
const debug = document.getElementById('debug');
const panelPruebas = document.getElementById('panelPruebas');

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

// Las 10 variantes a probar
const variantes = [
  { nombre: "v5_mobile_det/rec", fn: () => PaddleOCR.create({ textDetectionModelName: "PP-OCRv5_mobile_det", textRecognitionModelName: "PP-OCRv5_mobile_rec" }) },
  { nombre: "v6_small via lang", fn: () => PaddleOCR.create({ lang: "ch", ocrVersion: "PP-OCRv6" }) },
  { nombre: "v6_tiny via lang", fn: () => PaddleOCR.create({ lang: "ch", ocrVersion: "PP-OCRv6_tiny" }) },
  { nombre: "v6_tiny_det/rec", fn: () => PaddleOCR.create({ textDetectionModelName: "PP-OCRv6_tiny_det", textRecognitionModelName: "PP-OCRv6_tiny_rec" }) },
  { nombre: "v6_small_det/rec", fn: () => PaddleOCR.create({ textDetectionModelName: "PP-OCRv6_small_det", textRecognitionModelName: "PP-OCRv6_small_rec" }) },
  { nombre: "v5_server_det/rec", fn: () => PaddleOCR.create({ textDetectionModelName: "PP-OCRv5_server_det", textRecognitionModelName: "PP-OCRv5_server_rec" }) },
  { nombre: "v5_mobile via lang ch", fn: () => PaddleOCR.create({ lang: "ch", ocrVersion: "PP-OCRv5" }) },
  { nombre: "v5_mobile via lang en", fn: () => PaddleOCR.create({ lang: "en", ocrVersion: "PP-OCRv5" }) },
  { nombre: "v6_small via lang es", fn: () => PaddleOCR.create({ lang: "es", ocrVersion: "PP-OCRv6" }) },
  { nombre: "v6_small via lang en", fn: () => PaddleOCR.create({ lang: "en", ocrVersion: "PP-OCRv6" }) }
];

// Crear botones de prueba
if (panelPruebas) {
  variantes.forEach((v, i) => {
    const btn = document.createElement('button');
    btn.textContent = `Probar: ${v.nombre}`;
    btn.style.padding = '8px';
    btn.style.fontSize = '12px';
    btn.style.margin = '2px';
    btn.onclick = async () => {
      ocr = null;
      log(`Probando: ${v.nombre}...`);
      try {
        ocr = await v.fn();
        log(`✅ FUNCIONA: ${v.nombre}`);
        resultado.textContent = `Configuración exitosa:\n${v.nombre}`;
      } catch (e) {
        log(`❌ Falló: ${v.nombre}`);
        logError(`Error [${v.nombre}]: ${e.message}`);
      }
    };
    panelPruebas.appendChild(btn);
  });
}

// Funciones de OCR (solo funcionan si ocr está cargado)
async function runOCR(imageUri) {
  if (!ocr) {
    logError('❌ Primero carga un modelo con los botones de prueba.');
    return;
  }
  try {
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

// Botones de cámara/galería
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

log('app.js cargado. Prueba las variantes en el panel.');
