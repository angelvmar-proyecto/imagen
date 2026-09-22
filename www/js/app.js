import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { PaddleOcrService } from 'paddleocr';
import * as ort from 'onnxruntime-web';

// Configurar la ruta de los archivos WASM de ONNX Runtime (usando CDN)
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.3/dist/';

const btn = document.getElementById('btnEscanear');
const estado = document.getElementById('estado');
const resultado = document.getElementById('resultado');

let paddleOcrService = null;

// Utilidad para convertir base64 a ArrayBuffer
function base64ToArrayBuffer(base64) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Inicialización: Cargar modelos y diccionario
async function initOCR() {
  if (paddleOcrService) return;

  estado.textContent = 'Cargando modelos ONNX... (esto puede tardar)';

  try {
    // Leer modelos como base64 desde los assets de la app
    const detBase64 = await Filesystem.readFile({
      path: 'public/models/det.onnx',
      directory: Directory.Data
    });

    const recBase64 = await Filesystem.readFile({
      path: 'public/models/rec.onnx',
      directory: Directory.Data
    });

    // Leer el diccionario como texto
    const dictText = await Filesystem.readFile({
      path: 'public/models/latin_dict.txt',
      directory: Directory.Data,
      encoding: Encoding.UTF8
    });

    const charactersDictionary = dictText.data.trimEnd().split(/\r?\n/);

    // Inicializar el servicio de PaddleOCR
    paddleOcrService = await PaddleOcrService.createInstance({
      ort,
      detection: {
        modelBuffer: base64ToArrayBuffer(detBase64.data),
      },
      recognition: {
        modelBuffer: base64ToArrayBuffer(recBase64.data),
        charactersDictionary: charactersDictionary,
        imageHeight: 48,
      },
    });

    estado.textContent = 'Modelos cargados. Listo para escanear.';
  } catch (error) {
    estado.textContent = `Error al cargar modelos: ${error.message}`;
    console.error(error);
  }
}

// Pipeline principal de OCR
async function runOCR(imageUri) {
  try {
    await initOCR();
    if (!paddleOcrService) return;

    estado.textContent = 'Preparando imagen...';

    // Leer la imagen capturada como base64
    const imageBase64 = await Filesystem.readFile({
      path: imageUri,
      directory: Directory.Data
    });

    // Crear un elemento imagen para obtener los datos de píxeles
    const img = new Image();
    img.src = `data:image/jpeg;base64,${imageBase64.data}`;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    // Dibujar en canvas para obtener ImageData (RGBA)
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, img.width, img.height);

    estado.textContent = 'Ejecutando OCR...';

    // PaddleOCR espera un objeto con width, height y data (Uint8Array)
    const result = await paddleOcrService.recognize({
      width: imageData.width,
      height: imageData.height,
      data: imageData.data, // RGBA Uint8Array
    });

    // Extraer el texto final
    const finalText = result.text;

    estado.textContent = 'Completado';
    resultado.textContent = finalText;

  } catch (error) {
    estado.textContent = `Error: ${error.message}`;
    console.error(error);
  }
}

// Evento del botón
btn.addEventListener('click', async () => {
  try {
    await initOCR();

    estado.textContent = 'Abriendo cámara...';
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
    estado.textContent = `Error: ${error.message}`;
    console.error(error);
  }
});
