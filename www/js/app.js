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

// Inicializar PaddleOCR usando nombres de modelo explícitos para PP-OCRv6
async function initOCR() {
  if (ocr) return;

  log('Cargando modelos OCR (PP-OCRv6)...');
  try {
    ocr = await PaddleOCR.create({
      // Usamos los nombres explícitos de los modelos de PP-OCRv6,
      // que incluyen un único modelo unificado para 50 idiomas (incluido el español).
      textDetectionModelName: "PP-OCRv6_tiny_det",
      textRecognitionModelName: "PP-OCRv6_tiny_rec",
      ortOptions: {
        backend: "wasm" // Forzamos WASM para máxima compatibilidad
      }
    });
    log('Modelos cargados. Listo.');
  } catch (error) {
    logError(`Error al cargar modelos: ${error.message}`);
  }
}

async function runOCR(imageUri) {
  try {
    await initOCR();
    if (!ocr) return;

    log('Preparando imagen...');
    const imageBase64 = await Filesystem.readFile({
      path: imageUri,
      directory: Directory.Data
    });

    const img = new Image();
    img.src = `data:image/jpeg;base64,${imageBase64.data}`;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

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
    const foto = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: CameraSource.Camera
    });
    const savedFile = await Filesystem.writeFile({
      path: `ocr_${Date.now()}.jpeg`,
      data: foto.base64String,
      directory: Directory.Data
    });
    await runOCR(savedFile.uri);
  } catch (error) {
    logError(`Error cámara: ${error.message}`);
  }
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
    const savedFile = await Filesystem.writeFile({
      path: `ocr_${Date.now()}.jpeg`,
      data: foto.base64String,
      directory: Directory.Data
    });
    await runOCR(savedFile.uri);
  } catch (error) {
    logError(`Error galería: ${error.message}`);
  }
});

log('app.js cargado. Listo para escanear.');
