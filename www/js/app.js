// Imports
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';

const estado = document.getElementById('estado');
const resultado = document.getElementById('resultado');
const debug = document.getElementById('debug');

function log(msg) {
  console.log(msg);
  estado.textContent = msg;
}

function logError(msg) {
  console.error(msg);
  debug.style.display = 'block';
  debug.textContent += `[app.js] ${msg}\n`;
}

log('app.js cargado correctamente');

let btn = document.getElementById('btnEscanear');
if (!btn) {
  logError('❌ No se encontró #btnEscanear en el HTML');
} else {
  log('✅ Botón encontrado, registrando evento click');
}

// ----------------------------------------------------------------
// Handler del botón: prueba primero SIN paddleocr para aislar el problema
// ----------------------------------------------------------------
if (btn) {
  btn.addEventListener('click', async () => {
    try {
      log('Botón pulsado. Abriendo cámara...');

      const foto = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera
      });

      log('✅ Foto capturada. Tamaño: ' + (foto.base64String?.length || 0) + ' bytes');

      const savedFile = await Filesystem.writeFile({
        path: `ocr_${Date.now()}.jpeg`,
        data: foto.base64String,
        directory: Directory.Data
      });

      log('✅ Archivo guardado en: ' + savedFile.uri);
      log('Cámara y Filesystem funcionan correctamente.');

      // AQUÍ va el OCR con paddleocr — lo dejamos comentado por ahora
      // para verificar primero que la captura funciona.
      resultado.textContent = 'Foto capturada y guardada. (OCR aún no conectado)';

    } catch (error) {
      logError(`Error en handler: ${error.message || error}`);
      console.error(error);
    }
  });

  log('Listo. Pulsa "Escanear Tabla".');
}
