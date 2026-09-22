import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { CapacitorONNX } from '@cantoo/capacitor-onnx';

const btn = document.getElementById('btnEscanear');
const estado = document.getElementById('estado');
const resultado = document.getElementById('resultado');

let sessionId = null;

async function initONNX() {
  if (sessionId) return sessionId;
  estado.textContent = 'Cargando modelo ONNX...';
  const modelPath = 'models/ocr_model.onnx';
  sessionId = await CapacitorONNX.loadModel({
    modelPath: modelPath,
    executionProvider: 'cpu'
  });
  estado.textContent = 'Modelo cargado';
  return sessionId;
}

async function preprocessImage(imageUri) {
  const imageData = await Filesystem.readFile({
    path: imageUri,
    directory: Directory.Data
  });

  const img = new Image();
  img.src = `data:image/jpeg;base64,${imageData.data}`;
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });

  const targetW = 640;
  const targetH = 640;
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, targetW, targetH);

  const imageDataObj = ctx.getImageData(0, 0, targetW, targetH);
  const data = imageDataObj.data;
  const float32Data = new Float32Array(1 * 3 * targetH * targetW);
  const mean = [0.485, 0.456, 0.406];
  const std = [0.229, 0.224, 0.225];

  for (let h = 0; h < targetH; h++) {
    for (let w = 0; w < targetW; w++) {
      const idx = (h * targetW + w) * 4;
      for (let c = 0; c < 3; c++) {
        const value = data[idx + c] / 255.0;
        const normalized = (value - mean[c]) / std[c];
        const tensorIdx = c * (targetH * targetW) + h * targetW + w;
        float32Data[tensorIdx] = normalized;
      }
    }
  }

  return { data: float32Data, dims: [1, 3, targetH, targetW] };
}

async function runOCR(imageUri) {
  try {
    estado.textContent = 'Preprocesando imagen...';
    const inputTensor = await preprocessImage(imageUri);

    estado.textContent = 'Ejecutando ONNX...';
    const sid = await initONNX();

    const output = await CapacitorONNX.runInference({
      sessionId: sid,
      inputName: 'input',
      inputData: Array.from(inputTensor.data),
      inputDims: inputTensor.dims
    });

    estado.textContent = 'Completado';
    resultado.textContent = JSON.stringify(output, null, 2);
  } catch (error) {
    estado.textContent = 'Error: ' + error.message;
    console.error(error);
  }
}

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
    estado.textContent = 'Error: ' + error.message;
    console.error(error);
  }
});
