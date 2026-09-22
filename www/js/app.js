import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { PaddleOcrService } from 'paddleocr';
import * as ort from 'onnxruntime-web';

// 1. Configurar ONNX Runtime para usar archivos WASM locales
//    (esto evita problemas de CORS y rutas en el WebView)
ort.env.wasm.wasmPaths = './wasm/';
ort.env.wasm.numThreads = 1; // Simplifica el entorno en móvil

const btn = document.getElementById('btnEscanear');
const estado = document.getElementById('estado');
const resultado = document.getElementById('resultado');

let paddleOcrService = null;

// --------------------------------------------------------------
// Inicialización: Cargar modelos ONNX
// --------------------------------------------------------------
async function initOCR() {
  if (paddleOcrService) return;

  estado.textContent = 'Cargando modelos ONNX... (esto puede tardar ~20s la primera vez)';

  try {
    // 2. Cargar modelos desde assets (www/models/)
    const detResponse = await fetch('./models/det.onnx');
    if (!detResponse.ok) throw new Error(`No se pudo cargar det.onnx: ${detResponse.status}`);
    const detBuffer = await detResponse.arrayBuffer();

    const recResponse = await fetch('./models/rec.onnx');
    if (!recResponse.ok) throw new Error(`No se pudo cargar rec.onnx: ${recResponse.status}`);
    const recBuffer = await recResponse.arrayBuffer();

    const dictResponse = await fetch('./models/latin_dict.txt');
    if (!dictResponse.ok) throw new Error(`No se pudo cargar latin_dict.txt: ${dictResponse.status}`);
    const dictText = await dictResponse.text();
    const charactersDictionary = dictText.trimEnd().split(/\r?\n/);

    paddleOcrService = await PaddleOcrService.createInstance({
      ort,
      detection: {
        modelBuffer: detBuffer,
      },
      recognition: {
        modelBuffer: recBuffer,
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

// --------------------------------------------------------------
// Pipeline principal de OCR
// --------------------------------------------------------------
async function runOCR(imageUri) {
  try {
    await initOCR();
    if (!paddleOcrService) return;

    estado.textContent = 'Preparando imagen...';

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

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, img.width, img.height);

    estado.textContent = 'Ejecutando OCR...';

    const result = await paddleOcrService.recognize({
      width: imageData.width,
      height: imageData.height,
      data: imageData.data,
    });

    const finalText = result.text;

    estado.textContent = 'Completado';
    resultado.textContent = finalText;

  } catch (error) {
    estado.textContent = `Error: ${error.message}`;
    console.error(error);
  }
}

// --------------------------------------------------------------
// Evento del botón
// --------------------------------------------------------------
btn.addEventListener('click', async () => {
  try {
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
